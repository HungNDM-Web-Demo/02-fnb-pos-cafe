using Application.DTOs.Categories;
using Domain.Entities.Pos.MenuItems;

namespace Application.Mappings.Categories;

/// <summary>Ánh xạ viết tay cho danh mục món.</summary>
public static class CategoryMappings
{
    /// <remarks><c>itemCount</c>: Số món chưa xóa (kể cả ẩn), service đếm.</remarks>
    public static CategoryDto ToDto(this Category category, int itemCount) => new()
    {
        Id = category.Id,
        Code = category.Code,
        Name = category.Name,
        Color = category.Color,
        SortOrder = category.SortOrder,
        IsHidden = category.IsHidden,
        ItemCount = itemCount
    };
}
