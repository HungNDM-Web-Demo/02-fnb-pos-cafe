using Domain.Base;
using Domain.Common;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>
/// Hóa đơn và đơn giữ (bảng <c>Pos_Orders</c>, SRS §5.1, §5.2). Hóa đơn không bao giờ xóa, chỉ đổi trạng thái;
/// đơn giữ (<see cref="OrderStatus.DangGiu"/>) xóa cứng khi thu ngân bỏ. Mọi số tiền lấy từ <see cref="PricedCart"/>.
/// </summary>
public class Order : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 20;
    public const int ClientRequestIdMaxLength = 64;
    public const int CashierNameMaxLength = 150;
    public const int HoldNameMaxLength = 50;
    public const int TableTagMaxLength = 10;
    public const int ReasonMaxLength = 200;
    public const int ApproverNameMaxLength = 50;
    public const int PromotionNameMaxLength = 150;
    public const int VoucherCodeMaxLength = 12;
    public const int CustomerPhoneMaxLength = 20;

    private readonly List<OrderItem> _items = [];

    private Order()
    {
    }

    public string? Code { get; private set; }
    public string? ClientRequestId { get; private set; }
    public Guid ShiftId { get; private set; }
    public Guid CashierId { get; private set; }
    public string CashierName { get; private set; } = string.Empty;
    public OrderStatus Status { get; private set; }
    public string? HoldName { get; private set; }
    public ServiceType ServiceType { get; private set; }
    public string? TableTag { get; private set; }
    public decimal Subtotal { get; private set; }
    public decimal LineDiscountTotal { get; private set; }
    public decimal ItemPromotionDiscount { get; private set; }
    public DiscountType? OrderDiscountType { get; private set; }
    public decimal? OrderDiscountValue { get; private set; }
    public decimal OrderDiscountAmount { get; private set; }
    public string? OrderDiscountReason { get; private set; }
    public Guid? DiscountApprovedById { get; private set; }
    public string? DiscountApprovedByName { get; private set; }
    public Guid? PromotionId { get; private set; }
    public string? PromotionName { get; private set; }
    public decimal PromotionDiscount { get; private set; }
    public Guid? VoucherId { get; private set; }
    public string? VoucherCode { get; private set; }
    public decimal VoucherDiscount { get; private set; }
    public decimal DiscountTotal { get; private set; }
    public decimal Total { get; private set; }
    public Guid? CustomerId { get; private set; }
    public string? CustomerPhone { get; private set; }
    public int PointsEarned { get; private set; }
    public DateTime? PaidAt { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public Guid? CancelledById { get; private set; }
    public string? CancelledByName { get; private set; }
    public string? CancelReason { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public IReadOnlyCollection<OrderItem> Items => _items;
    public Payment? Payment { get; private set; }
    public Shift? Shift { get; private set; }
    public Customer? Customer { get; private set; }

    public bool IsHeld => Status == OrderStatus.DangGiu;
    public bool IsPaid => Status == OrderStatus.DaThanhToan;
    public bool IsCancelled => Status == OrderStatus.DaHuy;

    /// <summary>Tạo đơn mới ở trạng thái giữ với nội dung giỏ đã tính tiền; thanh toán thì gọi tiếp <see cref="MarkPaid"/>.</summary>
    public static Order Create(
        Guid shiftId,
        Guid cashierId,
        string cashierName,
        ServiceType serviceType,
        string? tableTag,
        PricedCart cart,
        (Guid Id, string Phone)? customer)
    {
        var order = new Order
        {
            ShiftId = shiftId,
            CashierId = cashierId,
            CashierName = cashierName,
            Status = OrderStatus.DangGiu
        };
        order.ApplyCart(serviceType, tableTag, cart, customer);
        return order;
    }

    /// <summary>Thay nội dung giỏ (đơn giữ cập nhật, hoặc thanh toán từ đơn giữ). Chỉ khi còn ở trạng thái giữ.</summary>
    public void ApplyCart(ServiceType serviceType, string? tableTag, PricedCart cart, (Guid Id, string Phone)? customer)
    {
        if (!IsHeld)
            throw new DomainException("Hóa đơn đã thanh toán, không sửa được");
        if (cart.Lines.Count == 0)
            throw new DomainException("Đơn chưa có món");
        if (serviceType == ServiceType.TaiCho && string.IsNullOrWhiteSpace(tableTag))
            throw new DomainException("Nhập số thẻ bàn");

        ServiceType = serviceType;
        TableTag = serviceType == ServiceType.TaiCho ? tableTag!.Trim() : null;

        _items.Clear();
        for (var i = 0; i < cart.Lines.Count; i++)
            _items.Add(new OrderItem(Id, cart.Lines[i], (i + 1) * 10));

        Subtotal = cart.Subtotal;
        LineDiscountTotal = cart.LineDiscountTotal;
        ItemPromotionDiscount = cart.ItemPromotionDiscount;
        OrderDiscountType = cart.OrderDiscount?.Type;
        OrderDiscountValue = cart.OrderDiscount?.Value;
        OrderDiscountAmount = cart.OrderDiscountAmount;
        OrderDiscountReason = cart.OrderDiscount?.Reason;
        PromotionId = cart.Promotion?.Id;
        PromotionName = cart.Promotion?.Name;
        PromotionDiscount = cart.PromotionDiscount;
        VoucherId = cart.Voucher?.Id;
        VoucherCode = cart.Voucher?.Code;
        VoucherDiscount = cart.VoucherDiscount;
        DiscountTotal = cart.DiscountTotal;
        Total = cart.Total;
        CustomerId = customer?.Id;
        CustomerPhone = customer?.Phone;
        PointsEarned = 0;
    }

    public void SetHoldName(string? holdName) =>
        HoldName = string.IsNullOrWhiteSpace(holdName) ? null : holdName.Trim();

    /// <summary>UC-07: chuyển sang "Đã thanh toán", gán mã BR-09, ghi thanh toán (BR-08), điểm (BR-17), người duyệt giảm giá (FR-15).</summary>
    public void MarkPaid(
        string code,
        string? clientRequestId,
        PaymentMethod method,
        decimal? cashReceived,
        string? qrContent,
        DateTime paidAtUtc,
        (Guid Id, string Name)? discountApprovedBy)
    {
        if (!IsHeld)
            throw new DomainException("Hóa đơn đã thanh toán trước đó");

        Payment = new Payment(Id, method, Total, cashReceived, qrContent, paidAtUtc);
        Code = code;
        ClientRequestId = clientRequestId;
        HoldName = null;
        PaidAt = paidAtUtc;
        PointsEarned = PosRules.PointsFor(Total);
        DiscountApprovedById = discountApprovedBy?.Id;
        DiscountApprovedByName = discountApprovedBy?.Name;
        Status = OrderStatus.DaThanhToan;
    }

    /// <summary>Đổi mã khi hai request cùng lúc sinh trùng mã (06 §3: index unique báo lỗi, service thử lại một lần).</summary>
    public void ReassignCode(string code)
    {
        if (!IsPaid)
            throw new DomainException("Chỉ đổi mã cho hóa đơn đã thanh toán");
        Code = code;
    }

    /// <summary>UC-08: hủy hóa đơn đã thanh toán (BR-13). Điểm giữ nguyên trên hóa đơn để tra cứu; khách bị trừ ở service.</summary>
    public void Cancel(string reason, Guid cancelledById, string cancelledByName, DateTime cancelledAtUtc)
    {
        if (IsCancelled)
            throw new DomainException("Hóa đơn đã hủy trước đó");
        if (!IsPaid)
            throw new DomainException("Chỉ hủy được hóa đơn đã thanh toán");
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainException("Nhập lý do hủy");

        CancelReason = reason.Trim();
        CancelledById = cancelledById;
        CancelledByName = cancelledByName;
        CancelledAt = cancelledAtUtc;
        Status = OrderStatus.DaHuy;
    }
}
