using Application.Interfaces.Services.Shifts;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Entities.Pos.Shifts;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Shifts;
using Infrastructure.Persistence.Seeders;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using UnitTests.TestSupport;

namespace UnitTests.Pos;

/// <summary>
/// demo-data.json nạp qua DemoDataSeeder thật: số liệu khớp 06-THIET-KE-CSDL §5.4 (cùng số với script FE sinh dữ liệu),
/// ràng buộc test 06 §5.3, và đặt lại dữ liệu cho cùng kết quả.
/// </summary>
public sealed class PosSeedTests : IAsyncLifetime
{
    private PosTestHost _host = null!;

    public async Task InitializeAsync() => _host = await PosTestHost.StartAsync();

    public async Task DisposeAsync() => await _host.DisposeAsync();

    [Fact]
    public async Task Seed_MatchesDesignReport()
    {
        var orders = await _host.QueryAsync<Order, List<(OrderStatus Status, decimal Subtotal, string? Approver, bool Manual)>>(q => q
            .Select(o => new { o.Status, o.Subtotal, o.DiscountApprovedByName, Manual = o.OrderDiscountType != null })
            .ToListAsync()
            .ContinueWith(t => t.Result.Select(x => (x.Status, x.Subtotal, x.DiscountApprovedByName, x.Manual)).ToList()));

        Assert.Equal(3019, orders.Count);
        Assert.Equal(2840, orders.Count(o => o.Status == OrderStatus.DaThanhToan));
        Assert.Equal(179, orders.Count(o => o.Status == OrderStatus.DaHuy));
        Assert.Equal(239_446_000m, orders.Where(o => o.Status == OrderStatus.DaThanhToan).Sum(o => o.Subtotal));
        Assert.Equal(184, orders.Count(o => o.Manual));
        Assert.Equal(25, orders.Count(o => o.Approver == "quanly"));

        Assert.Equal(5694, await _host.QueryAsync<OrderItem, int>(q => q.CountAsync()));
        Assert.Equal(1882, await _host.QueryAsync<OrderItemTopping, int>(q => q.CountAsync()));
        Assert.Equal(3019, await _host.QueryAsync<Payment, int>(q => q.CountAsync()));

        var used = await _host.QueryAsync<Voucher, Dictionary<string, string>>(q =>
            q.ToDictionaryAsync(v => v.Code, v => $"{v.UsedCount}/{v.MaxUses}"));
        Assert.Equal("40/100", used["GIAM20K"]);
        Assert.Equal("44/50", used["HETHAN"]);
        Assert.Equal("57/200", used["TANGBAN"]);
        Assert.Equal("3/20", used["SINHNHAT"]);
        Assert.Equal("5/5", used["HETLUOT"]);
    }

    [Fact]
    public async Task Seed_MenuAndMasterDataCounts()
    {
        Assert.Equal(6, await _host.QueryAsync<Category, int>(q => q.CountAsync()));
        Assert.Equal(40, await _host.QueryAsync<MenuItem, int>(q => q.CountAsync()));
        Assert.Equal(78, await _host.QueryAsync<MenuItemSize, int>(q => q.CountAsync()));
        Assert.Equal(12, await _host.QueryAsync<Topping, int>(q => q.CountAsync()));
        Assert.Equal(191, await _host.RunAsync(sp => sp.GetRequiredService<Infrastructure.Persistence.AppDbContext>().Set<MenuItemTopping>().CountAsync()));
        Assert.Equal(5, await _host.QueryAsync<Promotion, int>(q => q.CountAsync()));
        Assert.Equal(5, await _host.QueryAsync<Voucher, int>(q => q.CountAsync()));
        Assert.Equal(10, await _host.QueryAsync<Customer, int>(q => q.CountAsync()));

        // 06 §5.3: TC-13 dùng M009 L 42.000, Trân châu 5.000, Thạch dừa 7.000.
        var m009 = await _host.QueryAsync<MenuItem, MenuItem>(q => q.SingleAsync(m => m.Code == "M009"));
        Assert.Equal("Trà sữa trân châu", m009.Name);
        Assert.Equal(42_000m, m009.FindSize("L")!.Price);
        Assert.Equal("/seed/menu/M009.webp", m009.ImageUrl);
    }

    [Fact]
    public async Task Seed_Shifts_ElevenNeedReview_TodayMorningClosed()
    {
        var shifts = await _host.QueryAsync<Shift, List<Shift>>(q => q.ToListAsync());

        Assert.Equal(179, shifts.Count);
        Assert.Equal(1, shifts.Count(s => s.Status == ShiftStatus.CanKiemTra));
        Assert.Equal(10, shifts.Count(s => s.Status == ShiftStatus.DaKiemTra));
        Assert.All(shifts.Where(s => s.Status == ShiftStatus.DaKiemTra), s => Assert.Equal("quanly", s.ReviewedByName));
        Assert.DoesNotContain(shifts, s => s.Status == ShiftStatus.DangMo);

        // Ca sáng hôm qua lệch −70.000 chưa xử lý (TC-11); ca sáng hôm nay mã CA26101401 đã chốt (TC-06).
        var needReview = shifts.Single(s => s.Status == ShiftStatus.CanKiemTra);
        Assert.Equal(("CA26101301", -70_000m), (needReview.Code, needReview.Difference!.Value));
        Assert.Equal(needReview.ExpectedCash + needReview.Difference, needReview.CountedCash);
        Assert.Equal(ShiftStatus.DaChot, shifts.Single(s => s.Code == "CA26101401").Status);

        // Số tổng hợp ca khớp hóa đơn trong ca: tiền mặt lý thuyết = tiền đầu ca + tiền mặt (BR-11).
        var orders = await _host.QueryAsync<Order, List<(Guid ShiftId, OrderStatus Status, decimal Total, PaymentMethod Method)>>(q => q
            .Select(o => new { o.ShiftId, o.Status, o.Total, o.Payment!.Method }).ToListAsync()
            .ContinueWith(t => t.Result.Select(x => (x.ShiftId, x.Status, x.Total, x.Method)).ToList()));
        foreach (var shift in shifts)
        {
            var mine = orders.Where(o => o.ShiftId == shift.Id && o.Status == OrderStatus.DaThanhToan).ToList();
            Assert.Equal(mine.Count, shift.OrderCount);
            Assert.Equal(mine.Where(o => o.Method == PaymentMethod.TienMat).Sum(o => o.Total), shift.CashSales);
            Assert.Equal(shift.OpeningCash + shift.CashSales, shift.ExpectedCash);
        }
    }

    [Fact]
    public async Task Seed_OrderCodesFollowPaidAtWithinDay_TodayHasOrders()
    {
        var today = await _host.QueryAsync<Order, List<(string Code, DateTime PaidAt)>>(q => q
            .Where(o => o.Code!.StartsWith("HD261014"))
            .OrderBy(o => o.Code)
            .Select(o => new { o.Code, o.PaidAt })
            .ToListAsync()
            .ContinueWith(t => t.Result.Select(x => (x.Code!, x.PaidAt!.Value)).ToList()));

        Assert.Equal(12, today.Count);
        Assert.Equal("HD2610140001", today[0].Code);
        Assert.Equal(today.Select(o => o.PaidAt).Order(), today.Select(o => o.PaidAt));

        // thungan chưa có ca đang mở (TC-06, TC-07).
        await _host.SignInAsync("thungan");
        Assert.Null(await _host.CallAsync<IShiftService, Application.DTOs.Shifts.ShiftDto?>(s => s.GetCurrentAsync()));
    }

    [Fact]
    public async Task Seed_CustomerTotalsComputedFromOrders()
    {
        var customers = await _host.QueryAsync<Customer, List<Customer>>(q => q.ToListAsync());
        var orders = await _host.QueryAsync<Order, List<(Guid? CustomerId, OrderStatus Status, decimal Total, int Points)>>(q => q
            .Where(o => o.CustomerId != null)
            .Select(o => new { o.CustomerId, o.Status, o.Total, o.PointsEarned }).ToListAsync()
            .ContinueWith(t => t.Result.Select(x => (x.CustomerId, x.Status, x.Total, x.PointsEarned)).ToList()));

        foreach (var customer in customers)
        {
            var paid = orders.Where(o => o.CustomerId == customer.Id && o.Status == OrderStatus.DaThanhToan).ToList();
            Assert.Equal(paid.Count, customer.OrderCount);
            Assert.Equal(paid.Sum(o => o.Total), customer.TotalSpent);
            Assert.Equal(paid.Sum(o => o.Points), customer.Points);
        }

        Assert.True(customers.Sum(c => c.OrderCount) > 0);
    }

    [Fact]
    public async Task Reset_ClearsAndReseedsSameNumbers()
    {
        await _host.RunAsync(sp => sp.GetRequiredService<DemoDataResetter>().ResetAsync());

        Assert.Equal(3019, await _host.QueryAsync<Order, int>(q => q.CountAsync()));
        Assert.Equal(239_446_000m, await _host.QueryAsync<Order, decimal>(q =>
            q.Where(o => o.Status == OrderStatus.DaThanhToan).Select(o => o.Subtotal).ToListAsync().ContinueWith(t => t.Result.Sum())));
        Assert.Equal(179, await _host.QueryAsync<Shift, int>(q => q.CountAsync()));
        Assert.Equal(40, await _host.QueryAsync<Voucher, int>(q => q.Where(v => v.Code == "GIAM20K").Select(v => v.UsedCount).SingleAsync()));
    }
}
