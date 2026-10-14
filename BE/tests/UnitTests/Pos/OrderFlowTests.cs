using Application.Common.Exceptions;
using Application.DTOs.MenuItems;
using Application.DTOs.Orders;
using Application.DTOs.Shifts;
using Application.DTOs.Vouchers;
using Application.Interfaces.Services.MenuItems;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Shifts;
using Application.Interfaces.Services.Vouchers;
using Application.Validators.Orders;
using Domain.Common;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Enums.Pos.Orders;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Pos;

/// <summary>
/// Bán hàng, giảm giá, thanh toán, hủy qua service thật trên dữ liệu mẫu (05-KICH-BAN-KIEM-THU: TC-07, TC-15..TC-25, TC-05).
/// </summary>
public sealed class OrderFlowTests : IAsyncLifetime
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
    public async Task Tc07_CheckoutWithoutOpenShift_IsRejected()
    {
        await _host.SignInAsync("thungan");
        var line = await _pos.Tc13LineAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(PosScenario.Checkout([line], 108_000)));
        Assert.Equal("Chưa mở ca, mở ca trước khi bán hàng", error.Message);
    }

    [Fact]
    public void Tc15_DineInWithoutTable_IsInvalid()
    {
        var request = PosScenario.Checkout([new CartLineInput { MenuItemId = Guid.NewGuid(), SizeName = "M", Quantity = 1 }], 0) with
        {
            ServiceType = ServiceType.TaiCho
        };

        var result = new CheckoutRequestValidator().Validate(request);
        var failure = Assert.Single(result.Errors);
        Assert.Equal(("TableTag", "Nhập số thẻ bàn"), (failure.PropertyName, failure.ErrorMessage));
    }

    [Fact]
    public async Task Tc16_DiscountWithinLimit_NoApprovalNeeded()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();

        var result = await _pos.CheckoutAsync(PosScenario.Checkout([line], 98_000,
            orderDiscount: new ManualDiscountInput { Type = DiscountType.PhanTram, Value = 10, Reason = "Khách quen" }));

        Assert.Equal((10_000m, 98_000m), (result.Order.OrderDiscount!.Amount, result.Order.Total));
        Assert.Null(result.Order.OrderDiscount.ApprovedByName);
    }

    [Fact]
    public async Task Tc17_Tc18_OverLimitNeedsManagerApproval()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();
        var discount = new ManualDiscountInput { Type = DiscountType.PhanTram, Value = 20, Reason = "Khách quen" };

        // Không có token: 400 kèm hạn mức.
        var noToken = await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(PosScenario.Checkout([line], 87_000, orderDiscount: discount)));
        Assert.Equal("Giảm giá vượt hạn mức 10%, cần quản lý xác nhận", noToken.Message);
        Assert.Equal((10_000m, 21_000m), ((decimal)noToken.Extensions["discountLimit"]!, (decimal)noToken.Extensions["requestedDiscount"]!));

        // TC-18: thu ngân tự xác nhận → 403; sai mật khẩu → 400.
        await Assert.ThrowsAsync<ForbiddenException>(() => _host.CallAsync<IDiscountApprovalService, DiscountApprovalDto>(s =>
            s.ApproveAsync(new DiscountApprovalRequest { Username = "thungan", Password = PosTestHost.DemoPassword })));
        var wrong = await Assert.ThrowsAsync<DomainException>(() => _host.CallAsync<IDiscountApprovalService, DiscountApprovalDto>(s =>
            s.ApproveAsync(new DiscountApprovalRequest { Username = "quanly", Password = "sai-mat-khau" })));
        Assert.Equal("Tên đăng nhập hoặc mật khẩu không đúng", wrong.Message);

        // TC-17: quanly xác nhận → hóa đơn ghi người duyệt.
        var approval = await _host.CallAsync<IDiscountApprovalService, DiscountApprovalDto>(s =>
            s.ApproveAsync(new DiscountApprovalRequest { Username = "quanly", Password = PosTestHost.DemoPassword }));
        Assert.Equal("quanly", approval.ApprovedByName);
        Assert.Equal(PosTestHost.Start.UtcDateTime.AddMinutes(5), approval.ExpiresAt);

        var result = await _pos.CheckoutAsync(PosScenario.Checkout([line], 87_000, orderDiscount: discount, token: approval.Token));
        Assert.Equal((21_000m, 87_000m, "quanly"), (result.Order.OrderDiscount!.Amount, result.Order.Total, result.Order.OrderDiscount.ApprovedByName));

        // Token dùng một lần.
        var reused = await Assert.ThrowsAsync<DomainException>(() =>
            _pos.CheckoutAsync(PosScenario.Checkout([line], 87_000, orderDiscount: discount, token: approval.Token)));
        Assert.Equal("Mã xác nhận của quản lý không hợp lệ, xác nhận lại", reused.Message);
    }

    [Fact]
    public async Task ApprovalToken_ExpiresAfterFiveMinutes()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();
        var approval = await _host.CallAsync<IDiscountApprovalService, DiscountApprovalDto>(s =>
            s.ApproveAsync(new DiscountApprovalRequest { Username = "quanly", Password = PosTestHost.DemoPassword }));

        _host.Time.Advance(TimeSpan.FromMinutes(5) + TimeSpan.FromSeconds(1));
        await Assert.ThrowsAsync<DomainException>(() => _pos.CheckoutAsync(PosScenario.Checkout([line], 87_000,
            orderDiscount: new ManualDiscountInput { Type = DiscountType.PhanTram, Value = 20, Reason = "Khách quen" }, token: approval.Token)));
    }

    [Fact]
    public async Task Tc19_Tc20_VoucherCheck()
    {
        await _host.SignInAsync("thungan");

        var ok = await _host.CallAsync<IVoucherService, VoucherCheckResult>(s => s.CheckAsync(new VoucherCheckRequest { Code = "giam20k", Subtotal = 108_000 }));
        Assert.Equal(("GIAM20K", 20_000m), (ok.Code, ok.EstimatedDiscount));

        var expired = await Assert.ThrowsAsync<ValidationException>(() =>
            _host.CallAsync<IVoucherService, VoucherCheckResult>(s => s.CheckAsync(new VoucherCheckRequest { Code = "HETHAN", Subtotal = 108_000 })));
        Assert.Equal(("code", "Voucher đã hết hạn"), (expired.Errors.Single().PropertyName, expired.Errors.Single().ErrorMessage));

        var minimum = await Assert.ThrowsAsync<ValidationException>(() =>
            _host.CallAsync<IVoucherService, VoucherCheckResult>(s => s.CheckAsync(new VoucherCheckRequest { Code = "GIAM20K", Subtotal = 42_000 })));
        Assert.Equal("Đơn tối thiểu 60.000 ₫", minimum.Errors.Single().ErrorMessage);

        var usedUp = await Assert.ThrowsAsync<ValidationException>(() =>
            _host.CallAsync<IVoucherService, VoucherCheckResult>(s => s.CheckAsync(new VoucherCheckRequest { Code = "HETLUOT", Subtotal = 100_000 })));
        Assert.Equal("Voucher đã hết lượt", usedUp.Errors.Single().ErrorMessage);

        var missing = await Assert.ThrowsAsync<ValidationException>(() =>
            _host.CallAsync<IVoucherService, VoucherCheckResult>(s => s.CheckAsync(new VoucherCheckRequest { Code = "KHONGCO", Subtotal = 100_000 })));
        Assert.Equal("Voucher không tồn tại", missing.Errors.Single().ErrorMessage);

        // Thanh toán với voucher không đủ đơn tối thiểu: lỗi gắn errors.voucherCode.
        await _pos.OpenShiftAsync("thungan");
        var single = await _pos.LineAsync("M009", "L", 1);
        var checkout = await Assert.ThrowsAsync<ValidationException>(() => _pos.CheckoutAsync(PosScenario.Checkout([single], 42_000, voucher: "GIAM20K")));
        Assert.Equal(("voucherCode", "Đơn tối thiểu 60.000 ₫"), (checkout.Errors.Single().PropertyName, checkout.Errors.Single().ErrorMessage));
    }

    [Fact]
    public async Task Tc21_Tc24_Tc25_CashCheckout_Idempotent_ThenCancel()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();
        var customerId = await _host.QueryAsync<Customer, Guid>(q => q.Where(c => c.Phone == "0905111222").Select(c => c.Id).SingleAsync());
        var customerBefore = await _host.QueryAsync<Customer, Customer>(q => q.SingleAsync(c => c.Id == customerId));
        var summaryBefore = await _host.CallAsync<IShiftService, ShiftSummary?>(s => s.GetCurrentSummaryAsync());

        // TC-21: đơn 88.000 sau voucher, khách đưa 100.000 → thối 12.000.
        var request = PosScenario.Checkout([line], 88_000, cash: 100_000, voucher: "GIAM20K", customerId: customerId);
        var first = await _pos.CheckoutAsync(request);
        Assert.True(first.Created);
        Assert.Equal("HD2610140013", first.Order.Code);
        Assert.Equal(OrderStatus.DaThanhToan, first.Order.Status);
        Assert.Equal((88_000m, 100_000m, 12_000m), (first.Order.Payment!.Amount, first.Order.Payment.CashReceived!.Value, first.Order.Payment.ChangeAmount!.Value));
        Assert.Equal(("GIAM20K", 20_000m), (first.Order.Voucher!.Code, first.Order.Voucher.Amount));
        Assert.Equal(8, first.Order.PointsEarned);
        Assert.Equal(41, await VoucherUsedAsync("GIAM20K"));

        // TC-24: bấm lại cùng clientRequestId → cùng hóa đơn, không tạo thêm.
        var count = await _host.QueryAsync<Order, int>(q => q.CountAsync());
        var second = await _pos.CheckoutAsync(request);
        Assert.False(second.Created);
        Assert.Equal(first.Order.Id, second.Order.Id);
        Assert.Equal(count, await _host.QueryAsync<Order, int>(q => q.CountAsync()));
        Assert.Equal(41, await VoucherUsedAsync("GIAM20K"));

        var summaryAfterSale = await _host.CallAsync<IShiftService, ShiftSummary?>(s => s.GetCurrentSummaryAsync());
        Assert.Equal(summaryBefore!.ExpectedCash + 88_000, summaryAfterSale!.ExpectedCash);

        var customer = await _host.QueryAsync<Customer, Customer>(q => q.SingleAsync(c => c.Id == customerId));
        Assert.Equal((customerBefore.Points + 8, customerBefore.OrderCount + 1), (customer.Points, customer.OrderCount));

        // TC-25: quản lý hủy, lý do "Nhập nhầm" → trả lượt voucher, tiền mặt lý thuyết giảm 88.000, trừ điểm.
        await _host.SignInAsync("quanly");
        var cancelled = await _host.CallAsync<IOrderService, OrderDto>(s => s.CancelAsync(first.Order.Id, new CancelOrderRequest { Reason = "Nhập nhầm" }));
        Assert.Equal((OrderStatus.DaHuy, "quanly", "Nhập nhầm"), (cancelled.Status, cancelled.CancelledByName, cancelled.CancelReason));
        Assert.Equal(40, await VoucherUsedAsync("GIAM20K"));

        var again = await Assert.ThrowsAsync<DomainException>(() =>
            _host.CallAsync<IOrderService, OrderDto>(s => s.CancelAsync(first.Order.Id, new CancelOrderRequest { Reason = "Lần hai" })));
        Assert.Equal("Hóa đơn đã hủy trước đó", again.Message);

        customer = await _host.QueryAsync<Customer, Customer>(q => q.SingleAsync(c => c.Id == customerId));
        Assert.Equal((customerBefore.Points, customerBefore.OrderCount), (customer.Points, customer.OrderCount));

        await _host.SignInAsync("thungan");
        var summary = await _host.CallAsync<IShiftService, ShiftSummary?>(s => s.GetCurrentSummaryAsync());
        Assert.Equal(summaryAfterSale.ExpectedCash - 88_000, summary!.ExpectedCash);
        Assert.Equal((1, 88_000m), (summary.CancelledOrderCount, summary.CashCancelled));
    }

    [Fact]
    public async Task Tc25_CancelOrderOfClosedShift_IsRejected()
    {
        await _host.SignInAsync("quanly");
        var oldOrderId = await _host.QueryAsync<Order, Guid>(q => q.Where(o => o.Code == "HD2610140001").Select(o => o.Id).SingleAsync());

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            _host.CallAsync<IOrderService, OrderDto>(s => s.CancelAsync(oldOrderId, new CancelOrderRequest { Reason = "Nhập nhầm" })));
        Assert.Equal("Chỉ hủy được hóa đơn trong ca đang mở", error.Message);
    }

    [Fact]
    public async Task Tc22_CashNotEnough_Tc23_Transfer()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();

        var shortCash = await Assert.ThrowsAsync<ValidationException>(() =>
            _pos.CheckoutAsync(PosScenario.Checkout([line], 88_000, cash: 50_000, voucher: "GIAM20K")));
        Assert.Equal(("payment.cashReceived", "Còn thiếu 38.000 ₫"),
            (shortCash.Errors.Single().PropertyName, shortCash.Errors.Single().ErrorMessage));

        // TC-23: 45.000 ₫ chuyển khoản (Trà sữa M 35.000 + Kem cheese 10.000), lưu chuỗi QR.
        var transferLine = await _pos.LineAsync("M009", "M", 1, "TP08");
        var transfer = await _pos.CheckoutAsync(PosScenario.Checkout([transferLine], 45_000, PaymentMethod.ChuyenKhoan));
        Assert.Equal((PaymentMethod.ChuyenKhoan, 45_000m), (transfer.Order.Payment!.Method, transfer.Order.Total));
        Assert.StartsWith("VIETQR|", transfer.Order.Payment.QrContent);
        Assert.Null(transfer.Order.Payment.ChangeAmount);
    }

    [Fact]
    public async Task ExpectedTotalMismatch_Is409WithServerTotal()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();

        var error = await Assert.ThrowsAsync<ConflictException>(() => _pos.CheckoutAsync(PosScenario.Checkout([line], 100_000)));
        Assert.Equal("Tổng tiền đã thay đổi (khuyến mãi hoặc giá), kiểm tra lại đơn", error.Message);
        Assert.Equal(108_000m, error.Extensions["serverTotal"]);
    }

    [Fact]
    public async Task Br07_ItemPromotionAppliedAtPaymentTime()
    {
        // 14:30 giờ Việt Nam: KM01 trà sữa −15%, tối đa 10.000 → 108.000 − 10.000.
        _host.Time.Advance(TimeSpan.FromHours(2.5));
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.Tc13LineAsync();

        var result = await _pos.CheckoutAsync(PosScenario.Checkout([line], 98_000));
        Assert.Equal((10_000m, 98_000m), (result.Order.ItemPromotionDiscount, result.Order.Total));
        Assert.Equal("Giờ vàng trà sữa −15%", result.Order.Items[0].Promotion!.Name);
    }

    [Fact]
    public async Task Tc04_Tc05_SoldOutTopping_HeldOrderFlaggedAndBlocked()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.LineAsync("M005", "M", 1);
        var held = await _host.CallAsync<IOrderService, HeldOrderDto>(s => s.HoldAsync(new HoldOrderRequest { Items = [line] }));
        Assert.Equal(("Đơn 1", false, 27_000m), (held.HoldName, held.HasUnavailableItems, held.Total));

        // TC-05: báo "Bạc xỉu" tạm hết → đơn giữ đánh dấu, thanh toán bị chặn.
        await _host.CallAsync<IMenuItemService>(s => s.SetAvailabilityAsync(line.MenuItemId, new SetAvailabilityRequest { IsSoldOut = true }));
        var list = await _host.CallAsync<IOrderService, IReadOnlyList<HeldOrderDto>>(s => s.GetHeldAsync());
        Assert.True(Assert.Single(list).HasUnavailableItems);
        Assert.True(list[0].Items[0].Unavailable);

        var error = await Assert.ThrowsAsync<ValidationException>(() =>
            _pos.CheckoutAsync(PosScenario.Checkout([line], 27_000, heldOrderId: held.Id)));
        Assert.Equal(("items[0].menuItemId", "Bạc xỉu đang tạm hết"), (error.Errors.Single().PropertyName, error.Errors.Single().ErrorMessage));

        // Bán lại rồi thanh toán từ đơn giữ: chính bản ghi đó được gán mã.
        await _host.CallAsync<IMenuItemService>(s => s.SetAvailabilityAsync(line.MenuItemId, new SetAvailabilityRequest { IsSoldOut = false }));
        var paid = await _pos.CheckoutAsync(PosScenario.Checkout([line], 27_000, heldOrderId: held.Id));
        Assert.Equal(held.Id, paid.Order.Id);
        Assert.NotNull(paid.Order.Code);
        Assert.Empty(await _host.CallAsync<IOrderService, IReadOnlyList<HeldOrderDto>>(s => s.GetHeldAsync()));
    }

    [Fact]
    public async Task Br15_AtMostTenHeldOrders()
    {
        await _pos.OpenShiftAsync("thungan");
        var line = await _pos.LineAsync("M001", "M", 1);
        for (var i = 0; i < 10; i++)
            await _host.CallAsync<IOrderService, HeldOrderDto>(s => s.HoldAsync(new HoldOrderRequest { Items = [line] }));

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            _host.CallAsync<IOrderService, HeldOrderDto>(s => s.HoldAsync(new HoldOrderRequest { Items = [line] })));
        Assert.Equal("Tối đa 10 đơn giữ, thanh toán hoặc xóa bớt", error.Message);
    }

    [Fact]
    public async Task OrdersList_CashierSeesOnlyOwnOrders()
    {
        await _host.SignInAsync("thungan2");
        var page = await _host.CallAsync<IOrderService, Application.Common.Models.PaginatedResult<OrderListItem>>(s =>
            s.GetPagedAsync(new OrderQuery { PageSize = 100 }));
        Assert.All(page.Items, o => Assert.Equal("Võ Minh Tuấn", o.CashierName));

        var otherId = await _host.QueryAsync<Order, Guid>(q => q.Where(o => o.CashierName != "Võ Minh Tuấn").Select(o => o.Id).FirstAsync());
        await Assert.ThrowsAsync<ForbiddenException>(() => _host.CallAsync<IOrderService, OrderDto>(s => s.GetByIdAsync(otherId)));

        await _host.SignInAsync("quanly");
        var all = await _host.CallAsync<IOrderService, Application.Common.Models.PaginatedResult<OrderListItem>>(s => s.GetPagedAsync(new OrderQuery()));
        Assert.Equal(3019, all.TotalCount);
    }

    private Task<int> VoucherUsedAsync(string code) =>
        _host.QueryAsync<Voucher, int>(q => q.Where(v => v.Code == code).Select(v => v.UsedCount).SingleAsync());
}
