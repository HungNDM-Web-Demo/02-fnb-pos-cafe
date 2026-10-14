using Application.Common.Time;
using Application.DTOs.Promotions;
using Application.DTOs.Vouchers;
using Domain.Entities.Pos.Promotions;

namespace Application.Mappings.Promotions;

/// <summary>Ánh xạ viết tay cho khuyến mãi, voucher. Khuyến mãi cần <c>Include(MenuItems)</c>.</summary>
public static class PromotionMappings
{
    /// <remarks><c>categoryName</c>: Tên danh mục khi phạm vi DanhMuc, service tra. <c>nowUtc</c>: Thời điểm xét trạng thái.</remarks>
    public static PromotionDto ToDto(this Promotion promotion, string? categoryName, DateTime nowUtc) => new()
    {
        Id = promotion.Id,
        Code = promotion.Code,
        Name = promotion.Name,
        Description = promotion.Description,
        DiscountType = promotion.DiscountType,
        DiscountValue = promotion.DiscountValue,
        MaxDiscount = promotion.MaxDiscount,
        Scope = promotion.Scope,
        CategoryId = promotion.CategoryId,
        CategoryName = categoryName,
        MenuItemIds = promotion.MenuItems.Select(m => m.MenuItemId).ToList(),
        MinOrderAmount = promotion.MinOrderAmount,
        StartTime = promotion.StartTime is { } start ? VietnamDates.FormatTime(start) : null,
        EndTime = promotion.EndTime is { } end ? VietnamDates.FormatTime(end) : null,
        DaysOfWeek = promotion.DaysOfWeekList,
        StartDate = VietnamDates.Format(VietnamDates.DateOf(promotion.StartDate)),
        EndDate = VietnamDates.Format(VietnamDates.DateOf(promotion.EndDate)),
        IsPaused = promotion.IsPaused,
        Status = promotion.GetStatus(nowUtc),
        UpdatedAt = promotion.UpdatedAt ?? promotion.CreatedAt
    };

    public static VoucherDto ToDto(this Voucher voucher, DateTime nowUtc) => new()
    {
        Id = voucher.Id,
        Code = voucher.Code,
        Description = voucher.Description,
        DiscountType = voucher.DiscountType,
        DiscountValue = voucher.DiscountValue,
        MaxDiscount = voucher.MaxDiscount,
        MinOrderAmount = voucher.MinOrderAmount,
        MaxUses = voucher.MaxUses,
        UsedCount = voucher.UsedCount,
        ExpiresAt = voucher.ExpiresAt,
        IsPaused = voucher.IsPaused,
        Status = voucher.GetStatus(nowUtc),
        UpdatedAt = voucher.UpdatedAt ?? voucher.CreatedAt
    };

    public static VoucherCheckResult ToCheckResult(this Voucher voucher, decimal estimatedDiscount) => new()
    {
        VoucherId = voucher.Id,
        Code = voucher.Code,
        DiscountType = voucher.DiscountType,
        DiscountValue = voucher.DiscountValue,
        MaxDiscount = voucher.MaxDiscount,
        MinOrderAmount = voucher.MinOrderAmount,
        EstimatedDiscount = estimatedDiscount
    };
}
