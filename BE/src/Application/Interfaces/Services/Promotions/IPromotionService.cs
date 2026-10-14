using Application.Common.Models;
using Application.DTOs.Promotions;

namespace Application.Interfaces.Services.Promotions;

/// <summary>Khuyến mãi tự động (UC-13, FR-26).</summary>
public interface IPromotionService
{
    Task<PaginatedResult<PromotionDto>> GetPagedAsync(PromotionQuery query, CancellationToken ct = default);

    /// <summary>Khuyến mãi đang chạy hôm nay (chưa xét khung giờ) để màn bán hàng tự áp (FR-14).</summary>
    Task<IReadOnlyList<PromotionDto>> GetActiveAsync(CancellationToken ct = default);

    Task<PromotionDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>BE sinh mã <c>KM</c> + 2 số.</summary>
    Task<PromotionDto> CreateAsync(SavePromotionRequest request, CancellationToken ct = default);

    Task<PromotionDto> UpdateAsync(Guid id, SavePromotionRequest request, CancellationToken ct = default);

    Task SetPausedAsync(Guid id, SetPausedRequest request, CancellationToken ct = default);

    /// <summary>Xóa mềm; hóa đơn cũ giữ tên đã chụp.</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
