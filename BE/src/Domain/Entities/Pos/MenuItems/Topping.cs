using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.MenuItems;

namespace Domain.Entities.Pos.MenuItems;

/// <summary>Topping (bảng <c>Pos_Toppings</c>, FR-05). Tạm hết áp cho mọi món (TC-04).</summary>
public class Topping : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 100;

    private Topping()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public bool IsSoldOut { get; private set; }
    public bool IsHidden { get; private set; }
    public int SortOrder { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public MenuItemStatus Status => IsHidden ? MenuItemStatus.An : IsSoldOut ? MenuItemStatus.TamHet : MenuItemStatus.DangBan;

    /// <summary>Topping còn trong thực đơn (chưa ẩn, chưa xóa); tạm hết xét riêng (BR-14).</summary>
    public bool IsListed => !IsHidden && !IsDeleted;

    public static Topping Create(string code, string name, decimal price, int sortOrder)
    {
        var topping = new Topping();
        topping.Update(code, name, price, sortOrder);
        return topping;
    }

    public static string NormalizeCode(string code) => code.Trim().ToUpperInvariant();

    public void Update(string code, string name, decimal price, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new DomainException("Mã topping không được để trống.");
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Tên topping không được để trống.");
        if (price < 0 || !PosRules.IsThousandMultiple(price))
            throw new DomainException("Giá phải là bội số 1.000 ₫");

        Code = NormalizeCode(code);
        Name = name.Trim();
        Price = price;
        SortOrder = sortOrder;
    }

    public void SetSoldOut(bool isSoldOut) => IsSoldOut = isSoldOut;

    public void SetHidden(bool isHidden) => IsHidden = isHidden;
}
