using Application.Common.Models;
using Application.DTOs.Orders;
using Domain.Enums.Pos.Shifts;

namespace Application.DTOs.Shifts;

// DTO ca làm /api/shifts (07 §2.6).

public record ShiftDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public ShiftStatus Status { get; init; }
    public Guid CashierId { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public DateTime OpenedAt { get; init; }
    public DateTime? ClosedAt { get; init; }
    public decimal OpeningCash { get; init; }
    public int OrderCount { get; init; }
    public int CancelledOrderCount { get; init; }
    public decimal CashSales { get; init; }
    public decimal TransferSales { get; init; }
    public decimal CashCancelled { get; init; }
    public decimal? ExpectedCash { get; init; }
    public decimal? CountedCash { get; init; }
    public decimal? Difference { get; init; }
    public string? Note { get; init; }
    public string? ReviewNote { get; init; }
    public string? ReviewedByName { get; init; }
    public DateTime? ReviewedAt { get; init; }
}

public sealed record HeldOrderSummary
{
    public Guid Id { get; init; }
    public string HoldName { get; init; } = string.Empty;
    public decimal Total { get; init; }
}

/// <summary>Tổng hợp tạm thời của ca đang mở (FR-22).</summary>
public sealed record ShiftSummary
{
    public Guid ShiftId { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime OpenedAt { get; init; }
    public decimal OpeningCash { get; init; }
    public int OrderCount { get; init; }
    public int CancelledOrderCount { get; init; }
    public decimal CashSales { get; init; }
    public decimal TransferSales { get; init; }
    public decimal CashCancelled { get; init; }

    /// <summary>cashSales + transferSales.</summary>
    public decimal Revenue { get; init; }

    /// <summary>BR-11.</summary>
    public decimal ExpectedCash { get; init; }

    /// <summary>BR-15.</summary>
    public IReadOnlyList<HeldOrderSummary> HeldOrders { get; init; } = [];
}

public sealed record OpenShiftRequest
{
    public decimal? OpeningCash { get; init; }
}

public sealed record CloseShiftRequest
{
    public decimal? CountedCash { get; init; }
    public string? Note { get; init; }
}

public sealed record ReviewShiftRequest
{
    public string Note { get; init; } = string.Empty;
}

public sealed record ShiftListItem : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public ShiftStatus Status { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public DateTime OpenedAt { get; init; }
    public DateTime? ClosedAt { get; init; }
    public int OrderCount { get; init; }

    /// <summary>cashSales + transferSales; ca đang mở tính tạm thời.</summary>
    public decimal Revenue { get; init; }

    public decimal? ExpectedCash { get; init; }
    public decimal? CountedCash { get; init; }
    public decimal? Difference { get; init; }
}

public sealed record ShiftDetail : ShiftDto
{
    public decimal Revenue { get; init; }

    /// <summary>Mọi hóa đơn của ca, gồm đã hủy, theo paidAt.</summary>
    public IReadOnlyList<OrderListItem> Orders { get; init; } = [];
}

/// <summary>Bộ lọc danh sách ca (FR-24): mặc định 7 ngày gần nhất theo openedAt.</summary>
public sealed class ShiftQuery : PaginationQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public Guid? CashierId { get; set; }
    public ShiftStatus? Status { get; set; }
}
