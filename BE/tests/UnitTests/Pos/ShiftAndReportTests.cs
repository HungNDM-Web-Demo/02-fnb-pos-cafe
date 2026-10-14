using System.Reflection;
using Application.Common.Exceptions;
using Application.Constants;
using Application.DTOs.Orders;
using Application.DTOs.Reports;
using Application.DTOs.Shifts;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Reports;
using Application.Interfaces.Services.Roles;
using Application.Interfaces.Services.Shifts;
using Application.Validators.Reports;
using Domain.Common;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Shifts;
using FluentValidation;
using Infrastructure.Persistence.Seeders;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Pos;

/// <summary>Ca làm (TC-06..TC-12), báo cáo (TC-26, TC-28..TC-30), phân quyền thu ngân.</summary>
public sealed class ShiftAndReportTests : IAsyncLifetime
{
    private PosTestHost _host = null!;
    private PosScenario _pos = null!;

    public async Task InitializeAsync()
    {
        _host = await PosTestHost.StartAsync();
        _pos = new PosScenario(_host);
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    [Fact]
    public async Task Tc06_OpenShift_CodeAndReopenReturnsSame()
    {
        var shift = await _pos.OpenShiftAsync("thungan");
        Assert.Equal(("CA26101402", ShiftStatus.DangMo, "Phạm Thị Hồng Nhung", 1_000_000m),
            (shift.Code, shift.Status, shift.CashierName, shift.OpeningCash));

        var (again, created) = await _host.CallAsync<IShiftService, (ShiftDto, bool)>(s => s.OpenAsync(new OpenShiftRequest { OpeningCash = 500_000 }));
        Assert.False(created);
        Assert.Equal(shift.Id, again.Id);
    }

    /// <summary>TC-08: 2 hóa đơn tiền mặt tổng 120.000 (Bánh 1 phần + đồ uống), 1 chuyển khoản 45.000.</summary>
    private async Task SellTc08Async()
    {
        var cash1 = await _pos.LineAsync("M009", "M", 2, "TP01");     // (35.000 + 5.000) × 2 = 80.000
        var cash2 = await _pos.LineAsync("M009", "M", 1, "TP01");     // 40.000
        var transfer = await _pos.LineAsync("M009", "M", 1, "TP08");  // 45.000
        await _pos.CheckoutAsync(PosScenario.Checkout([cash1], 80_000, cash: 100_000));
        await _pos.CheckoutAsync(PosScenario.Checkout([cash2], 40_000));
        await _pos.CheckoutAsync(PosScenario.Checkout([transfer], 45_000, PaymentMethod.ChuyenKhoan));
    }

    [Fact]
    public async Task Tc08_CloseShift_Matching()
    {
        await _pos.OpenShiftAsync("thungan");
        await SellTc08Async();

        var summary = await _host.CallAsync<IShiftService, ShiftSummary?>(s => s.GetCurrentSummaryAsync());
        Assert.Equal((3, 120_000m, 45_000m, 1_120_000m), (summary!.OrderCount, summary.CashSales, summary.TransferSales, summary.ExpectedCash));

        var closed = await _host.CallAsync<IShiftService, ShiftDto>(s => s.CloseCurrentAsync(new CloseShiftRequest { CountedCash = 1_120_000 }));
        Assert.Equal((ShiftStatus.DaChot, 0m, 1_120_000m), (closed.Status, closed.Difference!.Value, closed.ExpectedCash!.Value));
        Assert.Null(await _host.CallAsync<IShiftService, ShiftDto?>(s => s.GetCurrentAsync()));
    }

    [Fact]
    public async Task Tc09_Tc11_CloseWithBigDifference_NeedsNote_ThenReview()
    {
        await _pos.OpenShiftAsync("thungan");
        await SellTc08Async();

        var noNote = await Assert.ThrowsAsync<ValidationException>(() =>
            _host.CallAsync<IShiftService, ShiftDto>(s => s.CloseCurrentAsync(new CloseShiftRequest { CountedCash = 1_050_000 })));
        Assert.Equal(("note", "Chênh lệch quá 50.000 ₫, cần ghi chú"), (noNote.Errors.Single().PropertyName, noNote.Errors.Single().ErrorMessage));

        var closed = await _host.CallAsync<IShiftService, ShiftDto>(s =>
            s.CloseCurrentAsync(new CloseShiftRequest { CountedCash = 1_050_000, Note = "Đếm thiếu" }));
        Assert.Equal((ShiftStatus.CanKiemTra, -70_000m), (closed.Status, closed.Difference!.Value));

        // TC-11: quản lý lọc ca cần kiểm tra, ghi chú xử lý.
        await _host.SignInAsync("quanly");
        var list = await _host.CallAsync<IShiftService, Application.Common.Models.PaginatedResult<ShiftListItem>>(s =>
            s.GetPagedAsync(new ShiftQuery { Status = ShiftStatus.CanKiemTra }));
        Assert.Contains(list.Items, s => s.Id == closed.Id);
        Assert.Equal(2, list.TotalCount);

        var reviewed = await _host.CallAsync<IShiftService, ShiftDto>(s => s.ReviewAsync(closed.Id, new ReviewShiftRequest { Note = "Đã đối chiếu camera" }));
        Assert.Equal((ShiftStatus.DaKiemTra, "quanly", "Đã đối chiếu camera"), (reviewed.Status, reviewed.ReviewedByName, reviewed.ReviewNote));

        var notNeeded = await Assert.ThrowsAsync<DomainException>(() =>
            _host.CallAsync<IShiftService, ShiftDto>(s => s.ReviewAsync(closed.Id, new ReviewShiftRequest { Note = "Lần hai" })));
        Assert.Equal("Chỉ ghi chú xử lý cho ca Cần kiểm tra", notNeeded.Message);
    }

    [Fact]
    public async Task Tc10_CloseWithHeldOrder_IsBlocked()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.LineAsync("M001", "M", 1);
        await _host.CallAsync<IOrderService, HeldOrderDto>(s => s.HoldAsync(new HoldOrderRequest { Items = [line], HoldName = "Chị áo đỏ" }));

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            _host.CallAsync<IShiftService, ShiftDto>(s => s.CloseCurrentAsync(new CloseShiftRequest { CountedCash = 1_000_000 })));
        Assert.Equal("Còn 1 đơn giữ, thanh toán hoặc xóa trước khi chốt ca", error.Message);
        var held = Assert.Single((IEnumerable<HeldOrderSummary>)error.Extensions["heldOrders"]!);
        Assert.Equal(("Chị áo đỏ", 22_000m), (held.HoldName, held.Total));
    }

    [Fact]
    public async Task Tc12_CashierPermissions_NoShiftsView()
    {
        var thungan = await _host.SignInAsync("thungan");
        var access = await _host.CallAsync<IPermissionService, Application.Common.Models.UserAccess>(s => s.GetUserAccessAsync(thungan!.Value));

        Assert.DoesNotContain(ProjectPermissions.Shifts.View, access.Permissions);
        Assert.DoesNotContain(ProjectPermissions.Reports.View, access.Permissions);
        Assert.DoesNotContain(ProjectPermissions.Orders.ViewAll, access.Permissions);
        Assert.DoesNotContain(ProjectPermissions.Orders.DiscountOverride, access.Permissions);
        Assert.DoesNotContain(Permissions.Dashboard.View, access.Permissions);
        Assert.Contains(ProjectPermissions.Orders.Create, access.Permissions);
        Assert.Contains(ProjectPermissions.Shifts.Operate, access.Permissions);
        Assert.Contains(ProjectPermissions.MenuItems.Availability, access.Permissions);

        // Ca của người khác mà không có shifts.view → 403.
        var otherShift = await _host.QueryAsync<Shift, Guid>(q => q.Where(s => s.CashierName == "Võ Minh Tuấn").Select(s => s.Id).FirstAsync());
        await Assert.ThrowsAsync<ForbiddenException>(() => _host.CallAsync<IShiftService, ShiftDetail>(s => s.GetDetailAsync(otherShift)));

        var manager = await _host.SignInAsync("quanly");
        var managerAccess = await _host.CallAsync<IPermissionService, Application.Common.Models.UserAccess>(s => s.GetUserAccessAsync(manager!.Value));
        Assert.Contains(ProjectPermissions.Shifts.View, managerAccess.Permissions);
        Assert.Contains(ProjectPermissions.Orders.DiscountOverride, managerAccess.Permissions);
    }

    [Fact]
    public void ProjectPermissions_AreDeclaredInSeedFiles()
    {
        var seeded = SystemSeedData.Embedded.Permissions.Select(p => p.Code).ToHashSet();
        var codes = typeof(ProjectPermissions)
            .GetNestedTypes(BindingFlags.Public | BindingFlags.Static)
            .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static))
            .Where(f => f is { IsLiteral: true } && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToList();

        Assert.Equal(22, codes.Count);
        Assert.DoesNotContain(codes, c => !seeded.Contains(c));
    }

    [Fact]
    public async Task Tc26_DashboardIncreasesWithNewOrder()
    {
        await _host.SignInAsync("quanly");
        var before = await _host.CallAsync<IReportService, DashboardReport>(s => s.GetDashboardAsync());
        Assert.Equal(12, before.OrderCount);
        Assert.Equal(24, before.Hourly.Count);
        Assert.Equal(5, before.TopItems.Count);

        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.LineAsync("M009", "M", 1, "TP08", "TP01"); // 35.000 + 10.000 + 5.000 = 50.000
        await _pos.CheckoutAsync(PosScenario.Checkout([line], 50_000));

        await _host.SignInAsync("quanly");
        var after = await _host.CallAsync<IReportService, DashboardReport>(s => s.GetDashboardAsync());
        Assert.Equal((before.Revenue + 50_000, before.OrderCount + 1), (after.Revenue, after.OrderCount));
        Assert.Single(after.OpenShifts);
    }

    [Fact]
    public async Task Tc28_Revenue30Days_DailyMatchesTotals_Tc29_CancelledExcluded()
    {
        await _host.SignInAsync("quanly");
        var report = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new ReportRangeQuery()));

        Assert.Equal(30, report.Daily.Count);
        Assert.Equal(("2026-09-15", "2026-10-14"), (report.From, report.To));
        Assert.Equal(report.Totals.Revenue, report.Daily.Sum(d => d.Revenue));
        Assert.Equal(report.Previous.Revenue, report.Daily.Sum(d => d.PreviousRevenue));
        Assert.True(report.Totals.OrderCount > 0);

        // TC-29: bán rồi hủy trong ca → doanh thu không đổi, có trong danh sách hủy.
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();
        var sold = await _pos.CheckoutAsync(PosScenario.Checkout([line], 108_000, cash: 200_000));
        await _host.SignInAsync("quanly");
        await _host.CallAsync<IOrderService, OrderDto>(s => s.CancelAsync(sold.Order.Id, new CancelOrderRequest { Reason = "Nhập nhầm" }));

        var after = await _host.CallAsync<IReportService, RevenueReport>(s => s.GetRevenueAsync(new ReportRangeQuery()));
        Assert.Equal(report.Totals.Revenue, after.Totals.Revenue);

        var cancelled = await _host.CallAsync<IReportService, Application.Common.Models.PaginatedResult<CancelledOrderItem>>(s =>
            s.GetCancelledOrdersAsync(new CancelledOrdersQuery { From = "2026-10-14", To = "2026-10-14" }));
        Assert.Equal((sold.Order.Code, "quanly"), (cancelled.Items[0].Code, cancelled.Items[0].CancelledByName));
    }

    [Fact]
    public async Task Reports_OtherTypes_Shape()
    {
        await _host.SignInAsync("quanly");

        var heatmap = await _host.CallAsync<IReportService, HeatmapReport>(s => s.GetHeatmapAsync(new ReportRangeQuery()));
        Assert.Equal(168, heatmap.Cells.Count);
        Assert.Equal(heatmap.Cells.Max(c => c.Revenue), heatmap.MaxRevenue);

        var methods = await _host.CallAsync<IReportService, PaymentMethodReport>(s => s.GetPaymentMethodsAsync(new ReportRangeQuery()));
        Assert.Equal([PaymentMethod.TienMat, PaymentMethod.ChuyenKhoan], methods.Items.Select(i => i.Method));

        var top = await _host.CallAsync<IReportService, TopItemsReport>(s => s.GetTopItemsAsync(new TopItemsQuery { Limit = 5 }));
        Assert.Equal(5, top.Items.Count);
        Assert.Equal(top.Items.Select(i => i.Quantity).OrderDescending(), top.Items.Select(i => i.Quantity));

        var cashiers = await _host.CallAsync<IReportService, CashierReport>(s => s.GetCashiersAsync(new ReportRangeQuery { From = "2026-07-17", To = "2026-10-14" }));
        Assert.Equal(2, cashiers.Items.Count);
        Assert.Equal(179, cashiers.Items.Sum(c => c.ShiftCount));
        Assert.Equal(2840, cashiers.Items.Sum(c => c.OrderCount));
        Assert.Equal(1, cashiers.Items.Sum(c => c.ShiftsNeedingReview));
    }

    [Fact]
    public void Tc30_RangeOver366Days_IsInvalid()
    {
        var tooLong = new ReportRangeQueryRootValidator().Validate(new ReportRangeQuery { From = "2024-01-01", To = "2026-10-14" });
        Assert.Equal(("From", "Khoảng ngày tối đa 366 ngày"), (tooLong.Errors.Single().PropertyName, tooLong.Errors.Single().ErrorMessage));

        var reversed = new ReportRangeQueryRootValidator().Validate(new ReportRangeQuery { From = "2026-10-14", To = "2026-10-01" });
        Assert.Equal(("To", "Ngày kết thúc phải sau ngày bắt đầu"), (reversed.Errors.Single().PropertyName, reversed.Errors.Single().ErrorMessage));

        Assert.True(new ReportRangeQueryRootValidator().Validate(new ReportRangeQuery { From = "2025-10-14", To = "2026-10-14" }).IsValid);
    }
}
