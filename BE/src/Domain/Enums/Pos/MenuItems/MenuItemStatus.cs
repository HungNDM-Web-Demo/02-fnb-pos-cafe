namespace Domain.Enums.Pos.MenuItems;

/// <summary>Trạng thái hiển thị của món, topping (06 §4): suy ra từ hai cờ <c>IsHidden</c>, <c>IsSoldOut</c>; <c>An</c> ưu tiên hơn <c>TamHet</c>.</summary>
public enum MenuItemStatus
{
    DangBan = 0,
    TamHet = 1,
    An = 2
}
