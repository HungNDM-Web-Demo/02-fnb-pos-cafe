using Domain.Entities.Pos.MenuItems;

namespace Domain.Entities.Pos.Promotions;

/// <summary>Món thuộc khuyến mãi phạm vi món (bảng nối <c>Pos_PromotionMenuItems</c>).</summary>
public class PromotionMenuItem
{
    private PromotionMenuItem()
    {
    }

    internal PromotionMenuItem(Guid promotionId, Guid menuItemId)
    {
        PromotionId = promotionId;
        MenuItemId = menuItemId;
    }

    public Guid PromotionId { get; private set; }
    public Guid MenuItemId { get; private set; }
    public Promotion Promotion { get; private set; } = null!;
    public MenuItem MenuItem { get; private set; } = null!;
}
