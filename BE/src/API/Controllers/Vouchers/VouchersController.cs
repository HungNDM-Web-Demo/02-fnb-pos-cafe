using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Promotions;
using Application.DTOs.Vouchers;
using Application.Interfaces.Services.Vouchers;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Vouchers;

/// <summary>Voucher (UC-13, FR-27, BR-06, 07 §2.7).</summary>
[Route("api/vouchers")]
public sealed class VouchersController(IVoucherService voucherService) : BaseApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Promotions.View)]
    [ProducesResponseType<PaginatedResult<VoucherDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<VoucherDto>>> GetAll([FromQuery] VoucherQuery query, CancellationToken ct) =>
        Ok(await voucherService.GetPagedAsync(query, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Promotions.View)]
    [ProducesResponseType<VoucherDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<VoucherDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await voucherService.GetByIdAsync(id, ct));

    /// <summary>Thêm voucher; mã sai → 400 <c>errors.code</c>, trùng → 409 <c>errors.code</c>.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Promotions.Create)]
    [ProducesResponseType<VoucherDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<VoucherDto>> Create(SaveVoucherRequest request, CancellationToken ct)
    {
        var item = await voucherService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    /// <summary>Sửa voucher; mã giữ nguyên.</summary>
    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Promotions.Update)]
    [ProducesResponseType<VoucherDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<VoucherDto>> Update(Guid id, SaveVoucherRequest request, CancellationToken ct) =>
        Ok(await voucherService.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/pause")]
    [AuthorizePermission(ProjectPermissions.Promotions.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetPaused(Guid id, SetPausedRequest request, CancellationToken ct)
    {
        await voucherService.SetPausedAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Chưa dùng → 204; đã dùng → 400 "Voucher đã được dùng, chỉ có thể tạm dừng".</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Promotions.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await voucherService.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>Kiểm tra mã khi thu ngân nhập (UC-06 1b); không hợp lệ → 400 <c>errors.code</c> theo thứ tự 07 §2.7.</summary>
    [HttpPost("check")]
    [AuthorizePermission(ProjectPermissions.Orders.Discount)]
    [ProducesResponseType<VoucherCheckResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<VoucherCheckResult>> Check(VoucherCheckRequest request, CancellationToken ct) =>
        Ok(await voucherService.CheckAsync(request, ct));
}
