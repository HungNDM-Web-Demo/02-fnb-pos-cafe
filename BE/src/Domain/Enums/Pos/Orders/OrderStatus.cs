namespace Domain.Enums.Pos.Orders;

/// <summary>Trạng thái hóa đơn (06 §4 <c>Pos_Orders</c>). "Đang tạo" chỉ tồn tại trong giỏ hàng trên FE.</summary>
public enum OrderStatus
{
    DangGiu = 0,
    DaThanhToan = 1,
    DaHuy = 2
}
