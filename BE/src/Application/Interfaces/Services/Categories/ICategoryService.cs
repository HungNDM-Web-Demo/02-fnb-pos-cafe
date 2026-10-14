using Application.DTOs.Categories;

namespace Application.Interfaces.Services.Categories;

/// <summary>Danh mục món (UC-01 1a, FR-03).</summary>
public interface ICategoryService
{
    /// <summary>Tất cả, kể cả ẩn, theo sortOrder, kèm số món.</summary>
    Task<IReadOnlyList<CategoryDto>> GetListAsync(CancellationToken ct = default);

    Task<CategoryDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken ct = default);

    Task<CategoryDto> UpdateAsync(Guid id, SaveCategoryRequest request, CancellationToken ct = default);

    /// <summary>Toàn bộ danh mục theo thứ tự mới, đánh lại 10, 20, 30…; thiếu hoặc thừa id → 400 <c>errors.ids</c>.</summary>
    Task ReorderAsync(ReorderCategoriesRequest request, CancellationToken ct = default);

    /// <summary>Chỉ khi không còn món (kể cả ẩn).</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
