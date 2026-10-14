using Application.Interfaces.Repositories;
using Domain.Entities.Pos.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Menu;

/// <summary>Truy vấn dùng chung của thực đơn: món, topping đã từng bán (BR-18).</summary>
internal static class MenuQueries
{
    public const string ItemNotFoundMessage = "Không tìm thấy món.";
    public const string ToppingNotFoundMessage = "Không tìm thấy topping.";
    public const string CategoryNotFoundMessage = "Không tìm thấy danh mục.";

    /// <summary>Id các món đã có trong dòng hóa đơn (kể cả đơn giữ, hóa đơn hủy).</summary>
    public static async Task<HashSet<Guid>> SoldMenuItemIdsAsync(IGenericRepository<OrderItem> orderItems, CancellationToken ct) =>
        (await orderItems.QueryNoTracking().Select(i => i.MenuItemId).Distinct().ToListAsync(ct)).ToHashSet();

    public static async Task<HashSet<Guid>> SoldToppingIdsAsync(IGenericRepository<OrderItemTopping> orderItemToppings, CancellationToken ct) =>
        (await orderItemToppings.QueryNoTracking().Select(t => t.ToppingId).Distinct().ToListAsync(ct)).ToHashSet();
}
