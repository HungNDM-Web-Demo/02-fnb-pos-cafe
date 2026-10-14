namespace Domain.Enums.Pos.Promotions;

/// <summary>Trạng thái khuyến mãi trong DTO, suy ra từ ngày hiệu lực và cờ tạm dừng (06 §4).</summary>
public enum PromotionStatus
{
    SapChay = 0,
    DangChay = 1,
    DaHet = 2,
    TamDung = 3
}
