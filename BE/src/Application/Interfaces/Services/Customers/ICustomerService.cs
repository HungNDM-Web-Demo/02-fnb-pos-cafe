using Application.Common.Models;
using Application.DTOs.Customers;

namespace Application.Interfaces.Services.Customers;

/// <summary>Khách tích điểm (UC-15, FR-33, FR-34, P3).</summary>
public interface ICustomerService
{
    Task<PaginatedResult<CustomerDto>> GetPagedAsync(CustomerQuery query, CancellationToken ct = default);

    /// <summary>Tra nhanh theo SĐT ở màn bán hàng; không có → 404.</summary>
    Task<CustomerDto> LookupAsync(string phone, CancellationToken ct = default);

    /// <summary>Kèm 20 hóa đơn gần nhất.</summary>
    Task<CustomerDetail> GetDetailAsync(Guid id, CancellationToken ct = default);

    /// <summary>Trùng SĐT → 409 <c>errors.phone</c>.</summary>
    Task<CustomerDto> CreateAsync(SaveCustomerRequest request, CancellationToken ct = default);

    /// <summary>Sửa tên, ghi chú (SĐT giữ nguyên nếu trùng chính mình).</summary>
    Task<CustomerDto> UpdateAsync(Guid id, SaveCustomerRequest request, CancellationToken ct = default);
}
