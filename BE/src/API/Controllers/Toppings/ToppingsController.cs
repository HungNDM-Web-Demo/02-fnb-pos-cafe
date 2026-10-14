using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.MenuItems;
using Application.DTOs.Toppings;
using Application.Interfaces.Services.Toppings;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Toppings;

/// <summary>Topping (UC-01 1b, FR-05, 07 §2.4).</summary>
[Route("api/toppings")]
public sealed class ToppingsController(IToppingService toppingService) : BaseApiController
{
    /// <summary>Tất cả topping theo sortOrder.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<IReadOnlyList<ToppingDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ToppingDto>>> GetAll(CancellationToken ct) =>
        Ok(await toppingService.GetListAsync(ct));

    /// <summary>Thêm topping; trùng mã → 409 <c>errors.code</c>.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.MenuItems.Create)]
    [ProducesResponseType<ToppingDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<ToppingDto>> Create(SaveToppingRequest request, CancellationToken ct)
    {
        var item = await toppingService.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, item);
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType<ToppingDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ToppingDto>> Update(Guid id, SaveToppingRequest request, CancellationToken ct) =>
        Ok(await toppingService.UpdateAsync(id, request, ct));

    /// <summary>Báo tạm hết, bán lại; áp cho mọi món (TC-04).</summary>
    [HttpPatch("{id:guid}/availability")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Availability)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetAvailability(Guid id, SetAvailabilityRequest request, CancellationToken ct)
    {
        await toppingService.SetAvailabilityAsync(id, request, ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/hidden")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetHidden(Guid id, SetHiddenRequest request, CancellationToken ct)
    {
        await toppingService.SetHiddenAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Chưa từng bán → 204; đã bán → 400 "Topping đã có trong hóa đơn, chỉ có thể ẩn".</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await toppingService.DeleteAsync(id, ct);
        return NoContent();
    }
}
