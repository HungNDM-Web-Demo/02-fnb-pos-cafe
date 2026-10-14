using Domain.Base;
using Domain.Enums.Pos.Orders;

namespace Domain.Entities.Pos.Orders;

/// <summary>Dòng hóa đơn, chụp tên, giá tại thời điểm bán (bảng <c>Pos_OrderItems</c>, SRS §5.1).</summary>
public class OrderItem : BaseEntity
{
    public const int ItemCodeMaxLength = 20;
    public const int ItemNameMaxLength = 150;
    public const int SizeNameMaxLength = 20;
    public const int NoteMaxLength = 200;
    public const int DiscountReasonMaxLength = 200;

    private readonly List<OrderItemTopping> _toppings = [];

    private OrderItem()
    {
    }

    internal OrderItem(Guid orderId, PricedLine priced, int sortOrder)
    {
        var line = priced.Line;
        OrderId = orderId;
        MenuItemId = line.MenuItemId;
        ItemCode = line.ItemCode;
        ItemName = line.ItemName;
        CategoryId = line.CategoryId;
        SizeName = line.SizeName;
        SizePrice = line.SizePrice;
        SugarLevel = line.SugarLevel;
        IceLevel = line.IceLevel;
        Note = string.IsNullOrWhiteSpace(line.Note) ? null : line.Note.Trim();
        Quantity = line.Quantity;
        UnitPrice = priced.UnitPrice;
        LineTotal = priced.LineTotal;
        DiscountType = line.Discount?.Type;
        DiscountValue = line.Discount?.Value;
        DiscountAmount = priced.DiscountAmount;
        DiscountReason = line.Discount?.Reason;
        PromotionId = priced.Promotion?.Id;
        PromotionName = priced.Promotion?.Name;
        PromotionDiscount = priced.PromotionDiscount;
        SortOrder = sortOrder;
        foreach (var topping in line.Toppings)
            _toppings.Add(new OrderItemTopping(Id, topping.ToppingId, topping.Name, topping.Price));
    }

    public Guid OrderId { get; private set; }
    public Guid MenuItemId { get; private set; }
    public string ItemCode { get; private set; } = string.Empty;
    public string ItemName { get; private set; } = string.Empty;
    public Guid CategoryId { get; private set; }
    public string SizeName { get; private set; } = string.Empty;
    public decimal SizePrice { get; private set; }
    public int? SugarLevel { get; private set; }
    public IceLevel? IceLevel { get; private set; }
    public string? Note { get; private set; }
    public int Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal LineTotal { get; private set; }
    public DiscountType? DiscountType { get; private set; }
    public decimal? DiscountValue { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public string? DiscountReason { get; private set; }
    public Guid? PromotionId { get; private set; }

    /// <summary>Chụp tên khuyến mãi cấp món để in bill không phụ thuộc bảng khuyến mãi.</summary>
    public string? PromotionName { get; private set; }

    public decimal PromotionDiscount { get; private set; }
    public int SortOrder { get; private set; }

    public IReadOnlyCollection<OrderItemTopping> Toppings => _toppings;

    public decimal LineNet => LineTotal - DiscountAmount - PromotionDiscount;
}
