using Domain.Entities.Pos.Promotions;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Promotions;

namespace Domain.Entities.Pos.Orders;

/// <summary>Topping của một dòng giỏ hàng với giá tại thời điểm tính.</summary>
public sealed record CartToppingLine(Guid ToppingId, string Name, decimal Price);

/// <summary>Giảm giá thủ công (dòng hoặc hóa đơn): kiểu, giá trị nhập, lý do.</summary>
public sealed record ManualDiscount(DiscountType Type, decimal Value, string Reason);

/// <summary>Một dòng giỏ hàng đã tra giá size, topping (đầu vào của <see cref="OrderPricing"/>).</summary>
public sealed record CartLine(
    Guid MenuItemId,
    string ItemCode,
    string ItemName,
    Guid CategoryId,
    string SizeName,
    decimal SizePrice,
    IReadOnlyList<CartToppingLine> Toppings,
    int? SugarLevel,
    IceLevel? IceLevel,
    string? Note,
    int Quantity,
    ManualDiscount? Discount);

/// <summary>Dòng đã tính tiền theo 07 §3 bước 1–3.</summary>
public sealed record PricedLine(
    CartLine Line,
    decimal UnitPrice,
    decimal LineTotal,
    decimal DiscountAmount,
    Promotion? Promotion,
    decimal PromotionDiscount)
{
    public decimal LineNet => LineTotal - DiscountAmount - PromotionDiscount;
}

/// <summary>Kết quả tính tiền một giỏ hàng (07 §3). Số tổng BE trả là chính thức.</summary>
public sealed record PricedCart(
    IReadOnlyList<PricedLine> Lines,
    decimal Subtotal,
    decimal LineDiscountTotal,
    decimal ItemPromotionDiscount,
    ManualDiscount? OrderDiscount,
    decimal OrderDiscountAmount,
    decimal DiscountLimit,
    Voucher? Voucher,
    decimal VoucherDiscount,
    Promotion? Promotion,
    decimal PromotionDiscount,
    decimal DiscountTotal,
    decimal Total)
{
    /// <summary>BR-04: tổng giảm thủ công (dòng + hóa đơn) vượt hạn mức thu ngân.</summary>
    public bool ExceedsDiscountLimit => LineDiscountTotal + OrderDiscountAmount > DiscountLimit;

    public decimal ManualDiscountTotal => LineDiscountTotal + OrderDiscountAmount;

    /// <summary>BR-17.</summary>
    public int PointsEarned => PosRules.PointsFor(Total);
}

/// <summary>
/// Công thức tính tiền (07 §3, BR-01..BR-05, BR-17), thuần, không đọc DB. Dùng chung cho thanh toán, giữ đơn, kiểm tra voucher
/// và seeder; FE <c>features/pos/lib/pricing.ts</c> cho cùng số với cùng đầu vào.
/// </summary>
public static class OrderPricing
{
    /// <param name="lines">Dòng giỏ hàng đã tra giá.</param>
    /// <param name="orderDiscount">Giảm giá hóa đơn thủ công.</param>
    /// <param name="voucher">Voucher đã kiểm tra hợp lệ (BR-06); null nếu không dùng.</param>
    /// <param name="activePromotions">Khuyến mãi đang hiệu lực tại thời điểm thanh toán (BR-07).</param>
    public static PricedCart Price(
        IReadOnlyList<CartLine> lines,
        ManualDiscount? orderDiscount,
        Voucher? voucher,
        IReadOnlyList<Promotion> activePromotions)
    {
        // 1–2. Dòng và giảm giá dòng thủ công.
        var unitPrices = new decimal[lines.Count];
        var lineTotals = new decimal[lines.Count];
        var lineDiscounts = new decimal[lines.Count];
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            unitPrices[i] = line.SizePrice + line.Toppings.Sum(t => t.Price);
            lineTotals[i] = unitPrices[i] * line.Quantity;
            lineDiscounts[i] = line.Discount is { } d ? ManualAmount(d, lineTotals[i]) : 0;
        }

        // 3. Khuyến mãi cấp món: mỗi khuyến mãi tính trên các dòng thuộc phạm vi, cắt theo maxDiscount từ dòng cuối,
        //    rồi mỗi dòng giữ mức giảm lớn nhất.
        var itemPromotion = new (Promotion? Promotion, decimal Amount)[lines.Count];
        foreach (var promotion in activePromotions.Where(p => p.Scope != PromotionScope.HoaDon))
        {
            var amounts = new decimal[lines.Count];
            for (var i = 0; i < lines.Count; i++)
            {
                var line = lines[i];
                if (!promotion.CoversItem(line.MenuItemId, line.CategoryId))
                    continue;

                var baseAmount = lineTotals[i] - lineDiscounts[i];
                amounts[i] = promotion.DiscountType == DiscountType.PhanTram
                    ? PosRules.RoundDown(baseAmount * promotion.DiscountValue / 100)
                    : Math.Min(promotion.DiscountValue * line.Quantity, baseAmount);
            }

            if (promotion.MaxDiscount is { } max)
            {
                var excess = amounts.Sum() - max;
                for (var i = lines.Count - 1; i >= 0 && excess > 0; i--)
                {
                    var cut = Math.Min(excess, amounts[i]);
                    amounts[i] -= cut;
                    excess -= cut;
                }
            }

            for (var i = 0; i < lines.Count; i++)
            {
                if (amounts[i] > itemPromotion[i].Amount)
                    itemPromotion[i] = (promotion, amounts[i]);
            }
        }

        var priced = new List<PricedLine>(lines.Count);
        for (var i = 0; i < lines.Count; i++)
            priced.Add(new PricedLine(lines[i], unitPrices[i], lineTotals[i], lineDiscounts[i], itemPromotion[i].Promotion, itemPromotion[i].Amount));

        // 4. Tổng tiền hàng.
        var subtotal = lineTotals.Sum();
        var lineDiscountTotal = lineDiscounts.Sum();
        var itemPromotionDiscount = itemPromotion.Sum(p => p.Amount);
        var remaining = subtotal - lineDiscountTotal - itemPromotionDiscount;

        // 5–6. Giảm giá hóa đơn thủ công và hạn mức thu ngân.
        var orderDiscountAmount = orderDiscount is { } od ? ManualAmount(od, remaining) : 0;
        remaining -= orderDiscountAmount;
        var limit = PosRules.RoundDown(subtotal * PosRules.CashierDiscountLimitPercent / 100);

        // 7. Voucher (đã kiểm tra hợp lệ trước khi gọi).
        var voucherAmount = voucher is null ? 0 : OrderLevelAmount(voucher.DiscountType, voucher.DiscountValue, voucher.MaxDiscount, remaining);

        // 8. Khuyến mãi cấp hóa đơn: chọn lớn nhất.
        Promotion? bestPromotion = null;
        decimal promotionAmount = 0;
        foreach (var promotion in activePromotions.Where(p => p.Scope == PromotionScope.HoaDon && subtotal >= p.MinOrderAmount))
        {
            var amount = OrderLevelAmount(promotion.DiscountType, promotion.DiscountValue, promotion.MaxDiscount, remaining);
            if (amount > promotionAmount)
            {
                promotionAmount = amount;
                bestPromotion = promotion;
            }
        }

        // 9. BR-05: không cộng dồn; bằng nhau thì giữ voucher. Mức bị bỏ không ghi vào hóa đơn.
        Voucher? appliedVoucher = voucher;
        if (voucher is not null && voucherAmount >= promotionAmount)
        {
            bestPromotion = null;
            promotionAmount = 0;
        }
        else
        {
            appliedVoucher = null;
            voucherAmount = 0;
        }

        // 10. Tổng thanh toán (BR-02).
        var discountTotal = lineDiscountTotal + itemPromotionDiscount + orderDiscountAmount + voucherAmount + promotionAmount;
        var total = Math.Max(0, subtotal - discountTotal);

        return new PricedCart(
            priced,
            subtotal,
            lineDiscountTotal,
            itemPromotionDiscount,
            orderDiscount,
            orderDiscountAmount,
            limit,
            appliedVoucher,
            voucherAmount,
            bestPromotion,
            promotionAmount,
            discountTotal,
            total);
    }

    /// <summary>Giảm thủ công trên một số tiền gốc: phần trăm làm tròn xuống (BR-03), số tiền không vượt gốc.</summary>
    public static decimal ManualAmount(ManualDiscount discount, decimal baseAmount) =>
        discount.Type == DiscountType.PhanTram
            ? PosRules.RoundDown(baseAmount * discount.Value / 100)
            : Math.Min(discount.Value, Math.Max(0, baseAmount));

    /// <summary>Mức giảm cấp hóa đơn của voucher hoặc khuyến mãi trên <paramref name="remaining"/> (07 §3 bước 7–8).</summary>
    public static decimal OrderLevelAmount(DiscountType type, decimal value, decimal? maxDiscount, decimal remaining)
    {
        if (remaining <= 0)
            return 0;

        if (type == DiscountType.PhanTram)
        {
            var amount = PosRules.RoundDown(remaining * value / 100);
            return maxDiscount is { } max ? Math.Min(amount, max) : amount;
        }

        return Math.Min(value, remaining);
    }
}
