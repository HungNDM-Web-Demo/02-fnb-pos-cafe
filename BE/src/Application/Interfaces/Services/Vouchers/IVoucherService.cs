using Application.Common.Models;
using Application.DTOs.Promotions;
using Application.DTOs.Vouchers;

namespace Application.Interfaces.Services.Vouchers;

/// <summary>Voucher (UC-13, FR-27, BR-06).</summary>
public interface IVoucherService
{
    Task<PaginatedResult<VoucherDto>> GetPagedAsync(VoucherQuery query, CancellationToken ct = default);

    Task<VoucherDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<VoucherDto> CreateAsync(SaveVoucherRequest request, CancellationToken ct = default);

    Task<VoucherDto> UpdateAsync(Guid id, SaveVoucherRequest request, CancellationToken ct = default);

    Task SetPausedAsync(Guid id, SetPausedRequest request, CancellationToken ct = default);

    /// <summary><c>usedCount = 0</c> → xóa mềm; đã dùng → 400 "Voucher đã được dùng, chỉ có thể tạm dừng".</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>Kiểm tra BR-06 khi thu ngân nhập mã; không hợp lệ → 400 <c>errors.code</c> (07 §2.7).</summary>
    Task<VoucherCheckResult> CheckAsync(VoucherCheckRequest request, CancellationToken ct = default);
}
