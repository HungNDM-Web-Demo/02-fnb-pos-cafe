using Application.DTOs.Orders;
using Application.DTOs.Reports;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Orders;

namespace Application.Mappings.Orders;

/// <summary>Ánh xạ viết tay cho hóa đơn. Cần <c>Include(Items).ThenInclude(Toppings)</c>, <c>Include(Payment)</c>, <c>Include(Shift)</c>, <c>Include(Customer)</c>.</summary>
public static class OrderMappings
{
    public static OrderItemDto ToDto(this OrderItem item, bool unavailable = false) => new()
    {
        Id = item.Id,
        MenuItemId = item.MenuItemId,
        ItemCode = item.ItemCode,
        ItemName = item.ItemName,
        CategoryId = item.CategoryId,
        SizeName = item.SizeName,
        SizePrice = item.SizePrice,
        Toppings = item.Toppings.Select(t => new OrderItemToppingDto { ToppingId = t.ToppingId, Name = t.ToppingName, Price = t.Price }).ToList(),
        SugarLevel = item.SugarLevel,
        IceLevel = item.IceLevel,
        Note = item.Note,
        Quantity = item.Quantity,
        UnitPrice = item.UnitPrice,
        LineTotal = item.LineTotal,
        Discount = item.DiscountType is { } type
            ? new OrderItemDiscountDto { Type = type, Value = item.DiscountValue ?? 0, Amount = item.DiscountAmount, Reason = item.DiscountReason ?? string.Empty }
            : null,
        Promotion = item.PromotionId is { } promotionId
            ? new OrderPromotionDto { PromotionId = promotionId, Name = item.PromotionName ?? string.Empty, Amount = item.PromotionDiscount }
            : null,
        LineNet = item.LineNet,
        Unavailable = unavailable
    };

    /// <remarks><c>unavailable</c>: Dòng không còn bán được (đơn giữ, BR-14); null với hóa đơn đã thanh toán.</remarks>
    public static OrderDto ToDto(this Order order, Func<OrderItem, bool>? unavailable = null) =>
        Fill(new OrderDto(), order, unavailable);

    public static HeldOrderDto ToHeldDto(this Order order, Func<OrderItem, bool> unavailable)
    {
        var dto = Fill(new HeldOrderDto { HoldName = order.HoldName ?? string.Empty }, order, unavailable);
        return dto with { HasUnavailableItems = dto.Items.Any(i => i.Unavailable) };
    }

    private static T Fill<T>(T dto, Order order, Func<OrderItem, bool>? unavailable)
        where T : OrderDto => dto with
    {
        Id = order.Id,
        Code = order.Code,
        Status = order.Status,
        ShiftId = order.ShiftId,
        ShiftCode = order.Shift?.Code ?? string.Empty,
        CashierId = order.CashierId,
        CashierName = order.CashierName,
        ServiceType = order.ServiceType,
        TableTag = order.TableTag,
        Items = order.Items.OrderBy(i => i.SortOrder).Select(i => i.ToDto(unavailable?.Invoke(i) ?? false)).ToList(),
        Subtotal = order.Subtotal,
        LineDiscountTotal = order.LineDiscountTotal,
        ItemPromotionDiscount = order.ItemPromotionDiscount,
        OrderDiscount = order.OrderDiscountType is { } type
            ? new OrderDiscountDto
            {
                Type = type,
                Value = order.OrderDiscountValue ?? 0,
                Amount = order.OrderDiscountAmount,
                Reason = order.OrderDiscountReason ?? string.Empty,
                ApprovedByName = order.DiscountApprovedByName
            }
            : null,
        Promotion = order.PromotionId is { } promotionId
            ? new OrderPromotionDto { PromotionId = promotionId, Name = order.PromotionName ?? string.Empty, Amount = order.PromotionDiscount }
            : null,
        Voucher = order.VoucherId is { } voucherId
            ? new OrderVoucherDto { VoucherId = voucherId, Code = order.VoucherCode ?? string.Empty, Amount = order.VoucherDiscount }
            : null,
        DiscountTotal = order.DiscountTotal,
        Total = order.Total,
        Customer = order.CustomerId is { } customerId
            ? new OrderCustomerDto { Id = customerId, Phone = order.Customer?.Phone ?? order.CustomerPhone ?? string.Empty, Name = order.Customer?.Name ?? string.Empty }
            : null,
        PointsEarned = order.PointsEarned,
        Payment = order.Payment is { } payment
            ? new OrderPaymentDto
            {
                Method = payment.Method,
                Amount = payment.Amount,
                CashReceived = payment.CashReceived,
                ChangeAmount = payment.ChangeAmount,
                QrContent = payment.QrContent
            }
            : null,
        PaidAt = order.PaidAt,
        CancelledAt = order.CancelledAt,
        CancelledByName = order.CancelledByName,
        CancelReason = order.CancelReason,
        CreatedAt = order.CreatedAt
    };

    /// <summary>Dòng danh sách hóa đơn; cần <c>Include(Items)</c>, <c>Include(Payment)</c>.</summary>
    public static OrderListItem ToListItem(this Order order) => new()
    {
        Id = order.Id,
        Code = order.Code ?? string.Empty,
        Status = order.Status,
        PaidAt = order.PaidAt ?? order.CreatedAt,
        CashierName = order.CashierName,
        ServiceType = order.ServiceType,
        TableTag = order.TableTag,
        ItemCount = order.Items.Sum(i => i.Quantity),
        Total = order.Total,
        DiscountTotal = order.DiscountTotal,
        PaymentMethod = order.Payment?.Method ?? PaymentMethod.TienMat,
        VoucherCode = order.VoucherCode,
        CancelReason = order.CancelReason
    };

    public static CancelledOrderItem ToCancelledItem(this Order order) => new()
    {
        Id = order.Id,
        Code = order.Code ?? string.Empty,
        PaidAt = order.PaidAt ?? order.CreatedAt,
        CancelledAt = order.CancelledAt ?? order.CreatedAt,
        CashierName = order.CashierName,
        CancelledByName = order.CancelledByName ?? string.Empty,
        CancelReason = order.CancelReason ?? string.Empty,
        Total = order.Total,
        PaymentMethod = order.Payment?.Method ?? PaymentMethod.TienMat
    };
}
