using Application.Common.Models;
using Application.DTOs.Reports;

namespace Application.Interfaces.Services.Reports;

/// <summary>Tổng quan và báo cáo (UC-12, UC-14, SRS §6). Chỉ tính hóa đơn DaThanhToan theo paidAt (BR-16).</summary>
public interface IReportService
{
    Task<DashboardReport> GetDashboardAsync(CancellationToken ct = default);

    Task<RevenueReport> GetRevenueAsync(ReportRangeQuery query, CancellationToken ct = default);

    Task<TopItemsReport> GetTopItemsAsync(TopItemsQuery query, CancellationToken ct = default);

    Task<HeatmapReport> GetHeatmapAsync(ReportRangeQuery query, CancellationToken ct = default);

    Task<PaymentMethodReport> GetPaymentMethodsAsync(ReportRangeQuery query, CancellationToken ct = default);

    Task<CashierReport> GetCashiersAsync(ReportRangeQuery query, CancellationToken ct = default);

    Task<PaginatedResult<CancelledOrderItem>> GetCancelledOrdersAsync(CancelledOrdersQuery query, CancellationToken ct = default);
}
