using Application.Common.Models;
using Domain.Enums.Pos.MenuItems;

namespace Application.DTOs.Toppings;

// DTO topping /api/toppings (07 §2.4).

public sealed record ToppingDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public bool IsSoldOut { get; init; }
    public bool IsHidden { get; init; }
    public MenuItemStatus Status { get; init; }
    public int SortOrder { get; init; }
    public bool EverSold { get; init; }
}

public sealed record SaveToppingRequest
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public int? SortOrder { get; init; }
}
