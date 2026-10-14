using Application.DTOs.Orders;
using Domain.Entities.Pos.Orders;

namespace Application.Interfaces.Services.Orders;

/// <summary>
/// Tra giá, kiểm tra món, size, topping, voucher rồi tính tiền giỏ hàng bằng <see cref="OrderPricing"/> (07 §3).
/// Dùng chung cho giữ đơn, thanh toán; seeder dùng bản trong bộ nhớ của Infrastructure.
/// </summary>
public interface IOrderPricingService
{
    /// <summary>
    /// Tính tiền tại thời điểm <paramref name="atUtc"/> (BR-07). Lỗi món, size, topping, voucher ném
    /// <c>ValidationException</c> với key theo 07 §2.5. <paramref name="checkAvailability"/> false thì bỏ qua tạm hết (không dùng cho thanh toán).
    /// </summary>
    Task<PricedCart> PriceAsync(CartInput cart, DateTime atUtc, bool checkAvailability = true, CancellationToken ct = default);
}
