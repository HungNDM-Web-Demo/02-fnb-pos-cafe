using Domain.Base;

namespace Domain.Entities.Pos.Orders;

/// <summary>Topping của dòng hóa đơn, giá chụp lúc bán (bảng <c>Pos_OrderItemToppings</c>).</summary>
public class OrderItemTopping : BaseEntity
{
    public const int NameMaxLength = 100;

    private OrderItemTopping()
    {
    }

    internal OrderItemTopping(Guid orderItemId, Guid toppingId, string toppingName, decimal price)
    {
        OrderItemId = orderItemId;
        ToppingId = toppingId;
        ToppingName = toppingName;
        Price = price;
    }

    public Guid OrderItemId { get; private set; }
    public Guid ToppingId { get; private set; }
    public string ToppingName { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
}
