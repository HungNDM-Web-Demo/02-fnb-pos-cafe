using Application.Common.Models;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Promotions;

namespace Application.DTOs.Vouchers;

// DTO voucher /api/vouchers (07 §2.7).

public sealed record VoucherDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DiscountType DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscount { get; init; }
    public decimal MinOrderAmount { get; init; }
    public int? MaxUses { get; init; }
    public int UsedCount { get; init; }

    /// <summary>ISO UTC.</summary>
    public DateTime? ExpiresAt { get; init; }

    public bool IsPaused { get; init; }
    public VoucherStatus Status { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed record SaveVoucherRequest
{
    public string Code { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DiscountType DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscount { get; init; }
    public decimal MinOrderAmount { get; init; }
    public int? MaxUses { get; init; }
    public DateTime? ExpiresAt { get; init; }
}

public sealed class VoucherQuery : PaginationQuery
{
    public VoucherStatus? Status { get; set; }
}

/// <summary>Kiểm tra voucher khi thu ngân nhập mã (UC-06 1b).</summary>
public sealed record VoucherCheckRequest
{
    public string Code { get; init; } = string.Empty;
    public decimal Subtotal { get; init; }
}

public sealed record VoucherCheckResult
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = string.Empty;
    public DiscountType DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscount { get; init; }
    public decimal MinOrderAmount { get; init; }

    /// <summary>Tính trên subtotal gửi lên theo 07 §3; BE tính lại khi thanh toán.</summary>
    public decimal EstimatedDiscount { get; init; }
}
