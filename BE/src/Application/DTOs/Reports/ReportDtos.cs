using Application.Common.Models;
using Application.Common.Time;
using Domain.Enums.Pos.Orders;

namespace Application.DTOs.Reports;

// DTO báo cáo /api/reports (07 §2.8). Chỉ tính hóa đơn DaThanhToan theo paidAt (BR-16).

/// <summary>Khoảng ngày <c>from</c>, <c>to</c> dạng yyyy-MM-dd giờ Việt Nam; thiếu thì 30 ngày gần nhất.</summary>
public class ReportRangeQuery
{
    public const int MaxDays = 366;
    public const int DefaultDays = 30;

    public string? From { get; set; }
    public string? To { get; set; }

    /// <summary>Khoảng ngày đã điền mặc định (validator đã kiểm tra định dạng và giới hạn).</summary>
    public (DateOnly From, DateOnly To) Resolve(TimeProvider timeProvider)
    {
        var today = VietnamDates.Today(timeProvider);
        var hasTo = VietnamDates.TryParse(To, out var to);
        var hasFrom = VietnamDates.TryParse(From, out var from);
        if (!hasTo)
            to = hasFrom ? from.AddDays(DefaultDays - 1) : today;
        if (!hasFrom)
            from = to.AddDays(-(DefaultDays - 1));
        return (from, to);
    }
}

public sealed class TopItemsQuery : ReportRangeQuery
{
    public Guid? CategoryId { get; set; }

    /// <summary>Mặc định 20.</summary>
    public int? Limit { get; set; }
}

public sealed class CancelledOrdersQuery : ReportRangeQuery
{
    public int Page { get; set; } = PaginationQuery.DefaultPage;
    public int PageSize { get; set; } = PaginationQuery.DefaultPageSize;

    public PaginationQuery ToPagination() => new() { Page = Page, PageSize = PageSize };
}

public sealed record RevenuePoint
{
    public decimal Revenue { get; init; }
    public int OrderCount { get; init; }
}

public sealed record HourlyRevenue
{
    public int Hour { get; init; }
    public decimal Revenue { get; init; }
    public int OrderCount { get; init; }
}

public sealed record DashboardTopItem
{
    public Guid MenuItemId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public decimal Revenue { get; init; }
}

public sealed record OpenShiftItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string CashierName { get; init; } = string.Empty;
    public DateTime OpenedAt { get; init; }
}

public sealed record DashboardReport
{
    /// <summary>Hôm nay yyyy-MM-dd.</summary>
    public string Date { get; init; } = string.Empty;

    /// <summary>Thời điểm tính (ISO).</summary>
    public DateTime AsOf { get; init; }

    public decimal Revenue { get; init; }
    public int OrderCount { get; init; }

    /// <summary>0 khi chưa có hóa đơn.</summary>
    public decimal AvgOrderValue { get; init; }

    /// <summary>Hôm qua tới cùng giờ:phút.</summary>
    public RevenuePoint YesterdaySameTime { get; init; } = new();

    /// <summary>(revenue − hôm qua) / hôm qua × 100, 1 chữ số; null khi hôm qua = 0.</summary>
    public decimal? RevenueChangePercent { get; init; }

    /// <summary>24 phần tử, 0–23.</summary>
    public IReadOnlyList<HourlyRevenue> Hourly { get; init; } = [];

    /// <summary>5 món, theo quantity.</summary>
    public IReadOnlyList<DashboardTopItem> TopItems { get; init; } = [];

    public IReadOnlyList<OpenShiftItem> OpenShifts { get; init; } = [];
}

public sealed record RevenueTotals
{
    public decimal Revenue { get; init; }
    public int OrderCount { get; init; }
    public decimal Discount { get; init; }
    public decimal AvgOrderValue { get; init; }
}

public sealed record PreviousPeriod
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public decimal Revenue { get; init; }
    public int OrderCount { get; init; }
    public decimal Discount { get; init; }
}

public sealed record DailyRevenue
{
    public string Date { get; init; } = string.Empty;
    public decimal Revenue { get; init; }
    public int OrderCount { get; init; }
    public decimal Discount { get; init; }

    /// <summary>Ngày cùng vị trí ở kỳ trước.</summary>
    public decimal PreviousRevenue { get; init; }
}

public sealed record RevenueReport
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public RevenueTotals Totals { get; init; } = new();
    public PreviousPeriod Previous { get; init; } = new();
    public decimal? RevenueChangePercent { get; init; }

    /// <summary>Đủ mọi ngày trong khoảng (TC-28).</summary>
    public IReadOnlyList<DailyRevenue> Daily { get; init; } = [];
}

public sealed record TopItemRow
{
    public Guid MenuItemId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public int Quantity { get; init; }

    /// <summary>Σ lineNet, không phân bổ giảm giá hóa đơn.</summary>
    public decimal Revenue { get; init; }

    /// <summary>% doanh thu, 1 chữ số.</summary>
    public decimal Share { get; init; }
}

public sealed record TopItemsReport
{
    public int TotalQuantity { get; init; }
    public decimal TotalRevenue { get; init; }

    /// <summary>Theo quantity giảm dần.</summary>
    public IReadOnlyList<TopItemRow> Items { get; init; } = [];
}

public sealed record HeatmapCell
{
    /// <summary>1 = Thứ Hai … 7 = Chủ nhật.</summary>
    public int DayOfWeek { get; init; }

    public int Hour { get; init; }
    public decimal Revenue { get; init; }
    public int OrderCount { get; init; }
}

public sealed record HeatmapReport
{
    /// <summary>7 × 24 ô.</summary>
    public IReadOnlyList<HeatmapCell> Cells { get; init; } = [];

    public decimal MaxRevenue { get; init; }
}

public sealed record PaymentMethodRow
{
    public PaymentMethod Method { get; init; }
    public decimal Amount { get; init; }
    public int OrderCount { get; init; }
    public decimal Share { get; init; }
}

public sealed record PaymentMethodReport
{
    /// <summary>Luôn đủ 2 phương thức.</summary>
    public IReadOnlyList<PaymentMethodRow> Items { get; init; } = [];
}

public sealed record CashierRow
{
    public Guid CashierId { get; init; }
    public string CashierName { get; init; } = string.Empty;

    /// <summary>Ca có openedAt trong khoảng, gồm ca đang mở.</summary>
    public int ShiftCount { get; init; }

    public int OrderCount { get; init; }
    public decimal Revenue { get; init; }

    /// <summary>Σ difference, null coi là 0.</summary>
    public decimal TotalDifference { get; init; }

    public int ShiftsNeedingReview { get; init; }
}

public sealed record CashierReport
{
    public IReadOnlyList<CashierRow> Items { get; init; } = [];
}

public sealed record CancelledOrderItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateTime PaidAt { get; init; }
    public DateTime CancelledAt { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public string CancelledByName { get; init; } = string.Empty;
    public string CancelReason { get; init; } = string.Empty;
    public decimal Total { get; init; }
    public PaymentMethod PaymentMethod { get; init; }
}
