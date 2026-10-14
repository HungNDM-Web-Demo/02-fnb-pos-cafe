using Application.DTOs.Orders;

namespace Application.Interfaces.Services.Orders;

/// <summary>Quản lý xác nhận giảm giá vượt hạn mức ngay trên tablet (FR-15, UC-06 3a, 07 §2.5).</summary>
public interface IDiscountApprovalService
{
    /// <summary>
    /// Kiểm tra tài khoản quản lý như đăng nhập nhưng không tạo phiên. Sai → 400; không có
    /// <c>orders.discount-override</c> → 403; thành công → token 5 phút, dùng một lần.
    /// </summary>
    Task<DiscountApprovalDto> ApproveAsync(DiscountApprovalRequest request, CancellationToken ct = default);

    /// <summary>Dùng token một lần; sai, hết hạn hoặc đã dùng thì trả null.</summary>
    (Guid Id, string Username)? Consume(string? token);
}
