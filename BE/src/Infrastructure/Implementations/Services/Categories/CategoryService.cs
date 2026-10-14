using Application.Common.Exceptions;
using Application.DTOs.Categories;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Categories;
using Application.Mappings.Categories;
using Domain.Common;
using Domain.Entities.Pos.MenuItems;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Menu;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Categories;

/// <summary>Danh mục món (FR-03, 07 §2.2).</summary>
public sealed class CategoryService(
    IGenericRepository<Category> categories,
    IGenericRepository<MenuItem> menuItems,
    IUnitOfWork unitOfWork) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryDto>> GetListAsync(CancellationToken ct = default)
    {
        var list = await categories.QueryNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Code).ToListAsync(ct);
        var counts = await CountItemsAsync(ct);
        return list.Select(c => c.ToDto(counts.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<CategoryDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var category = await categories.QueryNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(MenuQueries.CategoryNotFoundMessage);
        return category.ToDto(await CountItemsAsync(id, ct));
    }

    public async Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken ct = default)
    {
        await EnsureCodeUniqueAsync(request.Code, null, ct);
        var maxOrder = await categories.QueryNoTracking().MaxAsync(c => (int?)c.SortOrder, ct) ?? 0;

        var category = Category.Create(request.Code, request.Name, request.Color, maxOrder + Category.SortOrderStep, request.IsHidden);
        await categories.AddAsync(category, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return category.ToDto(0);
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, SaveCategoryRequest request, CancellationToken ct = default)
    {
        var category = await LoadAsync(id, ct);
        await EnsureCodeUniqueAsync(request.Code, id, ct);

        category.Update(request.Code, request.Name, request.Color, request.IsHidden);
        await unitOfWork.SaveChangesAsync(ct);
        return category.ToDto(await CountItemsAsync(id, ct));
    }

    public async Task ReorderAsync(ReorderCategoriesRequest request, CancellationToken ct = default)
    {
        var all = await categories.Query().ToListAsync(ct);
        var byId = all.ToDictionary(c => c.Id);
        if (request.Ids.Count != all.Count || request.Ids.Any(id => !byId.ContainsKey(id)))
            throw FieldErrors.Single("ids", "Danh sách phải gồm đúng toàn bộ danh mục");

        for (var i = 0; i < request.Ids.Count; i++)
            byId[request.Ids[i]].SetSortOrder((i + 1) * Category.SortOrderStep);

        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var category = await LoadAsync(id, ct);
        var itemCount = await CountItemsAsync(id, ct);
        if (itemCount > 0)
        {
            throw new DomainException(
                $"Danh mục đang có {itemCount} món, chuyển món sang danh mục khác trước",
                new Dictionary<string, object?> { ["itemCount"] = itemCount });
        }

        categories.Delete(category);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<Category> LoadAsync(Guid id, CancellationToken ct) =>
        await categories.Query().FirstOrDefaultAsync(c => c.Id == id, ct)
        ?? throw new NotFoundException(MenuQueries.CategoryNotFoundMessage);

    private async Task EnsureCodeUniqueAsync(string code, Guid? currentId, CancellationToken ct)
    {
        var normalized = Category.NormalizeCode(code);
        if (await categories.AnyAsync(c => c.Code == normalized && c.Id != currentId, ct))
            throw new ConflictException("Mã danh mục đã tồn tại", "code");
    }

    private Task<Dictionary<Guid, int>> CountItemsAsync(CancellationToken ct) =>
        menuItems.QueryNoTracking()
            .IgnoreAutoIncludes()
            .GroupBy(m => m.CategoryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    private Task<int> CountItemsAsync(Guid categoryId, CancellationToken ct) =>
        menuItems.QueryNoTracking().IgnoreAutoIncludes().CountAsync(m => m.CategoryId == categoryId, ct);
}
