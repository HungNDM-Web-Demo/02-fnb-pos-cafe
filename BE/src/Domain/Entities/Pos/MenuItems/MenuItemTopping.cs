namespace Domain.Entities.Pos.MenuItems;

/// <summary>Topping được phép của món (bảng nối <c>Pos_MenuItemToppings</c>, khóa ghép).</summary>
public class MenuItemTopping
{
    private MenuItemTopping()
    {
    }

    internal MenuItemTopping(Guid menuItemId, Guid toppingId)
    {
        MenuItemId = menuItemId;
        ToppingId = toppingId;
    }

    public Guid MenuItemId { get; private set; }
    public Guid ToppingId { get; private set; }
    public MenuItem MenuItem { get; private set; } = null!;
    public Topping Topping { get; private set; } = null!;
}
