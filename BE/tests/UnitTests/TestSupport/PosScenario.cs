using Application.DTOs.Orders;
using Application.DTOs.Shifts;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Shifts;
using Domain.Entities.Pos.MenuItems;
using Domain.Enums.Pos.Orders;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.TestSupport;

/// <summary>Thao tác bán hàng dùng lại trong test: tra Id theo mã, mở ca, thanh toán theo giỏ.</summary>
public sealed class PosScenario(PosTestHost host)
{
    public PosTestHost Host => host;

    public Task<Guid> ItemIdAsync(string code) =>
        host.QueryAsync<MenuItem, Guid>(q => q.Where(m => m.Code == code).Select(m => m.Id).SingleAsync());

    public Task<Guid> ToppingIdAsync(string code) =>
        host.QueryAsync<Topping, Guid>(q => q.Where(t => t.Code == code).Select(t => t.Id).SingleAsync());

    public async Task<CartLineInput> LineAsync(string itemCode, string size, int quantity, params string[] toppings)
    {
        var toppingIds = new List<Guid>();
        foreach (var code in toppings)
            toppingIds.Add(await ToppingIdAsync(code));
        return new CartLineInput { MenuItemId = await ItemIdAsync(itemCode), SizeName = size, Quantity = quantity, ToppingIds = toppingIds };
    }

    /// <summary>TC-13: "Trà sữa trân châu" L + Trân châu + Thạch dừa × 2 = 108.000 ₫.</summary>
    public Task<CartLineInput> Tc13LineAsync() => LineAsync("M009", "L", 2, "TP01", "TP04");

    public async Task<ShiftDto> OpenShiftAsync(string username, decimal openingCash = 1_000_000)
    {
        await host.SignInAsync(username);
        var (shift, _) = await host.CallAsync<IShiftService, (ShiftDto, bool)>(s => s.OpenAsync(new OpenShiftRequest { OpeningCash = openingCash }));
        return shift;
    }

    public static CheckoutRequest Checkout(
        IReadOnlyList<CartLineInput> lines,
        decimal expectedTotal,
        PaymentMethod method = PaymentMethod.TienMat,
        decimal? cash = null,
        string? voucher = null,
        ManualDiscountInput? orderDiscount = null,
        string? token = null,
        string? clientRequestId = null,
        Guid? customerId = null,
        Guid? heldOrderId = null) => new()
    {
        ServiceType = ServiceType.MangDi,
        Items = lines,
        VoucherCode = voucher,
        OrderDiscount = orderDiscount,
        CustomerId = customerId,
        ClientRequestId = clientRequestId ?? Guid.NewGuid().ToString(),
        HeldOrderId = heldOrderId,
        Payment = new PaymentInput
        {
            Method = method,
            CashReceived = method == PaymentMethod.TienMat ? cash ?? expectedTotal : null,
            QrContent = method == PaymentMethod.ChuyenKhoan ? $"VIETQR|970415|0000000000|{expectedTotal:0}|HD" : null
        },
        DiscountApprovalToken = token,
        ExpectedTotal = expectedTotal
    };

    public Task<CheckoutResult> CheckoutAsync(CheckoutRequest request) =>
        host.CallAsync<IOrderService, CheckoutResult>(s => s.CheckoutAsync(request));
}
