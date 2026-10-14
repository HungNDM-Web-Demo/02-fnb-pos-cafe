using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Reports;
using Application.Interfaces.Services.Reports;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Reports;

/// <summary>
/// Tổng quan và báo cáo (UC-12, UC-14, 07 §2.8). Chỉ hóa đơn đã thanh toán theo paidAt (BR-16). <c>from</c>, <c>to</c> dạng
/// yyyy-MM-dd giờ Việt Nam, mặc định 30 ngày gần nhất; dài hơn 366 ngày → 400 <c>errors.from</c> (TC-30).
/// </summary>
[Route("api/reports")]
[AuthorizePermission(ProjectPermissions.Reports.View)]
public sealed class ReportsController(IReportService reportService) : BaseApiController
{
    [HttpGet("dashboard")]
    [ProducesResponseType<DashboardReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardReport>> Dashboard(CancellationToken ct) =>
        Ok(await reportService.GetDashboardAsync(ct));

    [HttpGet("revenue")]
    [ProducesResponseType<RevenueReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<RevenueReport>> Revenue([FromQuery] ReportRangeQuery query, CancellationToken ct) =>
        Ok(await reportService.GetRevenueAsync(query, ct));

    [HttpGet("top-items")]
    [ProducesResponseType<TopItemsReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<TopItemsReport>> TopItems([FromQuery] TopItemsQuery query, CancellationToken ct) =>
        Ok(await reportService.GetTopItemsAsync(query, ct));

    [HttpGet("heatmap")]
    [ProducesResponseType<HeatmapReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<HeatmapReport>> Heatmap([FromQuery] ReportRangeQuery query, CancellationToken ct) =>
        Ok(await reportService.GetHeatmapAsync(query, ct));

    [HttpGet("payment-methods")]
    [ProducesResponseType<PaymentMethodReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaymentMethodReport>> PaymentMethods([FromQuery] ReportRangeQuery query, CancellationToken ct) =>
        Ok(await reportService.GetPaymentMethodsAsync(query, ct));

    [HttpGet("cashiers")]
    [ProducesResponseType<CashierReport>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CashierReport>> Cashiers([FromQuery] ReportRangeQuery query, CancellationToken ct) =>
        Ok(await reportService.GetCashiersAsync(query, ct));

    /// <summary>Hóa đơn hủy, lọc theo ngày hủy, mới nhất trước.</summary>
    [HttpGet("cancelled-orders")]
    [ProducesResponseType<PaginatedResult<CancelledOrderItem>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<CancelledOrderItem>>> CancelledOrders([FromQuery] CancelledOrdersQuery query, CancellationToken ct) =>
        Ok(await reportService.GetCancelledOrdersAsync(query, ct));
}
