using Application.DTOs.Menu;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Menu;
using Application.Mappings.Categories;
using Application.Mappings.MenuItems;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Menu;

/// <summary>Thực đơn gộp cho màn bán hàng (07 §2.1).</summary>
public sealed class MenuService(
    IGenericRepository<Category> categories,
    IGenericRepository<MenuItem> menuItems,
    IGenericRepository<Topping> toppings,
    IGenericRepository<OrderItem> orderItems,
    IGenericRepository<OrderItemTopping> orderItemToppings) : IMenuService
{
    public async Task<MenuBundle> GetBundleAsync(CancellationToken ct = default)
    {
        var categoryList = await categories.QueryNoTracking()
            .Where(c => !c.IsHidden)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Code)
            .ToListAsync(ct);
        var itemCounts = await menuItems.QueryNoTracking()
            .GroupBy(m => m.CategoryId)
            .Select(g => new { CategoryId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CategoryId, x => x.Count, ct);

        var items = await menuItems.QueryNoTracking()
            .Include(m => m.Category)
            .Where(m => !m.IsHidden)
            .AsSplitQuery()
            .ToListAsync(ct);
        var categoryOrder = categoryList.Select((c, i) => (c.Id, i)).ToDictionary(x => x.Id, x => x.i);

        var toppingList = await toppings.QueryNoTracking()
            .Where(t => !t.IsHidden)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Code)
            .ToListAsync(ct);

        var soldItems = await MenuQueries.SoldMenuItemIdsAsync(orderItems, ct);
        var soldToppings = await MenuQueries.SoldToppingIdsAsync(orderItemToppings, ct);

        return new MenuBundle
        {
            Categories = categoryList.Select(c => c.ToDto(itemCounts.GetValueOrDefault(c.Id))).ToList(),
            Items = items
                .OrderBy(m => categoryOrder.GetValueOrDefault(m.CategoryId, int.MaxValue))
                .ThenBy(m => m.SortOrder)
                .ThenBy(m => m.Code, StringComparer.Ordinal)
                .Select(m => m.ToDto(soldItems.Contains(m.Id)))
                .ToList(),
            Toppings = toppingList.Select(t => t.ToDto(soldToppings.Contains(t.Id))).ToList()
        };
    }
}
