using Application.Common.Models;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Promotions;

namespace Application.DTOs.Promotions;

// DTO khuyến mãi /api/promotions (07 §2.7).

public sealed record PromotionDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DiscountType DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscount { get; init; }
    public PromotionScope Scope { get; init; }
    public Guid? CategoryId { get; init; }
    public string? CategoryName { get; init; }

    /// <summary>Khi scope = Mon.</summary>
    public IReadOnlyList<Guid> MenuItemIds { get; init; } = [];

    public decimal MinOrderAmount { get; init; }

    /// <summary>"14:00".</summary>
    public string? StartTime { get; init; }

    public string? EndTime { get; init; }

    /// <summary>1 = Thứ Hai … 7 = Chủ nhật; rỗng = mọi ngày.</summary>
    public IReadOnlyList<int> DaysOfWeek { get; init; } = [];

    /// <summary>yyyy-MM-dd theo giờ Việt Nam.</summary>
    public string StartDate { get; init; } = string.Empty;

    public string EndDate { get; init; } = string.Empty;
    public bool IsPaused { get; init; }
    public PromotionStatus Status { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed record SavePromotionRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DiscountType DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscount { get; init; }
    public PromotionScope Scope { get; init; }
    public Guid? CategoryId { get; init; }
    public IReadOnlyList<Guid> MenuItemIds { get; init; } = [];
    public decimal MinOrderAmount { get; init; }
    public string? StartTime { get; init; }
    public string? EndTime { get; init; }
    public IReadOnlyList<int> DaysOfWeek { get; init; } = [];
    public string StartDate { get; init; } = string.Empty;
    public string EndDate { get; init; } = string.Empty;
}

public sealed class PromotionQuery : PaginationQuery
{
    public PromotionStatus? Status { get; set; }
}

/// <summary><c>PATCH .../pause</c> cho khuyến mãi và voucher.</summary>
public sealed record SetPausedRequest
{
    public bool IsPaused { get; init; }
}
