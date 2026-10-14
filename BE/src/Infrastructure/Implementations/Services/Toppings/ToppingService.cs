using Application.Common.Exceptions;
using Application.DTOs.MenuItems;
using Application.DTOs.Toppings;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Toppings;
using Application.Mappings.MenuItems;
using Domain.Common;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Infrastructure.Implementations.Services.Menu;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Toppings;

/// <summary>Topping (FR-05, TC-04, 07 §2.4).</summary>
public sealed class ToppingService(
    IGenericRepository<Topping> toppings,
    IGenericRepository<OrderItemTopping> orderItemToppings,
    IUnitOfWork unitOfWork) : IToppingService
{
    public async Task<IReadOnlyList<ToppingDto>> GetListAsync(CancellationToken ct = default)
    {
        var list = await toppings.QueryNoTracking().OrderBy(t => t.SortOrder).ThenBy(t => t.Code).ToListAsync(ct);
        var sold = await MenuQueries.SoldToppingIdsAsync(orderItemToppings, ct);
        return list.Select(t => t.ToDto(sold.Contains(t.Id))).ToList();
    }

    public async Task<ToppingDto> CreateAsync(SaveToppingRequest request, CancellationToken ct = default)
    {
        await EnsureCodeUniqueAsync(request.Code, null, ct);
        var sortOrder = request.SortOrder
            ?? (await toppings.QueryNoTracking().MaxAsync(t => (int?)t.SortOrder, ct) ?? 0) + Category.SortOrderStep;

        var topping = Topping.Create(request.Code, request.Name, request.Price, sortOrder);
        await toppings.AddAsync(topping, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return topping.ToDto(false);
    }

    public async Task<ToppingDto> UpdateAsync(Guid id, SaveToppingRequest request, CancellationToken ct = default)
    {
        var topping = await LoadAsync(id, ct);
        await EnsureCodeUniqueAsync(request.Code, id, ct);

        topping.Update(request.Code, request.Name, request.Price, request.SortOrder ?? topping.SortOrder);
        await unitOfWork.SaveChangesAsync(ct);
        return topping.ToDto(await EverSoldAsync(id, ct));
    }

    public async Task SetAvailabilityAsync(Guid id, SetAvailabilityRequest request, CancellationToken ct = default)
    {
        var topping = await LoadAsync(id, ct);
        topping.SetSoldOut(request.IsSoldOut);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task SetHiddenAsync(Guid id, SetHiddenRequest request, CancellationToken ct = default)
    {
        var topping = await LoadAsync(id, ct);
        topping.SetHidden(request.IsHidden);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var topping = await LoadAsync(id, ct);
        if (await EverSoldAsync(id, ct))
            throw new DomainException("Topping đã có trong hóa đơn, chỉ có thể ẩn");

        toppings.Delete(topping);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<Topping> LoadAsync(Guid id, CancellationToken ct) =>
        await toppings.Query().FirstOrDefaultAsync(t => t.Id == id, ct)
        ?? throw new NotFoundException(MenuQueries.ToppingNotFoundMessage);

    private Task<bool> EverSoldAsync(Guid id, CancellationToken ct) => orderItemToppings.AnyAsync(t => t.ToppingId == id, ct);

    private async Task EnsureCodeUniqueAsync(string code, Guid? currentId, CancellationToken ct)
    {
        var normalized = Topping.NormalizeCode(code);
        if (await toppings.AnyAsync(t => t.Code == normalized && t.Id != currentId, ct))
            throw new ConflictException("Mã topping đã tồn tại", "code");
    }
}
