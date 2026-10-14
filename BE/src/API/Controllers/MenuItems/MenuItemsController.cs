using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.MenuItems;
using Application.Interfaces.Services.MenuItems;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.MenuItems;

/// <summary>
/// Món (UC-01, UC-02, 07 §2.3). Danh sách lọc <c>categoryId</c>, <c>status</c>; mặc định sắp theo sortOrder tăng dần.
/// Trùng mã → 409 <c>errors.code</c>; xóa món đã bán → 400 (BR-18).
/// </summary>
[Route("api/menu-items")]
public sealed class MenuItemsController(IMenuItemService service)
    : CrudApiController<IMenuItemService, MenuItemDto, SaveMenuItemRequest, SaveMenuItemRequest, MenuItemQuery>(
        service, new CrudPermissions("menu-items"))
{
    /// <summary>Báo tạm hết, bán lại (FR-06); thu ngân cũng làm được.</summary>
    [HttpPatch("{id:guid}/availability")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Availability)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetAvailability(Guid id, SetAvailabilityRequest request, CancellationToken ct)
    {
        await Service.SetAvailabilityAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Ẩn, hiện món trên màn bán hàng.</summary>
    [HttpPatch("{id:guid}/hidden")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetHidden(Guid id, SetHiddenRequest request, CancellationToken ct)
    {
        await Service.SetHiddenAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Tải ảnh món: multipart, field <c>file</c>, JPG/PNG/WebP tối đa 2 MB → <c>{ imageUrl }</c>.</summary>
    [HttpPost("{id:guid}/image")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UploadLimits.MaxImageRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadLimits.MaxImageRequestBytes)]
    [ProducesResponseType<MenuItemImageResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MenuItemImageResult>> UploadImage(Guid id, IFormFile? file, CancellationToken ct)
    {
        await using var content = file?.OpenReadStream() ?? Stream.Null;
        return Ok(await Service.UploadImageAsync(id, content, file?.Length ?? 0, ct));
    }
}
