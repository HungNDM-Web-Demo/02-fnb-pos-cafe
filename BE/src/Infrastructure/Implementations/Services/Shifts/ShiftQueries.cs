using Application.Common.Time;
using Application.Interfaces.Repositories;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Shifts;

/// <summary>Truy vấn dùng chung về ca: ca đang mở của thu ngân, số tổng hợp tính từ hóa đơn (06 §4, 07 §2.6).</summary>
internal static class ShiftQueries
{
    public const string NoOpenShiftMessage = "Chưa mở ca, mở ca trước khi bán hàng";
    public const string NotFoundMessage = "Không tìm thấy ca.";
    public const string CodePrefix = "CA";

    public static Task<Shift?> OpenShiftOfAsync(IGenericRepository<Shift> shifts, Guid cashierId, bool tracking, CancellationToken ct) =>
        (tracking ? shifts.Query() : shifts.QueryNoTracking())
            .Where(s => s.CashierId == cashierId && s.Status == Domain.Enums.Pos.Shifts.ShiftStatus.DangMo)
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync(ct);

    /// <summary>Số tổng hợp của một ca từ hóa đơn đã thanh toán và đã hủy (không gồm đơn giữ).</summary>
    public static async Task<Shift.Totals> TotalsAsync(IGenericRepository<Order> orders, Guid shiftId, CancellationToken ct) =>
        (await TotalsByShiftAsync(orders, [shiftId], ct)).GetValueOrDefault(shiftId, new Shift.Totals(0, 0, 0, 0, 0));

    public static async Task<Dictionary<Guid, Shift.Totals>> TotalsByShiftAsync(
        IGenericRepository<Order> orders,
        IReadOnlyCollection<Guid> shiftIds,
        CancellationToken ct)
    {
        var rows = await orders.QueryNoTracking()
            .Where(o => shiftIds.Contains(o.ShiftId) && o.Status != OrderStatus.DangGiu)
            .Select(o => new { o.ShiftId, o.Status, o.Total, Method = o.Payment!.Method })
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.ShiftId)
            .ToDictionary(g => g.Key, g =>
            {
                var paid = g.Where(r => r.Status == OrderStatus.DaThanhToan).ToList();
                var cancelled = g.Where(r => r.Status == OrderStatus.DaHuy).ToList();
                return new Shift.Totals(
                    paid.Count,
                    cancelled.Count,
                    paid.Where(r => r.Method == PaymentMethod.TienMat).Sum(r => r.Total),
                    paid.Where(r => r.Method == PaymentMethod.ChuyenKhoan).Sum(r => r.Total),
                    cancelled.Where(r => r.Method == PaymentMethod.TienMat).Sum(r => r.Total));
            });
    }

    public static Shift.Totals StoredTotals(Shift shift) =>
        new(shift.OrderCount, shift.CancelledOrderCount, shift.CashSales, shift.TransferSales, shift.CashCancelled);

    /// <summary>Mã ca <c>CA</c> + <c>yyMMdd</c> + 2 số thứ tự ca mở trong ngày (mọi thu ngân).</summary>
    public static async Task<string> NextCodeAsync(IGenericRepository<Shift> shifts, DateTime openedAtUtc, CancellationToken ct)
    {
        var prefix = CodePrefix + VietnamDates.DateOf(openedAtUtc).ToString("yyMMdd", System.Globalization.CultureInfo.InvariantCulture);
        var count = await shifts.QueryNoTracking().CountAsync(s => s.Code.StartsWith(prefix), ct);
        return prefix + (count + 1).ToString("00", System.Globalization.CultureInfo.InvariantCulture);
    }
}
