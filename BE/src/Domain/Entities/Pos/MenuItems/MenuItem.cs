using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.MenuItems;

namespace Domain.Entities.Pos.MenuItems;

/// <summary>Món bán ra (bảng <c>Pos_MenuItems</c>, FR-04). Giá theo size ở <see cref="Sizes"/>, topping được phép ở <see cref="MenuItemToppings"/>.</summary>
public class MenuItem : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 150;
    public const int ImageUrlMaxLength = 500;
    public const int DescriptionMaxLength = 500;

    private readonly List<MenuItemSize> _sizes = [];
    private readonly List<MenuItemTopping> _menuItemToppings = [];

    private MenuItem()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public Guid CategoryId { get; private set; }
    public Category? Category { get; private set; }
    public string? ImageUrl { get; private set; }
    public string? Description { get; private set; }
    public bool HasSugarOption { get; private set; } = true;
    public bool HasIceOption { get; private set; } = true;
    public bool IsSoldOut { get; private set; }
    public bool IsHidden { get; private set; }
    public int SortOrder { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public IReadOnlyCollection<MenuItemSize> Sizes => _sizes;
    public IReadOnlyCollection<MenuItemTopping> MenuItemToppings => _menuItemToppings;

    /// <summary>Trạng thái hiển thị: <c>An</c> ưu tiên hơn <c>TamHet</c> (06 §4).</summary>
    public MenuItemStatus Status => IsHidden ? MenuItemStatus.An : IsSoldOut ? MenuItemStatus.TamHet : MenuItemStatus.DangBan;

    /// <summary>Món còn trong thực đơn bán hàng (chưa ẩn, chưa xóa); tạm hết xét riêng (BR-14).</summary>
    public bool IsListed => !IsHidden && !IsDeleted;

    public decimal MinPrice => _sizes.Count == 0 ? 0 : _sizes.Min(s => s.Price);

    public MenuItemSize? FindSize(string? sizeName) =>
        _sizes.FirstOrDefault(s => string.Equals(s.Name, sizeName?.Trim(), StringComparison.OrdinalIgnoreCase));

    public bool AllowsTopping(Guid toppingId) => _menuItemToppings.Any(t => t.ToppingId == toppingId);

    public static MenuItem Create(
        string code,
        string name,
        Guid categoryId,
        string? description,
        bool hasSugarOption,
        bool hasIceOption,
        int sortOrder,
        IEnumerable<(string Name, decimal Price, bool IsDefault)> sizes,
        IEnumerable<Guid> toppingIds)
    {
        var item = new MenuItem();
        item.Update(code, name, categoryId, description, hasSugarOption, hasIceOption, sortOrder, sizes, toppingIds);
        return item;
    }

    public static string NormalizeCode(string code) => code.Trim().ToUpperInvariant();

    /// <summary>Sửa món: thay cả bộ size và danh sách topping (06 §4). Hóa đơn cũ đã chụp giá nên không đổi (UC-01 1c).</summary>
    public void Update(
        string code,
        string name,
        Guid categoryId,
        string? description,
        bool hasSugarOption,
        bool hasIceOption,
        int sortOrder,
        IEnumerable<(string Name, decimal Price, bool IsDefault)> sizes,
        IEnumerable<Guid> toppingIds)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new DomainException("Mã món không được để trống.");
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Tên món không được để trống.");

        var sizeList = sizes.ToList();
        if (sizeList.Count == 0)
            throw new DomainException("Cần ít nhất một size");
        if (sizeList.Count(s => s.IsDefault) > 1)
            throw new DomainException("Chỉ một size được đặt mặc định");
        if (sizeList.Any(s => s.Price <= 0 || !PosRules.IsThousandMultiple(s.Price)))
            throw new DomainException("Giá phải là bội số 1.000 ₫");

        Code = NormalizeCode(code);
        Name = name.Trim();
        CategoryId = categoryId;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        HasSugarOption = hasSugarOption;
        HasIceOption = hasIceOption;
        SortOrder = sortOrder;

        _sizes.Clear();
        var hasDefault = sizeList.Any(s => s.IsDefault);
        for (var i = 0; i < sizeList.Count; i++)
        {
            var (sizeName, price, isDefault) = sizeList[i];
            _sizes.Add(new MenuItemSize(Id, sizeName.Trim(), price, isDefault || (!hasDefault && i == 0), (i + 1) * 10));
        }

        var targetToppings = toppingIds.Distinct().ToHashSet();
        _menuItemToppings.RemoveAll(t => !targetToppings.Contains(t.ToppingId));
        foreach (var toppingId in targetToppings.Where(id => _menuItemToppings.All(t => t.ToppingId != id)))
            _menuItemToppings.Add(new MenuItemTopping(Id, toppingId));
    }

    public void SetImage(string? imageUrl) => ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim();

    /// <summary>FR-06: tạm hết hoặc bán lại; thu ngân đổi được.</summary>
    public void SetSoldOut(bool isSoldOut) => IsSoldOut = isSoldOut;

    /// <summary>FR-04: ẩn khỏi màn bán hàng; vẫn còn trong báo cáo.</summary>
    public void SetHidden(bool isHidden) => IsHidden = isHidden;
}
