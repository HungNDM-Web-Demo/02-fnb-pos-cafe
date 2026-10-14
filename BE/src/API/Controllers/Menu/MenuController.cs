using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Menu;
using Application.Interfaces.Services.Menu;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Menu;

/// <summary>Thực đơn gộp cho màn bán hàng (FR-07, 07 §2.1).</summary>
[Route("api/menu")]
public sealed class MenuController(IMenuService menuService) : BaseApiController
{
    /// <summary>Danh mục, món, topping chưa ẩn trong một lần gọi; món tạm hết vẫn trả để hiện mờ (FR-06).</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Orders.Create, ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<MenuBundle>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MenuBundle>> Get(CancellationToken ct) => Ok(await menuService.GetBundleAsync(ct));
}
