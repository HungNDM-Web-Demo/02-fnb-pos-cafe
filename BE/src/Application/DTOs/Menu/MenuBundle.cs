using Application.DTOs.Categories;
using Application.DTOs.MenuItems;
using Application.DTOs.Toppings;

namespace Application.DTOs.Menu;

/// <summary>Thực đơn gộp cho màn bán hàng (<c>GET /api/menu</c>, 07 §2.1): chỉ phần chưa ẩn; món tạm hết vẫn trả để hiện mờ.</summary>
public sealed record MenuBundle
{
    public IReadOnlyList<CategoryDto> Categories { get; init; } = [];
    public IReadOnlyList<MenuItemDto> Items { get; init; } = [];
    public IReadOnlyList<ToppingDto> Toppings { get; init; } = [];
}
