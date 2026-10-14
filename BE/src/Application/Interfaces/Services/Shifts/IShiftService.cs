using Application.Common.Models;
using Application.DTOs.Shifts;

namespace Application.Interfaces.Services.Shifts;

/// <summary>Ca làm (UC-03, UC-10, UC-11, 07 §2.6).</summary>
public interface IShiftService
{
    /// <summary>Ca đang mở của người gọi; null khi chưa có (FE hiện hộp Mở ca).</summary>
    Task<ShiftDto?> GetCurrentAsync(CancellationToken ct = default);

    /// <summary>Mở ca (BR-10). Đã có ca đang mở → trả ca đó, <c>Created</c> false (UC-03 E2).</summary>
    Task<(ShiftDto Shift, bool Created)> OpenAsync(OpenShiftRequest request, CancellationToken ct = default);

    /// <summary>Tổng hợp tạm thời của ca đang mở (FR-22); null khi không có ca.</summary>
    Task<ShiftSummary?> GetCurrentSummaryAsync(CancellationToken ct = default);

    /// <summary>Chốt ca (UC-10, BR-11, BR-12, BR-15).</summary>
    Task<ShiftDto> CloseCurrentAsync(CloseShiftRequest request, CancellationToken ct = default);

    /// <summary>Danh sách ca (FR-24), mặc định 7 ngày gần nhất.</summary>
    Task<PaginatedResult<ShiftListItem>> GetPagedAsync(ShiftQuery query, CancellationToken ct = default);

    /// <summary>Chi tiết kèm tổng hợp và hóa đơn; ca người khác mà không có <c>shifts.view</c> → 403.</summary>
    Task<ShiftDetail> GetDetailAsync(Guid id, CancellationToken ct = default);

    /// <summary>Ghi chú xử lý ca "Cần kiểm tra" (FR-25).</summary>
    Task<ShiftDto> ReviewAsync(Guid id, ReviewShiftRequest request, CancellationToken ct = default);
}
