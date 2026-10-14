using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Categories;
using Application.Interfaces.Services.Categories;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Categories;

/// <summary>Danh mục món (UC-01 1a, FR-03, 07 §2.2).</summary>
[Route("api/categories")]
public sealed class CategoriesController(ICategoryService categoryService) : BaseApiController
{
    /// <summary>Tất cả danh mục (kể cả ẩn) theo sortOrder, kèm số món.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<IReadOnlyList<CategoryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll(CancellationToken ct) =>
        Ok(await categoryService.GetListAsync(ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.View)]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await categoryService.GetByIdAsync(id, ct));

    /// <summary>Thêm danh mục, xếp cuối. Trùng mã → 409 <c>errors.code</c>.</summary>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.MenuItems.Create)]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CategoryDto>> Create(SaveCategoryRequest request, CancellationToken ct)
    {
        var item = await categoryService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    /// <summary>Sửa mã, tên, màu, ẩn/hiện.</summary>
    [HttpPut("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CategoryDto>> Update(Guid id, SaveCategoryRequest request, CancellationToken ct) =>
        Ok(await categoryService.UpdateAsync(id, request, ct));

    /// <summary>Sắp xếp: toàn bộ id theo thứ tự mới, đánh lại 10, 20, 30…; thiếu/thừa id → 400 <c>errors.ids</c>.</summary>
    [HttpPut("order")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reorder(ReorderCategoriesRequest request, CancellationToken ct)
    {
        await categoryService.ReorderAsync(request, ct);
        return NoContent();
    }

    /// <summary>Chỉ xóa được danh mục không còn món; còn món → 400 kèm <c>itemCount</c>.</summary>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.MenuItems.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await categoryService.DeleteAsync(id, ct);
        return NoContent();
    }
}
