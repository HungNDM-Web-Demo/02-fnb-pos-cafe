using Application.DTOs.Orders;
using Application.DTOs.Shifts;
using Domain.Entities.Pos.Shifts;

namespace Application.Mappings.Shifts;

/// <summary>Ánh xạ viết tay cho ca làm.</summary>
public static class ShiftMappings
{
    public static ShiftDto ToDto(this Shift shift) => Fill(new ShiftDto(), shift);

    /// <remarks><c>liveTotals</c>: Số tổng hợp tạm thời khi ca đang mở (tính từ hóa đơn); null thì dùng số đã ghi lúc chốt.</remarks>
    public static ShiftListItem ToListItem(this Shift shift, Shift.Totals? liveTotals) => new()
    {
        Id = shift.Id,
        Code = shift.Code,
        Status = shift.Status,
        CashierName = shift.CashierName,
        OpenedAt = shift.OpenedAt,
        ClosedAt = shift.ClosedAt,
        OrderCount = liveTotals?.OrderCount ?? shift.OrderCount,
        Revenue = liveTotals?.Revenue ?? shift.CashSales + shift.TransferSales,
        ExpectedCash = shift.ExpectedCash,
        CountedCash = shift.CountedCash,
        Difference = shift.Difference
    };

    public static ShiftDetail ToDetail(this Shift shift, Shift.Totals totals, IReadOnlyList<OrderListItem> orders)
    {
        var dto = Fill(new ShiftDetail { Orders = orders, Revenue = totals.Revenue }, shift);
        return shift.IsOpen
            ? dto with
            {
                OrderCount = totals.OrderCount,
                CancelledOrderCount = totals.CancelledOrderCount,
                CashSales = totals.CashSales,
                TransferSales = totals.TransferSales,
                CashCancelled = totals.CashCancelled,
                ExpectedCash = Shift.ComputeExpectedCash(shift.OpeningCash, totals)
            }
            : dto;
    }

    public static ShiftSummary ToSummary(this Shift shift, Shift.Totals totals, IReadOnlyList<HeldOrderSummary> heldOrders) => new()
    {
        ShiftId = shift.Id,
        Code = shift.Code,
        OpenedAt = shift.OpenedAt,
        OpeningCash = shift.OpeningCash,
        OrderCount = totals.OrderCount,
        CancelledOrderCount = totals.CancelledOrderCount,
        CashSales = totals.CashSales,
        TransferSales = totals.TransferSales,
        CashCancelled = totals.CashCancelled,
        Revenue = totals.Revenue,
        ExpectedCash = Shift.ComputeExpectedCash(shift.OpeningCash, totals),
        HeldOrders = heldOrders
    };

    private static T Fill<T>(T dto, Shift shift)
        where T : ShiftDto => dto with
    {
        Id = shift.Id,
        Code = shift.Code,
        Status = shift.Status,
        CashierId = shift.CashierId,
        CashierName = shift.CashierName,
        OpenedAt = shift.OpenedAt,
        ClosedAt = shift.ClosedAt,
        OpeningCash = shift.OpeningCash,
        OrderCount = shift.OrderCount,
        CancelledOrderCount = shift.CancelledOrderCount,
        CashSales = shift.CashSales,
        TransferSales = shift.TransferSales,
        CashCancelled = shift.CashCancelled,
        ExpectedCash = shift.ExpectedCash,
        CountedCash = shift.CountedCash,
        Difference = shift.Difference,
        Note = shift.Note,
        ReviewNote = shift.ReviewNote,
        ReviewedByName = shift.ReviewedByName,
        ReviewedAt = shift.ReviewedAt
    };
}
