using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Promotions;
using Application.Interfaces.Services.Promotions;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Promotions;

/// <summary>Khuyến mãi tự động (UC-13, FR-26, 07 §2.7).</summary>
[Route("api/promotions")]
public sealed class PromotionsController(IPromotionService promotionService) : BaseApiController
{
    /// <summary>Danh sách, lọc <c>status</c>; mặc định startDate giảm dần.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Promotions.View)]
    [ProducesResponseType<PaginatedResult<PromotionDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<PromotionDto>>> GetAll([FromQuery] PromotionQuery query, CancellationToken ct) =>
        Ok(await promotionService.GetPagedAsync(query, ct));

    /// <summary>Khuyến mãi đang chạy hôm nay (chưa xét khung giờ) cho màn bán hàng tự áp (FR-14).</summary>
    [HttpGet("active")]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<IReadOnlyList<PromotionDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PromotionDto>>> GetActive(CancellationToken ct) =>
        Ok(await promotionService.GetActiveAsync(ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Promotions.View)]
    [ProducesResponseType<PromotionDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PromotionDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await promotionService.GetByIdAsync(id, ct));

    /// <summary>Thêm khuyến mãi; BE sinh mã <c>KM</c> + 2 số.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Promotions.Create)]
    [ProducesResponseType<PromotionDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<PromotionDto>> Create(SavePromotionRequest request, CancellationToken ct)
    {
        var item = await promotionService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Promotions.Update)]
    [ProducesResponseType<PromotionDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PromotionDto>> Update(Guid id, SavePromotionRequest request, CancellationToken ct) =>
        Ok(await promotionService.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/pause")]
    [AuthorizePermission(ProjectPermissions.Promotions.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetPaused(Guid id, SetPausedRequest request, CancellationToken ct)
    {
        await promotionService.SetPausedAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Xóa mềm; hóa đơn cũ giữ tên đã chụp.</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Promotions.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await promotionService.DeleteAsync(id, ct);
        return NoContent();
    }
}
