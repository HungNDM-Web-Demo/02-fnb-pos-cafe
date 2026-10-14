using System.Globalization;
using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.Constants;
using Application.DTOs.Orders;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Roles;
using Application.Mappings.Orders;
using Domain.Common;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Pos;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Orders;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Shifts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

/// <summary>
/// Bán hàng, hóa đơn, đơn giữ (UC-04..UC-09, 07 §2.5). Mọi số tiền do <see cref="IOrderPricingService"/> tính lại;
/// mã hóa đơn sinh theo BR-09 trong cùng lần lưu, trùng do hai request cùng lúc thì thử lại một lần.
/// </summary>
public sealed class OrderService(
    IGenericRepository<Order> orders,
    IGenericRepository<Shift> shifts,
    IGenericRepository<Voucher> vouchers,
    IGenericRepository<Customer> customers,
    IGenericRepository<MenuItem> menuItems,
    IGenericRepository<Topping> toppings,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IPermissionService permissionService,
    IOrderPricingService pricing,
    IDiscountApprovalService discountApprovals,
    TimeProvider timeProvider) : IOrderService
{
    public const string CodePrefix = "HD";
    public const string NotFoundMessage = "Không tìm thấy hóa đơn.";
    public const string HeldNotFoundMessage = "Đơn giữ không còn";
    public const string TotalChangedMessage = "Tổng tiền đã thay đổi (khuyến mãi hoặc giá), kiểm tra lại đơn";
    public const string OverLimitMessage = "Giảm giá vượt hạn mức 10%, cần quản lý xác nhận";

    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<OrderListItem>> GetPagedAsync(OrderQuery query, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var source = orders.QueryNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payment)
            .AsSplitQuery()
            .Where(o => o.Status != OrderStatus.DangGiu);

        if (!await permissionService.HasPermissionAsync(userId, ProjectPermissions.Orders.ViewAll, ct))
            source = source.Where(o => o.CashierId == userId);
        else if (query.CashierId is { } cashierId)
            source = source.Where(o => o.CashierId == cashierId);

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(o => AppDbFunctions.Matches(o.Code, pattern));
        }

        if (VietnamDates.TryParse(query.From, out var from))
        {
            var fromUtc = VietnamDates.StartOfDayUtc(from);
            source = source.Where(o => o.PaidAt >= fromUtc);
        }

        if (VietnamDates.TryParse(query.To, out var to))
        {
            var toUtc = VietnamDates.EndOfDayExclusiveUtc(to);
            source = source.Where(o => o.PaidAt < toUtc);
        }

        if (query.Status is { } status)
            source = source.Where(o => o.Status == status);
        if (query.PaymentMethod is { } method)
            source = source.Where(o => o.Payment!.Method == method);
        if (query.ShiftId is { } shiftId)
            source = source.Where(o => o.ShiftId == shiftId);

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = nameof(Order.PaidAt);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(o => o.ToListItem()).ToList());
    }

    public async Task<OrderDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var order = await WithDetails(orders.QueryNoTracking()).FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new NotFoundException(NotFoundMessage);

        if (order.CashierId != userId && !await permissionService.HasPermissionAsync(userId, ProjectPermissions.Orders.ViewAll, ct))
            throw new ForbiddenException("Bạn chỉ xem được hóa đơn của mình (cần quyền orders.view-all).");

        return order.IsHeld ? order.ToHeldDto(await UnavailableCheckerAsync([order], ct)) : order.ToDto();
    }

    public async Task<NextCodeResult> GetNextCodeAsync(CancellationToken ct = default) =>
        new() { Code = await NextCodeAsync(Now, ct) };

    public async Task<CheckoutResult> CheckoutAsync(CheckoutRequest request, CancellationToken ct = default)
    {
        var clientRequestId = request.ClientRequestId.Trim();
        if (await FindByClientRequestIdAsync(clientRequestId, ct) is { } existing)
            return new CheckoutResult(existing.ToDto(), Created: false);

        var userId = RequireUserId();
        var shift = await ShiftQueries.OpenShiftOfAsync(shifts, userId, tracking: false, ct)
            ?? throw new DomainException(ShiftQueries.NoOpenShiftMessage);

        Order? held = null;
        if (request.HeldOrderId is { } heldId)
        {
            held = await orders.Query()
                .Include(o => o.Items).ThenInclude(i => i.Toppings)
                .FirstOrDefaultAsync(o => o.Id == heldId && o.CashierId == userId && o.Status == OrderStatus.DangGiu, ct)
                ?? throw new NotFoundException(HeldNotFoundMessage);
        }

        var now = Now;
        var cart = await pricing.PriceAsync(request, now, checkAvailability: true, ct);
        var customer = await ResolveCustomerAsync(request.CustomerId, tracking: true, ct);

        if (cart.Total != request.ExpectedTotal)
        {
            throw new ConflictException(
                TotalChangedMessage,
                null,
                new Dictionary<string, object?> { ["serverTotal"] = cart.Total });
        }

        var payment = request.Payment;
        if (payment.Method == PaymentMethod.TienMat && (payment.CashReceived ?? 0) < cart.Total)
            throw FieldErrors.Single("payment.cashReceived", $"Còn thiếu {PosRules.FormatVnd(cart.Total - (payment.CashReceived ?? 0))}");

        (Guid Id, string Name)? approvedBy = null;
        if (cart.ExceedsDiscountLimit)
        {
            if (string.IsNullOrWhiteSpace(request.DiscountApprovalToken))
            {
                throw new DomainException(OverLimitMessage, new Dictionary<string, object?>
                {
                    ["discountLimit"] = cart.DiscountLimit,
                    ["requestedDiscount"] = cart.ManualDiscountTotal
                });
            }

            approvedBy = discountApprovals.Consume(request.DiscountApprovalToken)
                ?? throw new DomainException(DiscountApprovalService.InvalidTokenMessage);
        }

        var order = held ?? Order.Create(shift.Id, userId, shift.CashierName, request.ServiceType, request.TableTag, cart, CustomerRef(customer));
        if (held is not null)
            held.ApplyCart(request.ServiceType, request.TableTag, cart, CustomerRef(customer));

        order.MarkPaid(await NextCodeAsync(now, ct), clientRequestId, payment.Method, payment.CashReceived, payment.QrContent, now, approvedBy);
        cart.Voucher?.RegisterUse();
        customer?.RecordOrder(order.PointsEarned, order.Total, now);

        if (held is null)
            await orders.AddAsync(order, ct);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Hai request cùng lúc: cùng clientRequestId đã lưu xong trước → trả hóa đơn đó; trùng mã trong ngày → thử lại một lần.
            if (await FindByClientRequestIdAsync(clientRequestId, ct) is { } duplicated)
                return new CheckoutResult(duplicated.ToDto(), Created: false);

            order.ReassignCode(await NextCodeAsync(now, ct));
            await unitOfWork.SaveChangesAsync(ct);
        }

        return new CheckoutResult(await LoadDtoAsync(order.Id, ct), Created: true);
    }

    public async Task<OrderDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var order = await orders.Query()
            .Include(o => o.Shift)
            .Include(o => o.Payment)
            .FirstOrDefaultAsync(o => o.Id == id && o.Status != OrderStatus.DangGiu, ct)
            ?? throw new NotFoundException(NotFoundMessage);

        if (order.IsCancelled)
            throw new DomainException("Hóa đơn đã hủy trước đó");
        if (order.Shift is not { IsOpen: true })
            throw new DomainException("Chỉ hủy được hóa đơn trong ca đang mở");

        order.Cancel(request.Reason, userId, currentUser.Username ?? string.Empty, Now);

        if (order.VoucherId is { } voucherId)
        {
            var voucher = await vouchers.Query().IgnoreQueryFilters().FirstOrDefaultAsync(v => v.Id == voucherId, ct);
            voucher?.ReleaseUse();
        }

        if (order.CustomerId is { } customerId)
        {
            var customer = await customers.Query().FirstOrDefaultAsync(c => c.Id == customerId, ct);
            customer?.RevertOrder(order.PointsEarned, order.Total);
        }

        await unitOfWork.SaveChangesAsync(ct);
        return await LoadDtoAsync(id, ct);
    }

    public async Task<IReadOnlyList<HeldOrderDto>> GetHeldAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var shift = await ShiftQueries.OpenShiftOfAsync(shifts, userId, tracking: false, ct);
        if (shift is null)
            return [];

        var held = await WithDetails(orders.QueryNoTracking())
            .Where(o => o.ShiftId == shift.Id && o.CashierId == userId && o.Status == OrderStatus.DangGiu)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);
        var unavailable = await UnavailableCheckerAsync(held, ct);
        return held.Select(o => o.ToHeldDto(unavailable)).ToList();
    }

    public async Task<HeldOrderDto> HoldAsync(HoldOrderRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var shift = await ShiftQueries.OpenShiftOfAsync(shifts, userId, tracking: false, ct)
            ?? throw new DomainException(ShiftQueries.NoOpenShiftMessage);

        var heldCount = await orders.QueryNoTracking()
            .CountAsync(o => o.ShiftId == shift.Id && o.CashierId == userId && o.Status == OrderStatus.DangGiu, ct);
        if (heldCount >= PosRules.MaxHeldOrders)
            throw new DomainException($"Tối đa {PosRules.MaxHeldOrders} đơn giữ, thanh toán hoặc xóa bớt");

        var cart = await pricing.PriceAsync(request, Now, checkAvailability: true, ct);
        var customer = await ResolveCustomerAsync(request.CustomerId, tracking: false, ct);

        var order = Order.Create(shift.Id, userId, shift.CashierName, request.ServiceType, request.TableTag, cart, CustomerRef(customer));
        order.SetHoldName(string.IsNullOrWhiteSpace(request.HoldName) ? $"Đơn {heldCount + 1}" : request.HoldName);
        await orders.AddAsync(order, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await LoadHeldDtoAsync(order.Id, ct);
    }

    public async Task<HeldOrderDto> UpdateHeldAsync(Guid id, HoldOrderRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var order = await orders.Query()
            .Include(o => o.Items).ThenInclude(i => i.Toppings)
            .FirstOrDefaultAsync(o => o.Id == id && o.CashierId == userId && o.Status == OrderStatus.DangGiu, ct)
            ?? throw new NotFoundException(HeldNotFoundMessage);

        var cart = await pricing.PriceAsync(request, Now, checkAvailability: true, ct);
        var customer = await ResolveCustomerAsync(request.CustomerId, tracking: false, ct);

        order.ApplyCart(request.ServiceType, request.TableTag, cart, CustomerRef(customer));
        if (!string.IsNullOrWhiteSpace(request.HoldName))
            order.SetHoldName(request.HoldName);
        await unitOfWork.SaveChangesAsync(ct);
        return await LoadHeldDtoAsync(id, ct);
    }

    public async Task DeleteHeldAsync(Guid id, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var order = await orders.Query()
            .Include(o => o.Items).ThenInclude(i => i.Toppings)
            .FirstOrDefaultAsync(o => o.Id == id && o.CashierId == userId && o.Status == OrderStatus.DangGiu, ct)
            ?? throw new NotFoundException(HeldNotFoundMessage);

        // Đơn giữ không phải hóa đơn: xóa cứng (06 §4).
        orders.Delete(order);
        await unitOfWork.SaveChangesAsync(ct);
    }

    /// <summary>BR-09: <c>HD</c> + <c>yyMMdd</c> + 4 số thứ tự thanh toán trong ngày (giờ Việt Nam).</summary>
    private async Task<string> NextCodeAsync(DateTime paidAtUtc, CancellationToken ct)
    {
        var prefix = CodePrefix + VietnamDates.DateOf(paidAtUtc).ToString("yyMMdd", CultureInfo.InvariantCulture);
        var count = await orders.QueryNoTracking().CountAsync(o => o.Code != null && o.Code.StartsWith(prefix), ct);
        return prefix + (count + 1).ToString("0000", CultureInfo.InvariantCulture);
    }

    private Task<Order?> FindByClientRequestIdAsync(string clientRequestId, CancellationToken ct) =>
        WithDetails(orders.QueryNoTracking()).FirstOrDefaultAsync(o => o.ClientRequestId == clientRequestId, ct);

    private async Task<OrderDto> LoadDtoAsync(Guid id, CancellationToken ct) =>
        (await WithDetails(orders.QueryNoTracking()).FirstAsync(o => o.Id == id, ct)).ToDto();

    private async Task<HeldOrderDto> LoadHeldDtoAsync(Guid id, CancellationToken ct)
    {
        var order = await WithDetails(orders.QueryNoTracking()).FirstAsync(o => o.Id == id, ct);
        return order.ToHeldDto(await UnavailableCheckerAsync([order], ct));
    }

    private static IQueryable<Order> WithDetails(IQueryable<Order> query) =>
        query.Include(o => o.Items).ThenInclude(i => i.Toppings)
            .Include(o => o.Payment)
            .Include(o => o.Shift)
            .Include(o => o.Customer)
            .AsSplitQuery();

    private async Task<Customer?> ResolveCustomerAsync(Guid? customerId, bool tracking, CancellationToken ct)
    {
        if (customerId is not { } id)
            return null;

        var query = tracking ? customers.Query() : customers.QueryNoTracking();
        return await query.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw FieldErrors.Single("customerId", "Khách hàng không tồn tại");
    }

    private static (Guid Id, string Phone)? CustomerRef(Customer? customer) =>
        customer is null ? null : (customer.Id, customer.Phone);

    /// <summary>BR-14: dòng đơn giữ không còn bán được khi món, size hoặc topping đã xóa, ẩn, tạm hết.</summary>
    private async Task<Func<OrderItem, bool>> UnavailableCheckerAsync(IReadOnlyList<Order> heldOrders, CancellationToken ct)
    {
        var items = heldOrders.SelectMany(o => o.Items).ToList();
        if (items.Count == 0)
            return _ => false;

        var itemIds = items.Select(i => i.MenuItemId).Distinct().ToList();
        var toppingIds = items.SelectMany(i => i.Toppings.Select(t => t.ToppingId)).Distinct().ToList();
        var itemMap = await menuItems.QueryNoTracking().Where(m => itemIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct);
        var toppingMap = toppingIds.Count == 0
            ? new Dictionary<Guid, Topping>()
            : await toppings.QueryNoTracking().Where(t => toppingIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, ct);

        return item =>
            !itemMap.TryGetValue(item.MenuItemId, out var menuItem)
            || !menuItem.IsListed
            || menuItem.IsSoldOut
            || menuItem.FindSize(item.SizeName) is null
            || item.Toppings.Any(t => !toppingMap.TryGetValue(t.ToppingId, out var topping) || !topping.IsListed || topping.IsSoldOut);
    }

    private Guid RequireUserId() =>
        currentUser.UserId ?? throw new UnauthorizedAccessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.");
}
