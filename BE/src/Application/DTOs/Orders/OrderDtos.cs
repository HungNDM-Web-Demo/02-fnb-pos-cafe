using Application.Common.Models;
using Domain.Enums.Pos.Orders;

namespace Application.DTOs.Orders;

// DTO bán hàng, hóa đơn /api/orders (07 §2.5). Giỏ hàng gửi lên dùng chung cho giữ đơn và thanh toán.

public sealed record ManualDiscountInput
{
    public DiscountType Type { get; init; }
    public decimal Value { get; init; }
    public string Reason { get; init; } = string.Empty;
}

public sealed record CartLineInput
{
    public Guid MenuItemId { get; init; }

    /// <summary>Phải là size hiện có của món.</summary>
    public string SizeName { get; init; } = string.Empty;

    /// <summary>1–99.</summary>
    public int Quantity { get; init; }

    /// <summary>Phải nằm trong toppingIds của món, chưa ẩn, chưa tạm hết.</summary>
    public IReadOnlyList<Guid> ToppingIds { get; init; } = [];

    /// <summary>0, 30, 50, 70, 100; bắt buộc khi món có tùy chọn đường.</summary>
    public int? SugarLevel { get; init; }

    /// <summary>Bắt buộc khi món có tùy chọn đá.</summary>
    public IceLevel? IceLevel { get; init; }

    public string? Note { get; init; }

    /// <summary>Giảm giá dòng (FR-12).</summary>
    public ManualDiscountInput? Discount { get; init; }
}

public record CartInput
{
    public ServiceType ServiceType { get; init; }

    /// <summary>Bắt buộc khi TaiCho (TC-15).</summary>
    public string? TableTag { get; init; }

    public IReadOnlyList<CartLineInput> Items { get; init; } = [];

    /// <summary>Giảm giá hóa đơn thủ công.</summary>
    public ManualDiscountInput? OrderDiscount { get; init; }

    public string? VoucherCode { get; init; }
    public Guid? CustomerId { get; init; }
}

/// <summary>Giữ đơn (UC-05); <c>holdName</c> mặc định "Đơn N".</summary>
public sealed record HoldOrderRequest : CartInput
{
    public string? HoldName { get; init; }
}

public sealed record PaymentInput
{
    public PaymentMethod Method { get; init; }

    /// <summary>Bắt buộc khi TienMat, ≥ total (BR-08, TC-22).</summary>
    public decimal? CashReceived { get; init; }

    /// <summary>Chuỗi QR đã hiển thị, lưu để in lại.</summary>
    public string? QrContent { get; init; }
}

/// <summary>Thanh toán (UC-07).</summary>
public sealed record CheckoutRequest : CartInput
{
    /// <summary>UUID FE sinh khi mở hộp thanh toán; giữ nguyên khi bấm lại (TC-24).</summary>
    public string ClientRequestId { get; init; } = string.Empty;

    /// <summary>Thanh toán từ đơn giữ: cập nhật chính bản ghi đó.</summary>
    public Guid? HeldOrderId { get; init; }

    public PaymentInput Payment { get; init; } = new();

    /// <summary>Từ <c>POST /api/orders/discount-approvals</c> khi vượt hạn mức.</summary>
    public string? DiscountApprovalToken { get; init; }

    /// <summary>Tổng FE đã hiển thị; khác tổng BE tính → 409.</summary>
    public decimal ExpectedTotal { get; init; }
}

public sealed record OrderItemToppingDto
{
    public Guid ToppingId { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
}

public sealed record OrderItemDiscountDto
{
    public DiscountType Type { get; init; }
    public decimal Value { get; init; }
    public decimal Amount { get; init; }
    public string Reason { get; init; } = string.Empty;
}

public sealed record OrderPromotionDto
{
    public Guid PromotionId { get; init; }
    public string Name { get; init; } = string.Empty;
    public decimal Amount { get; init; }
}

public sealed record OrderItemDto
{
    public Guid Id { get; init; }
    public Guid MenuItemId { get; init; }
    public string ItemCode { get; init; } = string.Empty;
    public string ItemName { get; init; } = string.Empty;
    public Guid CategoryId { get; init; }
    public string SizeName { get; init; } = string.Empty;
    public decimal SizePrice { get; init; }
    public IReadOnlyList<OrderItemToppingDto> Toppings { get; init; } = [];
    public int? SugarLevel { get; init; }
    public IceLevel? IceLevel { get; init; }
    public string? Note { get; init; }
    public int Quantity { get; init; }

    /// <summary>sizePrice + Σ topping.</summary>
    public decimal UnitPrice { get; init; }

    /// <summary>unitPrice × quantity (BR-01).</summary>
    public decimal LineTotal { get; init; }

    public OrderItemDiscountDto? Discount { get; init; }

    /// <summary>Khuyến mãi cấp món.</summary>
    public OrderPromotionDto? Promotion { get; init; }

    /// <summary>lineTotal − discount.amount − promotion.amount.</summary>
    public decimal LineNet { get; init; }

    /// <summary>Chỉ có ý nghĩa ở đơn giữ: món hoặc topping đã tạm hết, ẩn (BR-14, TC-05).</summary>
    public bool Unavailable { get; init; }
}

public sealed record OrderDiscountDto
{
    public DiscountType Type { get; init; }
    public decimal Value { get; init; }
    public decimal Amount { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string? ApprovedByName { get; init; }
}

public sealed record OrderVoucherDto
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = string.Empty;
    public decimal Amount { get; init; }
}

public sealed record OrderCustomerDto
{
    public Guid Id { get; init; }
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}

public sealed record OrderPaymentDto
{
    public PaymentMethod Method { get; init; }
    public decimal Amount { get; init; }
    public decimal? CashReceived { get; init; }
    public decimal? ChangeAmount { get; init; }
    public string? QrContent { get; init; }
}

public record OrderDto : IHasGuidId
{
    public Guid Id { get; init; }

    /// <summary>Null khi DangGiu.</summary>
    public string? Code { get; init; }

    public OrderStatus Status { get; init; }
    public Guid ShiftId { get; init; }
    public string ShiftCode { get; init; } = string.Empty;
    public Guid CashierId { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public ServiceType ServiceType { get; init; }
    public string? TableTag { get; init; }
    public IReadOnlyList<OrderItemDto> Items { get; init; } = [];

    /// <summary>Σ lineTotal.</summary>
    public decimal Subtotal { get; init; }

    public decimal LineDiscountTotal { get; init; }
    public decimal ItemPromotionDiscount { get; init; }
    public OrderDiscountDto? OrderDiscount { get; init; }

    /// <summary>Khuyến mãi cấp hóa đơn.</summary>
    public OrderPromotionDto? Promotion { get; init; }

    public OrderVoucherDto? Voucher { get; init; }
    public decimal DiscountTotal { get; init; }

    /// <summary>BR-02.</summary>
    public decimal Total { get; init; }

    public OrderCustomerDto? Customer { get; init; }

    /// <summary>BR-17.</summary>
    public int PointsEarned { get; init; }

    public OrderPaymentDto? Payment { get; init; }
    public DateTime? PaidAt { get; init; }
    public DateTime? CancelledAt { get; init; }
    public string? CancelledByName { get; init; }
    public string? CancelReason { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record HeldOrderDto : OrderDto
{
    public string HoldName { get; init; } = string.Empty;

    /// <summary>Có dòng unavailable → FE cảnh báo và khóa Thanh toán (TC-05).</summary>
    public bool HasUnavailableItems { get; init; }
}

public sealed record OrderListItem : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public OrderStatus Status { get; init; }
    public DateTime PaidAt { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public ServiceType ServiceType { get; init; }
    public string? TableTag { get; init; }

    /// <summary>Σ quantity.</summary>
    public int ItemCount { get; init; }

    public decimal Total { get; init; }
    public decimal DiscountTotal { get; init; }
    public PaymentMethod PaymentMethod { get; init; }
    public string? VoucherCode { get; init; }
    public string? CancelReason { get; init; }
}

/// <summary>Bộ lọc tra cứu hóa đơn (FR-19). <c>from</c>, <c>to</c> dạng yyyy-MM-dd giờ Việt Nam theo paidAt.</summary>
public sealed class OrderQuery : PaginationQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public OrderStatus? Status { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public Guid? ShiftId { get; set; }

    /// <summary>Bị bỏ qua với người không có <c>orders.view-all</c>.</summary>
    public Guid? CashierId { get; set; }
}

public sealed record CancelOrderRequest
{
    /// <summary>Bắt buộc, tối đa 200 ký tự.</summary>
    public string Reason { get; init; } = string.Empty;
}

/// <summary>Mã hóa đơn dự kiến cho nội dung QR (UC-07 2a).</summary>
public sealed record NextCodeResult
{
    public string Code { get; init; } = string.Empty;
}

/// <summary>Kết quả thanh toán: <c>Created</c> false khi cùng clientRequestId đã có hóa đơn (trả 200, TC-24).</summary>
public sealed record CheckoutResult(OrderDto Order, bool Created);

public sealed record DiscountApprovalRequest
{
    public string Username { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}

public sealed record DiscountApprovalDto
{
    /// <summary>Chuỗi ngẫu nhiên, BE giữ trong bộ nhớ 5 phút, dùng một lần.</summary>
    public string Token { get; init; } = string.Empty;

    public Guid ApprovedById { get; init; }

    /// <summary>Tên đăng nhập, ghi vào hóa đơn (TC-17 "quanly").</summary>
    public string ApprovedByName { get; init; } = string.Empty;

    public DateTime ExpiresAt { get; init; }
}
