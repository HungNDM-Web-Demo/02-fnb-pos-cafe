using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.Reports;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Reports;
using Application.Mappings.Orders;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Shifts;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Reports;

/// <summary>
/// Tổng quan và báo cáo (UC-12, UC-14, 07 §2.8). Chỉ hóa đơn <see cref="OrderStatus.DaThanhToan"/> theo <c>paidAt</c> (BR-16);
/// doanh thu = Σ total. Dữ liệu demo nhỏ (vài nghìn hóa đơn) nên gom nhóm trong bộ nhớ sau khi lọc theo khoảng ngày.
/// </summary>
public sealed class ReportService(
    IGenericRepository<Order> orders,
    IGenericRepository<Shift> shifts,
    IGenericRepository<Category> categories,
    TimeProvider timeProvider) : IReportService
{
    private const int DashboardTopItems = 5;
    private const int DefaultTopItems = 20;

    private sealed record PaidOrder(Guid Id, DateTime PaidAt, decimal Total, decimal DiscountTotal, Guid CashierId, string CashierName, PaymentMethod Method);

    public async Task<DashboardReport> GetDashboardAsync(CancellationToken ct = default)
    {
        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;
        var today = VietnamDates.Today(timeProvider);
        var timeOfDay = VietnamDates.ToVietnam(nowUtc).TimeOfDay;

        var todayOrders = await PaidOrdersAsync(VietnamDates.StartOfDayUtc(today), VietnamDates.EndOfDayExclusiveUtc(today), ct);
        var yesterdayStart = VietnamDates.StartOfDayUtc(today.AddDays(-1));
        var yesterday = await PaidOrdersAsync(yesterdayStart, yesterdayStart.Add(timeOfDay), ct);

        var revenue = todayOrders.Sum(o => o.Total);
        var yesterdayRevenue = yesterday.Sum(o => o.Total);

        var hourly = todayOrders
            .GroupBy(o => VietnamDates.ToVietnam(o.PaidAt).Hour)
            .ToDictionary(g => g.Key, g => (Revenue: g.Sum(o => o.Total), Count: g.Count()));

        var todayIds = todayOrders.Select(o => o.Id).ToList();
        var topItems = await orders.QueryNoTracking()
            .Where(o => todayIds.Contains(o.Id))
            .SelectMany(o => o.Items)
            .GroupBy(i => new { i.MenuItemId, i.ItemCode, i.ItemName })
            .Select(g => new DashboardTopItem
            {
                MenuItemId = g.Key.MenuItemId,
                Code = g.Key.ItemCode,
                Name = g.Key.ItemName,
                Quantity = g.Sum(i => i.Quantity),
                Revenue = g.Sum(i => i.LineTotal - i.DiscountAmount - i.PromotionDiscount)
            })
            .ToListAsync(ct);

        var openShifts = await shifts.QueryNoTracking()
            .Where(s => s.Status == ShiftStatus.DangMo)
            .OrderBy(s => s.OpenedAt)
            .Select(s => new OpenShiftItem { Id = s.Id, Code = s.Code, CashierName = s.CashierName, OpenedAt = s.OpenedAt })
            .ToListAsync(ct);

        return new DashboardReport
        {
            Date = VietnamDates.Format(today),
            AsOf = nowUtc,
            Revenue = revenue,
            OrderCount = todayOrders.Count,
            AvgOrderValue = todayOrders.Count == 0 ? 0 : Math.Round(revenue / todayOrders.Count, 0),
            YesterdaySameTime = new RevenuePoint { Revenue = yesterdayRevenue, OrderCount = yesterday.Count },
            RevenueChangePercent = ChangePercent(revenue, yesterdayRevenue),
            Hourly = Enumerable.Range(0, 24)
                .Select(h => new HourlyRevenue
                {
                    Hour = h,
                    Revenue = hourly.GetValueOrDefault(h).Revenue,
                    OrderCount = hourly.GetValueOrDefault(h).Count
                })
                .ToList(),
            TopItems = topItems.OrderByDescending(i => i.Quantity).ThenByDescending(i => i.Revenue).ThenBy(i => i.Code).Take(DashboardTopItems).ToList(),
            OpenShifts = openShifts
        };
    }

    public async Task<RevenueReport> GetRevenueAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = query.Resolve(timeProvider);
        var days = to.DayNumber - from.DayNumber + 1;
        var previousTo = from.AddDays(-1);
        var previousFrom = previousTo.AddDays(-(days - 1));

        var current = await PaidOrdersAsync(VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to), ct);
        var previous = await PaidOrdersAsync(VietnamDates.StartOfDayUtc(previousFrom), VietnamDates.EndOfDayExclusiveUtc(previousTo), ct);

        var byDay = current.GroupBy(o => VietnamDates.DateOf(o.PaidAt)).ToDictionary(g => g.Key, g => g.ToList());
        var previousByDay = previous.GroupBy(o => VietnamDates.DateOf(o.PaidAt)).ToDictionary(g => g.Key, g => g.Sum(o => o.Total));

        var revenue = current.Sum(o => o.Total);
        var previousRevenue = previous.Sum(o => o.Total);

        return new RevenueReport
        {
            From = VietnamDates.Format(from),
            To = VietnamDates.Format(to),
            Totals = new RevenueTotals
            {
                Revenue = revenue,
                OrderCount = current.Count,
                Discount = current.Sum(o => o.DiscountTotal),
                AvgOrderValue = current.Count == 0 ? 0 : Math.Round(revenue / current.Count, 0)
            },
            Previous = new PreviousPeriod
            {
                From = VietnamDates.Format(previousFrom),
                To = VietnamDates.Format(previousTo),
                Revenue = previousRevenue,
                OrderCount = previous.Count,
                Discount = previous.Sum(o => o.DiscountTotal)
            },
            RevenueChangePercent = ChangePercent(revenue, previousRevenue),
            Daily = Enumerable.Range(0, days)
                .Select(i =>
                {
                    var date = from.AddDays(i);
                    var dayOrders = byDay.GetValueOrDefault(date) ?? [];
                    return new DailyRevenue
                    {
                        Date = VietnamDates.Format(date),
                        Revenue = dayOrders.Sum(o => o.Total),
                        OrderCount = dayOrders.Count,
                        Discount = dayOrders.Sum(o => o.DiscountTotal),
                        PreviousRevenue = previousByDay.GetValueOrDefault(previousFrom.AddDays(i))
                    };
                })
                .ToList()
        };
    }

    public async Task<TopItemsReport> GetTopItemsAsync(TopItemsQuery query, CancellationToken ct = default)
    {
        var (from, to) = query.Resolve(timeProvider);
        var fromUtc = VietnamDates.StartOfDayUtc(from);
        var toUtc = VietnamDates.EndOfDayExclusiveUtc(to);

        var items = orders.QueryNoTracking()
            .Where(o => o.Status == OrderStatus.DaThanhToan && o.PaidAt >= fromUtc && o.PaidAt < toUtc)
            .SelectMany(o => o.Items);
        if (query.CategoryId is { } categoryId)
            items = items.Where(i => i.CategoryId == categoryId);

        var rows = await items
            .GroupBy(i => new { i.MenuItemId, i.ItemCode, i.ItemName, i.CategoryId })
            .Select(g => new
            {
                g.Key.MenuItemId,
                g.Key.ItemCode,
                g.Key.ItemName,
                g.Key.CategoryId,
                Quantity = g.Sum(i => i.Quantity),
                Revenue = g.Sum(i => i.LineTotal - i.DiscountAmount - i.PromotionDiscount)
            })
            .ToListAsync(ct);

        var categoryNames = await categories.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var totalQuantity = rows.Sum(r => r.Quantity);
        var totalRevenue = rows.Sum(r => r.Revenue);

        return new TopItemsReport
        {
            TotalQuantity = totalQuantity,
            TotalRevenue = totalRevenue,
            Items = rows
                .OrderByDescending(r => r.Quantity).ThenByDescending(r => r.Revenue).ThenBy(r => r.ItemCode)
                .Take(query.Limit ?? DefaultTopItems)
                .Select(r => new TopItemRow
                {
                    MenuItemId = r.MenuItemId,
                    Code = r.ItemCode,
                    Name = r.ItemName,
                    CategoryId = r.CategoryId,
                    CategoryName = categoryNames.GetValueOrDefault(r.CategoryId) ?? string.Empty,
                    Quantity = r.Quantity,
                    Revenue = r.Revenue,
                    Share = totalRevenue == 0 ? 0 : Math.Round(r.Revenue / totalRevenue * 100, 1)
                })
                .ToList()
        };
    }

    public async Task<HeatmapReport> GetHeatmapAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = query.Resolve(timeProvider);
        var list = await PaidOrdersAsync(VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to), ct);

        var cells = list
            .Select(o => VietnamDates.ToVietnam(o.PaidAt))
            .Zip(list, (local, o) => (Day: Promotion.IsoDayOfWeek(local.DayOfWeek), local.Hour, o.Total))
            .GroupBy(x => (x.Day, x.Hour))
            .ToDictionary(g => g.Key, g => (Revenue: g.Sum(x => x.Total), Count: g.Count()));

        var all = Enumerable.Range(1, 7)
            .SelectMany(day => Enumerable.Range(0, 24).Select(hour => new HeatmapCell
            {
                DayOfWeek = day,
                Hour = hour,
                Revenue = cells.GetValueOrDefault((day, hour)).Revenue,
                OrderCount = cells.GetValueOrDefault((day, hour)).Count
            }))
            .ToList();

        return new HeatmapReport { Cells = all, MaxRevenue = all.Count == 0 ? 0 : all.Max(c => c.Revenue) };
    }

    public async Task<PaymentMethodReport> GetPaymentMethodsAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = query.Resolve(timeProvider);
        var list = await PaidOrdersAsync(VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to), ct);
        var total = list.Sum(o => o.Total);

        return new PaymentMethodReport
        {
            Items = new[] { PaymentMethod.TienMat, PaymentMethod.ChuyenKhoan }
                .Select(method =>
                {
                    var rows = list.Where(o => o.Method == method).ToList();
                    var amount = rows.Sum(o => o.Total);
                    return new PaymentMethodRow
                    {
                        Method = method,
                        Amount = amount,
                        OrderCount = rows.Count,
                        Share = total == 0 ? 0 : Math.Round(amount / total * 100, 1)
                    };
                })
                .ToList()
        };
    }

    public async Task<CashierReport> GetCashiersAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = query.Resolve(timeProvider);
        var fromUtc = VietnamDates.StartOfDayUtc(from);
        var toUtc = VietnamDates.EndOfDayExclusiveUtc(to);

        var paid = await PaidOrdersAsync(fromUtc, toUtc, ct);
        var shiftRows = await shifts.QueryNoTracking()
            .Where(s => s.OpenedAt >= fromUtc && s.OpenedAt < toUtc)
            .Select(s => new { s.CashierId, s.CashierName, s.Difference, s.Status })
            .ToListAsync(ct);

        var cashierIds = paid.Select(o => o.CashierId).Concat(shiftRows.Select(s => s.CashierId)).Distinct().ToList();
        var names = shiftRows.GroupBy(s => s.CashierId).ToDictionary(g => g.Key, g => g.First().CashierName);
        foreach (var o in paid.Where(o => !names.ContainsKey(o.CashierId)))
            names[o.CashierId] = o.CashierName;

        var items = cashierIds
            .Select(id =>
            {
                var cashierShifts = shiftRows.Where(s => s.CashierId == id).ToList();
                var cashierOrders = paid.Where(o => o.CashierId == id).ToList();
                return new CashierRow
                {
                    CashierId = id,
                    CashierName = names.GetValueOrDefault(id) ?? string.Empty,
                    ShiftCount = cashierShifts.Count,
                    OrderCount = cashierOrders.Count,
                    Revenue = cashierOrders.Sum(o => o.Total),
                    TotalDifference = cashierShifts.Sum(s => s.Difference ?? 0),
                    ShiftsNeedingReview = cashierShifts.Count(s => s.Status == ShiftStatus.CanKiemTra)
                };
            })
            .OrderByDescending(r => r.Revenue)
            .ThenBy(r => r.CashierName, StringComparer.Ordinal)
            .ToList();

        return new CashierReport { Items = items };
    }

    public async Task<PaginatedResult<CancelledOrderItem>> GetCancelledOrdersAsync(CancelledOrdersQuery query, CancellationToken ct = default)
    {
        var (from, to) = query.Resolve(timeProvider);
        var fromUtc = VietnamDates.StartOfDayUtc(from);
        var toUtc = VietnamDates.EndOfDayExclusiveUtc(to);

        var page = await orders.QueryNoTracking()
            .Include(o => o.Payment)
            .Where(o => o.Status == OrderStatus.DaHuy && o.CancelledAt >= fromUtc && o.CancelledAt < toUtc)
            .OrderByDescending(o => o.CancelledAt)
            .ThenBy(o => o.Id)
            .ToPaginatedResultAsync(query.ToPagination(), ct);

        return page.Map(items => items.Select(o => o.ToCancelledItem()).ToList());
    }

    private async Task<List<PaidOrder>> PaidOrdersAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct) =>
        await orders.QueryNoTracking()
            .Where(o => o.Status == OrderStatus.DaThanhToan && o.PaidAt >= fromUtc && o.PaidAt < toUtc)
            .Select(o => new PaidOrder(o.Id, o.PaidAt!.Value, o.Total, o.DiscountTotal, o.CashierId, o.CashierName, o.Payment!.Method))
            .ToListAsync(ct);

    private static decimal? ChangePercent(decimal current, decimal previous) =>
        previous == 0 ? null : Math.Round((current - previous) / previous * 100, 1);
}
