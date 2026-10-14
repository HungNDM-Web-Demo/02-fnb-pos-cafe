using Domain.Base;
using Domain.Common;

namespace Domain.Entities.Pos.MenuItems;

/// <summary>Danh mục món (bảng <c>Pos_Categories</c>, FR-03).</summary>
public class Category : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 100;
    public const int ColorMaxLength = 20;

    /// <summary>Bước đánh lại thứ tự khi sắp xếp (<c>PUT /api/categories/order</c>): 10, 20, 30…</summary>
    public const int SortOrderStep = 10;

    private Category()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Color { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }
    public bool IsHidden { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public static Category Create(string code, string name, string color, int sortOrder, bool isHidden = false)
    {
        var category = new Category { SortOrder = sortOrder };
        category.Update(code, name, color, isHidden);
        return category;
    }

    public static string NormalizeCode(string code) => code.Trim().ToUpperInvariant();

    public void Update(string code, string name, string color, bool isHidden)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new DomainException("Mã danh mục không được để trống.");
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Tên danh mục không được để trống.");

        Code = NormalizeCode(code);
        Name = name.Trim();
        Color = color.Trim().ToUpperInvariant();
        IsHidden = isHidden;
    }

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}
