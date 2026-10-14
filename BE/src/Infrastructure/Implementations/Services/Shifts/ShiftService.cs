using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.Constants;
using Application.DTOs.Shifts;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Roles;
using Application.Interfaces.Services.Shifts;
using Application.Mappings.Orders;
using Application.Mappings.Shifts;
using Domain.Common;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Shifts;
using Domain.Entities.System.Users;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Shifts;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Shifts;

/// <summary>Ca làm (UC-03, UC-10, UC-11, 07 §2.6). Số tổng hợp của ca đang mở tính từ hóa đơn; chốt ca mới ghi vào cột.</summary>
public sealed class ShiftService(
    IGenericRepository<Shift> shifts,
    IGenericRepository<Order> orders,
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IPermissionService permissionService,
    TimeProvider timeProvider) : IShiftService
{
    private const int DefaultListDays = 7;

    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<ShiftDto?> GetCurrentAsync(CancellationToken ct = default)
    {
        var shift = await ShiftQueries.OpenShiftOfAsync(shifts, RequireUserId(), tracking: false, ct);
        return shift?.ToDto();
    }

    public async Task<(ShiftDto Shift, bool Created)> OpenAsync(OpenShiftRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var existing = await ShiftQueries.OpenShiftOfAsync(shifts, userId, tracking: false, ct);
        if (existing is not null)
            return (existing.ToDto(), false);

        var user = await users.QueryNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedAccessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.");

        var now = Now;
        var shift = Shift.Open(await ShiftQueries.NextCodeAsync(shifts, now, ct), userId, user.FullName, now, request.OpeningCash ?? 0);
        await shifts.AddAsync(shift, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return (shift.ToDto(), true);
    }

    public async Task<ShiftSummary?> GetCurrentSummaryAsync(CancellationToken ct = default)
    {
        var shift = await ShiftQueries.OpenShiftOfAsync(shifts, RequireUserId(), tracking: false, ct);
        if (shift is null)
            return null;

        return shift.ToSummary(await ShiftQueries.TotalsAsync(orders, shift.Id, ct), await HeldOrdersAsync(shift.Id, ct));
    }

    public async Task<ShiftDto> CloseCurrentAsync(CloseShiftRequest request, CancellationToken ct = default)
    {
        var shift = await ShiftQueries.OpenShiftOfAsync(shifts, RequireUserId(), tracking: true, ct)
            ?? throw new DomainException(ShiftQueries.NoOpenShiftMessage);

        // BR-15: còn đơn giữ thì phải xử lý trước.
        var held = await HeldOrdersAsync(shift.Id, ct);
        if (held.Count > 0)
        {
            throw new DomainException(
                $"Còn {held.Count} đơn giữ, thanh toán hoặc xóa trước khi chốt ca",
                new Dictionary<string, object?> { ["heldOrders"] = held });
        }

        var totals = await ShiftQueries.TotalsAsync(orders, shift.Id, ct);
        var countedCash = request.CountedCash ?? 0;
        var difference = countedCash - Shift.ComputeExpectedCash(shift.OpeningCash, totals);
        if (Shift.NeedsReview(difference) && string.IsNullOrWhiteSpace(request.Note))
            throw FieldErrors.Single("note", "Chênh lệch quá 50.000 ₫, cần ghi chú");

        shift.Close(totals, countedCash, request.Note, Now);
        await unitOfWork.SaveChangesAsync(ct);
        return shift.ToDto();
    }

    public async Task<PaginatedResult<ShiftListItem>> GetPagedAsync(ShiftQuery query, CancellationToken ct = default)
    {
        var source = shifts.QueryNoTracking();

        var hasFrom = VietnamDates.TryParse(query.From, out var from);
        var hasTo = VietnamDates.TryParse(query.To, out var to);
        if (!hasFrom && !hasTo)
        {
            to = VietnamDates.Today(timeProvider);
            from = to.AddDays(-(DefaultListDays - 1));
            hasFrom = hasTo = true;
        }

        if (hasFrom)
        {
            var fromUtc = VietnamDates.StartOfDayUtc(from);
            source = source.Where(s => s.OpenedAt >= fromUtc);
        }

        if (hasTo)
        {
            var toUtc = VietnamDates.EndOfDayExclusiveUtc(to);
            source = source.Where(s => s.OpenedAt < toUtc);
        }

        if (query.CashierId is { } cashierId)
            source = source.Where(s => s.CashierId == cashierId);
        if (query.Status is { } status)
            source = source.Where(s => s.Status == status);

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = nameof(Shift.OpenedAt);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);

        // Ca đang mở: số tổng hợp tạm thời tính từ hóa đơn.
        var openIds = page.Items.Where(s => s.IsOpen).Select(s => s.Id).ToList();
        var liveTotals = openIds.Count == 0
            ? new Dictionary<Guid, Shift.Totals>()
            : await ShiftQueries.TotalsByShiftAsync(orders, openIds, ct);

        return page.Map(items => items
            .Select(s => s.ToListItem(s.IsOpen ? liveTotals.GetValueOrDefault(s.Id, new Shift.Totals(0, 0, 0, 0, 0)) : null))
            .ToList());
    }

    public async Task<ShiftDetail> GetDetailAsync(Guid id, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var shift = await shifts.QueryNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException(ShiftQueries.NotFoundMessage);

        if (shift.CashierId != userId && !await permissionService.HasPermissionAsync(userId, ProjectPermissions.Shifts.View, ct))
            throw new ForbiddenException("Bạn chỉ xem được ca của mình (cần quyền shifts.view).");

        var totals = shift.IsOpen ? await ShiftQueries.TotalsAsync(orders, id, ct) : ShiftQueries.StoredTotals(shift);
        var orderList = await orders.QueryNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payment)
            .AsSplitQuery()
            .Where(o => o.ShiftId == id && o.Status != OrderStatus.DangGiu)
            .OrderBy(o => o.PaidAt)
            .ToListAsync(ct);

        return shift.ToDetail(totals, orderList.Select(o => o.ToListItem()).ToList());
    }

    public async Task<ShiftDto> ReviewAsync(Guid id, ReviewShiftRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var shift = await shifts.Query().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException(ShiftQueries.NotFoundMessage);

        if (shift.Status != ShiftStatus.CanKiemTra)
            throw new DomainException("Chỉ ghi chú xử lý cho ca Cần kiểm tra");

        shift.Review(request.Note, userId, currentUser.Username ?? string.Empty, Now);
        await unitOfWork.SaveChangesAsync(ct);
        return shift.ToDto();
    }

    private async Task<List<HeldOrderSummary>> HeldOrdersAsync(Guid shiftId, CancellationToken ct) =>
        await orders.QueryNoTracking()
            .Where(o => o.ShiftId == shiftId && o.Status == OrderStatus.DangGiu)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new HeldOrderSummary { Id = o.Id, HoldName = o.HoldName ?? string.Empty, Total = o.Total })
            .ToListAsync(ct);

    private Guid RequireUserId() =>
        currentUser.UserId ?? throw new UnauthorizedAccessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.");
}
