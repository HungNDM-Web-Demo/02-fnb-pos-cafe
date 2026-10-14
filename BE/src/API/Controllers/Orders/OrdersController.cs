using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Orders;
using Application.Interfaces.Services.Orders;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Orders;

/// <summary>Bán hàng, hóa đơn, đơn giữ (UC-04..UC-09, 07 §2.5).</summary>
[Route("api/orders")]
public sealed class OrdersController(IOrderService orderService, IDiscountApprovalService discountApprovalService) : BaseApiController
{
    /// <summary>Tra cứu hóa đơn (FR-19). Không có <c>orders.view-all</c> thì chỉ thấy hóa đơn của mình; mặc định paidAt giảm dần.</summary>
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    [ProducesResponseType<PaginatedResult<OrderListItem>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<OrderListItem>>> GetAll([FromQuery] OrderQuery query, CancellationToken ct) =>
        Ok(await orderService.GetPagedAsync(query, ct));

    /// <summary>Chi tiết để xem và in (in lại: FE kiểm tra <c>orders.reprint</c>). Hóa đơn người khác không có view-all → 403.</summary>
    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Orders.View)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await orderService.GetByIdAsync(id, ct));

    /// <summary>Mã hóa đơn dự kiến cho nội dung QR (UC-07 2a); mã thật gán lúc thanh toán.</summary>
    [HttpGet("next-code")]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<NextCodeResult>(StatusCodes.Status200OK)]
    public async Task<ActionResult<NextCodeResult>> GetNextCode(CancellationToken ct) =>
        Ok(await orderService.GetNextCodeAsync(ct));

    /// <summary>Thanh toán (UC-07): 201 hóa đơn mới; cùng <c>clientRequestId</c> gửi lại → 200 hóa đơn cũ (TC-24).</summary>
    /// <remarks>Tổng BE tính khác <c>expectedTotal</c> → 409 kèm <c>serverTotal</c>. Vượt hạn mức 10% không có token → 400 kèm <c>discountLimit</c>, <c>requestedDiscount</c>.</remarks>
    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> Checkout(CheckoutRequest request, CancellationToken ct)
    {
        // Giảm giá dòng/hóa đơn, voucher cần orders.discount (BR-04).
        if ((request.OrderDiscount is not null || request.Items.Any(i => i.Discount is not null) || !string.IsNullOrWhiteSpace(request.VoucherCode))
            && await PermissionGuard.CheckAsync(HttpContext, [ProjectPermissions.Orders.Discount]) is { } forbidden)
        {
            return (ActionResult)forbidden;
        }

        var result = await orderService.CheckoutAsync(request, ct);
        return result.Created
            ? CreatedAtAction(nameof(GetById), new { id = result.Order.Id }, result.Order)
            : Ok(result.Order);
    }

    /// <summary>Hủy hóa đơn trong ca đang mở (UC-08, BR-13): trả lượt voucher, trừ điểm khách.</summary>
    [HttpPost("{id:guid}/cancel")]
    [AuthorizePermission(ProjectPermissions.Orders.Cancel)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OrderDto>> Cancel(Guid id, CancelOrderRequest request, CancellationToken ct) =>
        Ok(await orderService.CancelAsync(id, request, ct));

    /// <summary>Đơn giữ của thu ngân hiện tại trong ca đang mở, mới nhất trước.</summary>
    [HttpGet("held")]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<IReadOnlyList<HeldOrderDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<HeldOrderDto>>> GetHeld(CancellationToken ct) =>
        Ok(await orderService.GetHeldAsync(ct));

    /// <summary>Giữ đơn (UC-05); quá 10 đơn → 400 (BR-15).</summary>
    [HttpPost("held")]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<HeldOrderDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<HeldOrderDto>> Hold(HoldOrderRequest request, CancellationToken ct)
    {
        var held = await orderService.HoldAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = held.Id }, held);
    }

    [HttpPut("held/{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType<HeldOrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HeldOrderDto>> UpdateHeld(Guid id, HoldOrderRequest request, CancellationToken ct) =>
        Ok(await orderService.UpdateHeldAsync(id, request, ct));

    [HttpDelete("held/{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Orders.Create)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteHeld(Guid id, CancellationToken ct)
    {
        await orderService.DeleteHeldAsync(id, ct);
        return NoContent();
    }

    /// <summary>Quản lý xác nhận giảm giá vượt hạn mức ngay trên tablet (FR-15): token 5 phút, dùng một lần.</summary>
    /// <remarks>Sai tên/mật khẩu → 400 (không dùng 401); không có <c>orders.discount-override</c> → 403 (TC-18).</remarks>
    [HttpPost("discount-approvals")]
    [AuthorizePermission(ProjectPermissions.Orders.Discount)]
    [ProducesResponseType<DiscountApprovalDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<DiscountApprovalDto>> ApproveDiscount(DiscountApprovalRequest request, CancellationToken ct) =>
        Ok(await discountApprovalService.ApproveAsync(request, ct));
}
