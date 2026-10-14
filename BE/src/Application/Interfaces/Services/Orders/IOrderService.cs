using Application.Common.Models;
using Application.DTOs.Orders;

namespace Application.Interfaces.Services.Orders;

/// <summary>Bán hàng, hóa đơn, đơn giữ (UC-04..UC-09, 07 §2.5).</summary>
public interface IOrderService
{
    /// <summary>Tra cứu hóa đơn (FR-19); người không có <c>orders.view-all</c> chỉ thấy hóa đơn của mình. Không trả đơn giữ.</summary>
    Task<PaginatedResult<OrderListItem>> GetPagedAsync(OrderQuery query, CancellationToken ct = default);

    /// <summary>Chi tiết để xem và in; hóa đơn của người khác mà không có <c>orders.view-all</c> → 403.</summary>
    Task<OrderDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Mã hóa đơn dự kiến cho nội dung QR (UC-07 2a).</summary>
    Task<NextCodeResult> GetNextCodeAsync(CancellationToken ct = default);

    /// <summary>Thanh toán (UC-07): tính lại tiền, kiểm tra ca, voucher, hạn mức; cùng clientRequestId trả hóa đơn cũ (TC-24).</summary>
    Task<CheckoutResult> CheckoutAsync(CheckoutRequest request, CancellationToken ct = default);

    /// <summary>Hủy hóa đơn đã thanh toán thuộc ca đang mở (UC-08, BR-13).</summary>
    Task<OrderDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default);

    /// <summary>Đơn giữ của thu ngân hiện tại trong ca đang mở, mới nhất trước.</summary>
    Task<IReadOnlyList<HeldOrderDto>> GetHeldAsync(CancellationToken ct = default);

    /// <summary>Giữ đơn (UC-05); quá 10 đơn → 400 (BR-15).</summary>
    Task<HeldOrderDto> HoldAsync(HoldOrderRequest request, CancellationToken ct = default);

    /// <summary>Cập nhật đơn giữ sau khi mở lại rồi giữ tiếp.</summary>
    Task<HeldOrderDto> UpdateHeldAsync(Guid id, HoldOrderRequest request, CancellationToken ct = default);

    Task DeleteHeldAsync(Guid id, CancellationToken ct = default);
}
