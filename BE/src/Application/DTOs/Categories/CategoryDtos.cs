using Application.Common.Models;

namespace Application.DTOs.Categories;

// DTO danh mục món /api/categories (07 §2.2).

public sealed record CategoryDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsHidden { get; init; }

    /// <summary>Món chưa xóa, kể cả ẩn.</summary>
    public int ItemCount { get; init; }
}

public sealed record SaveCategoryRequest
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public bool IsHidden { get; init; }
}

/// <summary>Toàn bộ danh mục theo thứ tự mới; đánh lại 10, 20, 30…</summary>
public sealed record ReorderCategoriesRequest
{
    public IReadOnlyList<Guid> Ids { get; init; } = [];
}
