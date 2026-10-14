using Application.Common.Time;
using Application.DTOs.Orders;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Orders;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Enums.Pos.Orders;
using FluentValidation;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Orders;

/// <summary>
/// Tra giá món, size, topping, kiểm tra voucher (BR-06, BR-14) rồi gọi <see cref="OrderPricing"/> (07 §3).
/// Phần tĩnh (<see cref="ResolveLines"/>, <see cref="ActivePromotions"/>, <see cref="RequireValidVoucher"/>) dùng lại cho seeder
/// với thực đơn trong bộ nhớ để hai chỗ ra cùng số.
/// </summary>
public sealed class OrderPricingService(
    IGenericRepository<MenuItem> menuItems,
    IGenericRepository<Topping> toppings,
    IGenericRepository<Promotion> promotions,
    IGenericRepository<Voucher> vouchers) : IOrderPricingService
{
    public const string VoucherField = "voucherCode";

    public async Task<PricedCart> PriceAsync(CartInput cart, DateTime atUtc, bool checkAvailability = true, CancellationToken ct = default)
    {
        var itemIds = cart.Items.Select(i => i.MenuItemId).Distinct().ToList();
        var itemMap = await menuItems.QueryNoTracking()
            .IgnoreQueryFilters()
            .Where(m => itemIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var toppingIds = cart.Items.SelectMany(i => i.ToppingIds).Distinct().ToList();
        var toppingMap = toppingIds.Count == 0
            ? new Dictionary<Guid, Topping>()
            : await toppings.QueryNoTracking().IgnoreQueryFilters().Where(t => toppingIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, ct);

        var lines = ResolveLines(cart.Items, itemMap, toppingMap, checkAvailability);
        var subtotal = lines.Sum(l => (l.SizePrice + l.Toppings.Sum(t => t.Price)) * l.Quantity);

        Voucher? voucher = null;
        if (!string.IsNullOrWhiteSpace(cart.VoucherCode))
        {
            var code = Voucher.NormalizeCode(cart.VoucherCode);
            // Có theo dõi để service thanh toán tăng lượt dùng trên cùng instance.
            var found = await vouchers.Query().FirstOrDefaultAsync(v => v.Code == code, ct);
            voucher = RequireValidVoucher(found, atUtc, subtotal, VoucherField);
        }

        var candidates = await promotions.QueryNoTracking()
            .Where(p => !p.IsPaused && p.StartDate <= atUtc && atUtc <= p.EndDate)
            .OrderBy(p => p.Code)
            .ToListAsync(ct);

        return OrderPricing.Price(lines, ToManual(cart.OrderDiscount), voucher, ActivePromotions(candidates, atUtc));
    }

    /// <summary>Khuyến mãi đang hiệu lực tại <paramref name="atUtc"/> (khung giờ, thứ theo giờ Việt Nam, BR-07).</summary>
    public static List<Promotion> ActivePromotions(IEnumerable<Promotion> candidates, DateTime atUtc)
    {
        var local = VietnamDates.ToVietnam(atUtc);
        return candidates.Where(p => p.IsEffectiveAt(atUtc, local)).OrderBy(p => p.Code, StringComparer.Ordinal).ToList();
    }

    /// <summary>Voucher phải tồn tại và đạt BR-06; không thì ném 400 với câu ở 07 §2.7 gắn vào <paramref name="field"/>.</summary>
    public static Voucher RequireValidVoucher(Voucher? voucher, DateTime atUtc, decimal subtotal, string field)
    {
        if (voucher is null)
            throw FieldErrors.Single(field, "Voucher không tồn tại");

        var reason = voucher.GetRejectReason(atUtc, subtotal);
        return reason is null ? voucher : throw FieldErrors.Single(field, reason);
    }

    public static ManualDiscount? ToManual(ManualDiscountInput? input) =>
        input is null ? null : new ManualDiscount(input.Type, input.Value, input.Reason.Trim());

    /// <summary>
    /// Tra giỏ hàng vào thực đơn: món, size, topping phải tồn tại và còn trong thực đơn; <paramref name="checkAvailability"/>
    /// thì món, topping tạm hết bị từ chối (BR-14). Mức đường, đá thiếu thì điền 100 và Vừa; món không có tùy chọn thì null.
    /// </summary>
    public static List<CartLine> ResolveLines(
        IReadOnlyList<CartLineInput> inputs,
        IReadOnlyDictionary<Guid, MenuItem> items,
        IReadOnlyDictionary<Guid, Topping> toppings,
        bool checkAvailability)
    {
        var lines = new List<CartLine>(inputs.Count);
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var itemField = $"items[{i}].menuItemId";

            if (!items.TryGetValue(input.MenuItemId, out var item) || !item.IsListed)
                throw FieldErrors.Single(itemField, $"Món {item?.Name ?? input.MenuItemId.ToString()} không còn trong thực đơn");
            if (checkAvailability && item.IsSoldOut)
                throw FieldErrors.Single(itemField, $"{item.Name} đang tạm hết");

            var size = item.FindSize(input.SizeName)
                ?? throw FieldErrors.Single(itemField, $"Món {item.Name} không còn trong thực đơn");

            var toppingLines = new List<CartToppingLine>();
            foreach (var toppingId in input.ToppingIds.Distinct())
            {
                if (!toppings.TryGetValue(toppingId, out var topping) || !topping.IsListed || !item.AllowsTopping(toppingId))
                    throw FieldErrors.Single(itemField, $"Món {item.Name} không còn trong thực đơn");
                if (checkAvailability && topping.IsSoldOut)
                    throw FieldErrors.Single($"items[{i}].toppingIds", $"{topping.Name} đang tạm hết");

                toppingLines.Add(new CartToppingLine(topping.Id, topping.Name, topping.Price));
            }

            lines.Add(new CartLine(
                item.Id,
                item.Code,
                item.Name,
                item.CategoryId,
                size.Name,
                size.Price,
                toppingLines,
                item.HasSugarOption ? input.SugarLevel ?? 100 : null,
                item.HasIceOption ? input.IceLevel ?? IceLevel.Vua : null,
                input.Note,
                input.Quantity,
                ToManual(input.Discount)));
        }

        return lines;
    }
}
