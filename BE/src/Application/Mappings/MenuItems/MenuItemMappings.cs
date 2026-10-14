using Application.DTOs.MenuItems;
using Application.DTOs.Toppings;
using Domain.Entities.Pos.MenuItems;

namespace Application.Mappings.MenuItems;

/// <summary>Ánh xạ viết tay cho món, size, topping. Cần <c>Include(Sizes)</c>, <c>Include(MenuItemToppings)</c>, <c>Include(Category)</c>.</summary>
public static class MenuItemMappings
{
    public static MenuItemSizeDto ToDto(this MenuItemSize size) => new()
    {
        Id = size.Id,
        Name = size.Name,
        Price = size.Price,
        IsDefault = size.IsDefault,
        SortOrder = size.SortOrder
    };

    /// <remarks><c>everSold</c>: Đã có trong hóa đơn (BR-18).</remarks>
    public static MenuItemDto ToDto(this MenuItem item, bool everSold) => new()
    {
        Id = item.Id,
        Code = item.Code,
        Name = item.Name,
        CategoryId = item.CategoryId,
        CategoryName = item.Category?.Name ?? string.Empty,
        ImageUrl = item.ImageUrl,
        Description = item.Description,
        HasSugarOption = item.HasSugarOption,
        HasIceOption = item.HasIceOption,
        IsSoldOut = item.IsSoldOut,
        IsHidden = item.IsHidden,
        Status = item.Status,
        SortOrder = item.SortOrder,
        Sizes = item.Sizes.OrderBy(s => s.SortOrder).ThenBy(s => s.Name, StringComparer.Ordinal).Select(s => s.ToDto()).ToList(),
        MinPrice = item.MinPrice,
        ToppingIds = item.MenuItemToppings.Select(t => t.ToppingId).ToList(),
        EverSold = everSold,
        UpdatedAt = item.UpdatedAt ?? item.CreatedAt
    };

    public static ToppingDto ToDto(this Topping topping, bool everSold) => new()
    {
        Id = topping.Id,
        Code = topping.Code,
        Name = topping.Name,
        Price = topping.Price,
        IsSoldOut = topping.IsSoldOut,
        IsHidden = topping.IsHidden,
        Status = topping.Status,
        SortOrder = topping.SortOrder,
        EverSold = everSold
    };
}
