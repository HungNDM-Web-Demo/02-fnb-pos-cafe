using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Promotions;

namespace UnitTests.Pos;

/// <summary>Công thức tính tiền 07 §3 (BR-01..BR-05, BR-17) trên <see cref="OrderPricing"/>, không cần DB.</summary>
public class OrderPricingTests
{
    private static readonly Guid TeaCategory = Guid.NewGuid();
    private static readonly Guid MilkTea = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 10, 14, 5, 0, 0, DateTimeKind.Utc);

    /// <summary>"Trà sữa trân châu" size L 42.000 + Trân châu 5.000 + Thạch dừa 7.000.</summary>
    private static CartLine Tc13Line(int quantity = 2, ManualDiscount? discount = null) => new(
        MilkTea, "M009", "Trà sữa trân châu", TeaCategory, "L", 42_000,
        [new CartToppingLine(Guid.NewGuid(), "Trân châu", 5_000), new CartToppingLine(Guid.NewGuid(), "Thạch dừa", 7_000)],
        100, IceLevel.Vua, null, quantity, discount);

    private static Voucher Giam20K() =>
        Voucher.Create("GIAM20K", null, DiscountType.SoTien, 20_000, null, 60_000, 100, Now.AddDays(60));

    private static Promotion Promotion(string code, PromotionScope scope, DiscountType type, decimal value, decimal? max = null, Guid? categoryId = null) =>
        Domain.Entities.Pos.Promotions.Promotion.Create(code, code, null, type, value, max, scope, categoryId, [], 0, null, null, [],
            Now.AddDays(-1), Now.AddDays(1));

    [Fact]
    public void Tc13_LineTotal_SizePlusToppingsTimesQuantity()
    {
        var cart = OrderPricing.Price([Tc13Line()], null, null, []);

        var line = Assert.Single(cart.Lines);
        Assert.Equal(54_000m, line.UnitPrice);
        Assert.Equal(108_000m, line.LineTotal);
        Assert.Equal((108_000m, 108_000m), (cart.Subtotal, cart.Total));
        Assert.Equal(10, cart.PointsEarned);
    }

    [Fact]
    public void Tc14_TwoIdenticalLines_SameAsOneLineQuantityTwo()
    {
        var merged = OrderPricing.Price([Tc13Line(2)], null, null, []);
        var split = OrderPricing.Price([Tc13Line(1), Tc13Line(1)], null, null, []);

        Assert.Equal(merged.Total, split.Total);
    }

    [Fact]
    public void Tc16_TenPercent_RoundedDown_WithinLimit()
    {
        var cart = OrderPricing.Price([Tc13Line()], new ManualDiscount(DiscountType.PhanTram, 10, "Khách quen"), null, []);

        Assert.Equal(10_000m, cart.OrderDiscountAmount);
        Assert.Equal(98_000m, cart.Total);
        Assert.Equal(10_000m, cart.DiscountLimit);
        Assert.False(cart.ExceedsDiscountLimit);
    }

    [Fact]
    public void Tc17_TwentyPercent_ExceedsLimit()
    {
        var cart = OrderPricing.Price([Tc13Line()], new ManualDiscount(DiscountType.PhanTram, 20, "Khách quen"), null, []);

        Assert.Equal(21_000m, cart.OrderDiscountAmount);
        Assert.Equal(87_000m, cart.Total);
        Assert.True(cart.ExceedsDiscountLimit);
    }

    [Fact]
    public void Br04_LineAndOrderDiscountsCountTogether()
    {
        var cart = OrderPricing.Price(
            [Tc13Line(discount: new ManualDiscount(DiscountType.SoTien, 6_000, "Món lỗi"))],
            new ManualDiscount(DiscountType.SoTien, 5_000, "Khách quen"), null, []);

        Assert.Equal((6_000m, 5_000m), (cart.LineDiscountTotal, cart.OrderDiscountAmount));
        Assert.True(cart.ExceedsDiscountLimit);
    }

    [Fact]
    public void Tc19_Voucher_TwentyThousand()
    {
        var cart = OrderPricing.Price([Tc13Line()], null, Giam20K(), []);

        Assert.Equal(20_000m, cart.VoucherDiscount);
        Assert.Equal(88_000m, cart.Total);
        Assert.Equal("GIAM20K", cart.Voucher!.Code);
    }

    [Fact]
    public void Tc20_VoucherRejectReasons_InOrder()
    {
        var expired = Voucher.Create("HETHAN", null, DiscountType.PhanTram, 20, 30_000, 0, 50, Now.AddDays(-10));
        Assert.Equal("Voucher đã hết hạn", expired.GetRejectReason(Now, 108_000));
        Assert.Equal("Đơn tối thiểu 60.000 ₫", Giam20K().GetRejectReason(Now, 42_000));
        Assert.Null(Giam20K().GetRejectReason(Now, 60_000));

        var paused = Voucher.Create("TAMDUNG", null, DiscountType.SoTien, 5_000, null, 0, null, Now.AddDays(-1), isPaused: true);
        Assert.Equal("Voucher đang tạm dừng", paused.GetRejectReason(Now, 0));
    }

    [Fact]
    public void Br05_VoucherAndOrderPromotion_KeepLarger_TieKeepsVoucher()
    {
        var small = Promotion("KM10", PromotionScope.HoaDon, DiscountType.SoTien, 10_000);
        var cart = OrderPricing.Price([Tc13Line()], null, Giam20K(), [small]);
        Assert.Equal((20_000m, 0m, (Promotion?)null), (cart.VoucherDiscount, cart.PromotionDiscount, cart.Promotion));

        var big = Promotion("KM30", PromotionScope.HoaDon, DiscountType.SoTien, 30_000);
        cart = OrderPricing.Price([Tc13Line()], null, Giam20K(), [big]);
        Assert.Equal((0m, 30_000m, (Voucher?)null), (cart.VoucherDiscount, cart.PromotionDiscount, cart.Voucher));

        var tie = Promotion("KM20", PromotionScope.HoaDon, DiscountType.SoTien, 20_000);
        cart = OrderPricing.Price([Tc13Line()], null, Giam20K(), [tie]);
        Assert.Equal((20_000m, 0m), (cart.VoucherDiscount, cart.PromotionDiscount));
    }

    [Fact]
    public void ItemPromotion_StacksWithVoucher_MaxDiscountCutFromLastLine()
    {
        // 15% trà sữa tối đa 10.000: dòng 1 108.000 → 16.200 → 16.000, dòng 2 54.000 → 8.100 → 8.000; cắt 14.000 từ dòng cuối.
        var km01 = Promotion("KM01", PromotionScope.DanhMuc, DiscountType.PhanTram, 15, 10_000, TeaCategory);
        var cart = OrderPricing.Price([Tc13Line(2), Tc13Line(1)], null, Giam20K(), [km01]);

        Assert.Equal(10_000m, cart.ItemPromotionDiscount);
        Assert.Equal(10_000m, cart.Lines[0].PromotionDiscount);
        Assert.Equal(0m, cart.Lines[1].PromotionDiscount);
        Assert.Equal(20_000m, cart.VoucherDiscount);
        Assert.Equal(162_000m - 30_000m, cart.Total);
    }

    [Fact]
    public void Total_NeverBelowZero_AndPercentVoucherCapped()
    {
        var cart = OrderPricing.Price([Tc13Line(1)], new ManualDiscount(DiscountType.SoTien, 60_000, "Khác: tặng"), null, []);
        Assert.Equal(54_000m, cart.OrderDiscountAmount);
        Assert.Equal(0m, cart.Total);

        var tangBan = Voucher.Create("TANGBAN", null, DiscountType.PhanTram, 10, 15_000, 0, 200, Now.AddDays(90));
        Assert.Equal(15_000m, OrderPricing.Price([Tc13Line(3)], null, tangBan, []).VoucherDiscount);
    }

    [Fact]
    public void Br03_RoundDownToThousand()
    {
        Assert.Equal(10_000m, PosRules.RoundDown(10_800));
        Assert.Equal(0m, PosRules.RoundDown(999));
        Assert.Equal("60.000 ₫", PosRules.FormatVnd(60_000));
    }
}
