using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Shifts;
using Application.Interfaces.Services.Shifts;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Shifts;

/// <summary>Ca làm (UC-03, UC-10, UC-11, 07 §2.6).</summary>
[Route("api/shifts")]
public sealed class ShiftsController(IShiftService shiftService) : BaseApiController
{
    /// <summary>Ca đang mở của người gọi; chưa có → 204 (FE hiện hộp Mở ca, TC-07).</summary>
    [HttpGet("current")]
    [AuthorizePermission(ProjectPermissions.Shifts.Operate)]
    [ProducesResponseType<ShiftDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<ShiftDto>> GetCurrent(CancellationToken ct) =>
        await shiftService.GetCurrentAsync(ct) is { } shift ? Ok(shift) : NoContent();

    /// <summary>Mở ca → 201; đã có ca đang mở → 200 trả ca đó (UC-03 E2).</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Shifts.Operate)]
    [ProducesResponseType<ShiftDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ShiftDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ShiftDto>> Open(OpenShiftRequest request, CancellationToken ct)
    {
        var (shift, created) = await shiftService.OpenAsync(request, ct);
        return created ? StatusCode(StatusCodes.Status201Created, shift) : Ok(shift);
    }

    /// <summary>Tổng hợp tạm thời của ca đang mở (FR-22); không có ca → 204.</summary>
    [HttpGet("current/summary")]
    [AuthorizePermission(ProjectPermissions.Shifts.Operate)]
    [ProducesResponseType<ShiftSummary>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<ShiftSummary>> GetCurrentSummary(CancellationToken ct) =>
        await shiftService.GetCurrentSummaryAsync(ct) is { } summary ? Ok(summary) : NoContent();

    /// <summary>Chốt ca (UC-10): còn đơn giữ → 400 kèm <c>heldOrders</c>; lệch quá 50.000 ₫ không ghi chú → 400 <c>errors.note</c>.</summary>
    [HttpPost("current/close")]
    [AuthorizePermission(ProjectPermissions.Shifts.Operate)]
    [ProducesResponseType<ShiftDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ShiftDto>> CloseCurrent(CloseShiftRequest request, CancellationToken ct) =>
        Ok(await shiftService.CloseCurrentAsync(request, ct));

    /// <summary>Danh sách ca (FR-24): mặc định 7 ngày gần nhất, openedAt giảm dần.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Shifts.View)]
    [ProducesResponseType<PaginatedResult<ShiftListItem>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<ShiftListItem>>> GetAll([FromQuery] ShiftQuery query, CancellationToken ct) =>
        Ok(await shiftService.GetPagedAsync(query, ct));

    /// <summary>Chi tiết ca kèm hóa đơn; người có <c>shifts.operate</c> xem được ca của mình, ca người khác cần <c>shifts.view</c>.</summary>
    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Shifts.View, ProjectPermissions.Shifts.Operate)]
    [ProducesResponseType<ShiftDetail>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ShiftDetail>> GetById(Guid id, CancellationToken ct) =>
        Ok(await shiftService.GetDetailAsync(id, ct));

    /// <summary>Ghi chú xử lý ca "Cần kiểm tra" → "Đã kiểm tra" (FR-25, TC-11).</summary>
    [HttpPatch("{id:guid}/review")]
    [AuthorizePermission(ProjectPermissions.Shifts.Review)]
    [ProducesResponseType<ShiftDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ShiftDto>> Review(Guid id, ReviewShiftRequest request, CancellationToken ct) =>
        Ok(await shiftService.ReviewAsync(id, request, ct));
}
