using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Promotions;
using Application.DTOs.Vouchers;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Vouchers;
using Application.Mappings.Promotions;
using Domain.Common;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Enums.Pos.Promotions;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Vouchers;

/// <summary>Voucher (UC-13, FR-27, BR-06, 07 §2.7).</summary>
public sealed class VoucherService(
    IGenericRepository<Voucher> vouchers,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider) : IVoucherService
{
    private const string NotFoundMessage = "Không tìm thấy voucher.";

    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<VoucherDto>> GetPagedAsync(VoucherQuery query, CancellationToken ct = default)
    {
        var now = Now;
        var source = vouchers.QueryNoTracking();

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(v => AppDbFunctions.Matches(v.Code, pattern) || AppDbFunctions.Matches(v.Description, pattern));
        }

        source = query.Status switch
        {
            VoucherStatus.TamDung => source.Where(v => v.IsPaused),
            VoucherStatus.HetHan => source.Where(v => !v.IsPaused && v.ExpiresAt != null && v.ExpiresAt < now),
            VoucherStatus.HetLuot => source.Where(v => !v.IsPaused && (v.ExpiresAt == null || v.ExpiresAt >= now) && v.MaxUses != null && v.UsedCount >= v.MaxUses),
            VoucherStatus.HoatDong => source.Where(v => !v.IsPaused && (v.ExpiresAt == null || v.ExpiresAt >= now) && (v.MaxUses == null || v.UsedCount < v.MaxUses)),
            _ => source
        };

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(v => v.ToDto(now)).ToList());
    }

    public async Task<VoucherDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var voucher = await vouchers.QueryNoTracking().FirstOrDefaultAsync(v => v.Id == id, ct)
            ?? throw new NotFoundException(NotFoundMessage);
        return voucher.ToDto(Now);
    }

    public async Task<VoucherDto> CreateAsync(SaveVoucherRequest request, CancellationToken ct = default)
    {
        await EnsureCodeUniqueAsync(request.Code, null, ct);

        var voucher = Voucher.Create(
            request.Code, request.Description, request.DiscountType, request.DiscountValue, request.MaxDiscount,
            request.MinOrderAmount, request.MaxUses, ToUtc(request.ExpiresAt));
        await vouchers.AddAsync(voucher, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return voucher.ToDto(Now);
    }

    public async Task<VoucherDto> UpdateAsync(Guid id, SaveVoucherRequest request, CancellationToken ct = default)
    {
        var voucher = await LoadAsync(id, ct);
        if (!string.Equals(Voucher.NormalizeCode(request.Code), voucher.Code, StringComparison.Ordinal))
            throw FieldErrors.Single("code", "Không đổi được mã voucher, tạo voucher mới");

        voucher.Update(request.Description, request.DiscountType, request.DiscountValue, request.MaxDiscount,
            request.MinOrderAmount, request.MaxUses, ToUtc(request.ExpiresAt));
        await unitOfWork.SaveChangesAsync(ct);
        return voucher.ToDto(Now);
    }

    public async Task SetPausedAsync(Guid id, SetPausedRequest request, CancellationToken ct = default)
    {
        var voucher = await LoadAsync(id, ct);
        voucher.SetPaused(request.IsPaused);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var voucher = await LoadAsync(id, ct);
        if (voucher.UsedCount > 0)
            throw new DomainException("Voucher đã được dùng, chỉ có thể tạm dừng");

        vouchers.Delete(voucher);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<VoucherCheckResult> CheckAsync(VoucherCheckRequest request, CancellationToken ct = default)
    {
        var code = Voucher.NormalizeCode(request.Code);
        var found = await vouchers.QueryNoTracking().FirstOrDefaultAsync(v => v.Code == code, ct);
        var voucher = OrderPricingService.RequireValidVoucher(found, Now, request.Subtotal, "code");
        var estimated = OrderPricing.OrderLevelAmount(voucher.DiscountType, voucher.DiscountValue, voucher.MaxDiscount, request.Subtotal);
        return voucher.ToCheckResult(estimated);
    }

    private async Task<Voucher> LoadAsync(Guid id, CancellationToken ct) =>
        await vouchers.Query().FirstOrDefaultAsync(v => v.Id == id, ct)
        ?? throw new NotFoundException(NotFoundMessage);

    private async Task EnsureCodeUniqueAsync(string code, Guid? currentId, CancellationToken ct)
    {
        var normalized = Voucher.NormalizeCode(code);
        if (await vouchers.AnyAsync(v => v.Code == normalized && v.Id != currentId, ct))
            throw new ConflictException("Mã voucher đã tồn tại", "code");
    }

    private static DateTime? ToUtc(DateTime? value) => value is { } v ? Application.Common.Time.VietnamTime.ToUtc(v) : null;
}
