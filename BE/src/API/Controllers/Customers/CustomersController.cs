using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Customers;
using Application.Interfaces.Services.Customers;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Customers;

/// <summary>Khách tích điểm (UC-15, FR-33, FR-34, P3, 07 §2.9).</summary>
[Route("api/customers")]
public sealed class CustomersController(ICustomerService customerService) : BaseApiController
{
    /// <summary>Danh sách, <c>search</c> theo SĐT, tên; mặc định lastOrderAt giảm dần.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    [ProducesResponseType<PaginatedResult<CustomerDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<CustomerDto>>> GetAll([FromQuery] CustomerQuery query, CancellationToken ct) =>
        Ok(await customerService.GetPagedAsync(query, ct));

    /// <summary>Tra nhanh theo SĐT ở màn bán hàng (FR-33); không có → 404.</summary>
    [HttpGet("lookup")]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    [ProducesResponseType<CustomerDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CustomerDto>> Lookup([FromQuery] string? phone, CancellationToken ct) =>
        Ok(await customerService.LookupAsync(phone ?? string.Empty, ct));

    /// <summary>Chi tiết kèm 20 hóa đơn gần nhất.</summary>
    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    [ProducesResponseType<CustomerDetail>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerDetail>> GetById(Guid id, CancellationToken ct) =>
        Ok(await customerService.GetDetailAsync(id, ct));

    /// <summary>Thêm nhanh khách; trùng SĐT → 409 <c>errors.phone</c>.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Customers.Create)]
    [ProducesResponseType<CustomerDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<CustomerDto>> Create(SaveCustomerRequest request, CancellationToken ct)
    {
        var item = await customerService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Customers.Create)]
    [ProducesResponseType<CustomerDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CustomerDto>> Update(Guid id, SaveCustomerRequest request, CancellationToken ct) =>
        Ok(await customerService.UpdateAsync(id, request, ct));
}
