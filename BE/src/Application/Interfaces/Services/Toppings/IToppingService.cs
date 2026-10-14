using Application.DTOs.MenuItems;
using Application.DTOs.Toppings;

namespace Application.Interfaces.Services.Toppings;

/// <summary>Topping (UC-01 1b, FR-05, TC-04).</summary>
public interface IToppingService
{
    /// <summary>Tất cả, theo sortOrder.</summary>
    Task<IReadOnlyList<ToppingDto>> GetListAsync(CancellationToken ct = default);

    Task<ToppingDto> CreateAsync(SaveToppingRequest request, CancellationToken ct = default);

    Task<ToppingDto> UpdateAsync(Guid id, SaveToppingRequest request, CancellationToken ct = default);

    Task SetAvailabilityAsync(Guid id, SetAvailabilityRequest request, CancellationToken ct = default);

    Task SetHiddenAsync(Guid id, SetHiddenRequest request, CancellationToken ct = default);

    /// <summary>Chưa từng bán → xóa mềm; đã bán → 400 "Topping đã có trong hóa đơn, chỉ có thể ẩn".</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
