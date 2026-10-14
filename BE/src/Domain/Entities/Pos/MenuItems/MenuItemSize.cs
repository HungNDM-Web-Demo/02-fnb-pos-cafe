using Domain.Base;

namespace Domain.Entities.Pos.MenuItems;

/// <summary>Giá theo size của món (bảng <c>Pos_MenuItemSizes</c>). Thay cả bộ khi sửa món.</summary>
public class MenuItemSize : BaseEntity
{
    public const int NameMaxLength = 20;

    private MenuItemSize()
    {
    }

    internal MenuItemSize(Guid menuItemId, string name, decimal price, bool isDefault, int sortOrder)
    {
        MenuItemId = menuItemId;
        Name = name;
        Price = price;
        IsDefault = isDefault;
        SortOrder = sortOrder;
    }

    public Guid MenuItemId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public bool IsDefault { get; private set; }
    public int SortOrder { get; private set; }
}
