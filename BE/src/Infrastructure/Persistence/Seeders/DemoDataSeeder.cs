using System.Globalization;
using Application.Common.Time;
using Application.DTOs.Orders;
using Domain.Base;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Entities.Pos.Shifts;
using Domain.Entities.System.Users;
using Domain.Enums.Pos.Orders;
using Infrastructure.Implementations.Services.MenuItems;
using Infrastructure.Implementations.Services.Orders;
using Infrastructure.Implementations.Services.Shifts;
using Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Dữ liệu nghiệp vụ mẫu của POS Quán Cafe (bảng <c>Pos_*</c>, <c>Crm_*</c>), đọc từ <c>FE/src/mock/seed/demo-data.json</c>
/// (nguồn duy nhất, FE mock nạp cùng file; cấu trúc và cách suy ra trường: 06 §5.2).
/// </summary>
/// <remarks>
/// <list type="bullet">
/// <item>Tiền của hóa đơn không ghi trong file: tính lại bằng <see cref="OrderPricing"/> (07 §3) với giá trong file,
/// khuyến mãi tự áp theo giờ thanh toán, voucher theo lượt dùng tích lũy.</item>
/// <item>Mã hóa đơn <c>HD</c> + <c>yyMMdd</c> + số thứ tự theo giờ thanh toán trong ngày; mã ca <c>CA</c> + <c>yyMMdd</c> + seq.</item>
/// <item>Số tổng hợp ca, lượt dùng voucher, điểm khách tính từ hóa đơn; ca có <c>review</c> được <c>quanly</c> kiểm tra lúc 09:00 ngày sau.</item>
/// <item>Thu ngân, người duyệt, người hủy tra theo tên đăng nhập trong <c>System_Users</c>; không có thì dùng <c>thungan</c>.</item>
/// </list>
/// Số liệu kết quả phải khớp 06 §5.4 (test <c>PosSeedTests</c>).
/// </remarks>
public sealed class DemoDataSeeder(
    AppDbContext db,
    TimeProvider timeProvider,
    IOptions<FileStorageOptions> fileStorageOptions,
    ILogger<DemoDataSeeder> logger) : IDemoDataSeeder
{
    public const string SeedFileName = "demo-data.json";

    private const string DefaultCashier = "thungan";
    private const string ImageFolder = "/seed/menu/";
    private static readonly TimeSpan MasterDataCreatedAt = new(8, 0, 0);
    private static readonly TimeSpan ReviewTime = new(9, 0, 0);
    private static readonly TimeSpan EndOfDay = new(23, 59, 59);

    public async Task<bool> HasDataAsync(CancellationToken ct = default) =>
        await db.Set<Category>().IgnoreQueryFilters().AnyAsync(ct) || await db.Set<Order>().AnyAsync(ct);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var seed = SeedJson.Read<PosSeedFile>(SeedFileName, timeProvider);
        var users = await LoadUsersAsync(ct);
        var store = await LoadStoreAsync(ct);
        var createdAt = SeedDates.DaysAgo(timeProvider, 100, MasterDataCreatedAt);

        var categories = SeedCategories(seed.Categories ?? [], createdAt);
        var toppings = SeedToppings(seed.Toppings ?? [], createdAt);
        var items = SeedMenuItems(seed.MenuItems ?? [], categories, toppings, createdAt);
        var promotions = SeedPromotions(seed.Promotions ?? [], categories, items, createdAt);
        var vouchers = SeedVouchers(seed.Vouchers ?? [], createdAt);
        var customers = SeedCustomers(seed.Customers ?? []);
        var shifts = SeedShifts(seed.Shifts ?? [], users);
        var stats = SeedOrders(seed.Orders ?? [], shifts, items, toppings, promotions, vouchers, customers, users, store);
        CloseShifts(seed.Shifts ?? [], shifts, stats.TotalsByShift, users);

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Đã nạp dữ liệu mẫu: {Categories} danh mục, {Items} món, {Toppings} topping, {Shifts} ca, {Orders} hóa đơn ({Paid} đã thanh toán, {Cancelled} đã hủy), Σ tiền hàng {Subtotal:N0} ₫.",
            categories.Count, items.Count, toppings.Count, shifts.Count, stats.Orders, stats.Paid, stats.Cancelled, stats.PaidSubtotal);
    }

    public async Task ClearAsync(CancellationToken ct = default)
    {
        // Bảng con trước, bảng cha sau. ExecuteDelete xóa cứng, IgnoreQueryFilters để xóa cả bản ghi đã xóa mềm.
        await db.Set<OrderItemTopping>().ExecuteDeleteAsync(ct);
        await db.Set<OrderItem>().ExecuteDeleteAsync(ct);
        await db.Set<Payment>().ExecuteDeleteAsync(ct);
        await db.Set<Order>().ExecuteDeleteAsync(ct);
        await db.Set<Shift>().ExecuteDeleteAsync(ct);
        await db.Set<PromotionMenuItem>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Promotion>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Voucher>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<MenuItemTopping>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<MenuItemSize>().ExecuteDeleteAsync(ct);
        await db.Set<MenuItem>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Topping>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Category>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Customer>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);

        DeleteUploadedImages();
    }

    private sealed record SeedUser(Guid Id, string Username, string FullName);

    private sealed record StoreInfo(string BankBin, string BankAccount);

    private sealed class OrderStats
    {
        public int Orders;
        public int Paid;
        public int Cancelled;
        public decimal PaidSubtotal;
        public Dictionary<Guid, (int Paid, int Cancelled, decimal Cash, decimal Transfer, decimal CashCancelled)> Accumulators { get; } = [];

        public Dictionary<Guid, Shift.Totals> TotalsByShift =>
            Accumulators.ToDictionary(x => x.Key, x => new Shift.Totals(x.Value.Paid, x.Value.Cancelled, x.Value.Cash, x.Value.Transfer, x.Value.CashCancelled));
    }

    private async Task<Dictionary<string, SeedUser>> LoadUsersAsync(CancellationToken ct)
    {
        var users = await db.Set<User>().AsNoTracking()
            .Select(u => new SeedUser(u.Id, u.Username, u.FullName))
            .ToDictionaryAsync(u => u.Username, StringComparer.OrdinalIgnoreCase, ct);
        if (!users.ContainsKey(DefaultCashier))
            throw new InvalidOperationException($"Thiếu tài khoản demo '{DefaultCashier}' (FE/src/mock/seed/project.json) để nạp hóa đơn mẫu.");
        return users;
    }

    private async Task<StoreInfo> LoadStoreAsync(CancellationToken ct)
    {
        var settings = await db.Settings.AsNoTracking()
            .Where(s => s.Key.StartsWith("Store."))
            .ToDictionaryAsync(s => s.Key, s => s.Value, StringComparer.OrdinalIgnoreCase, ct);
        return new StoreInfo(settings.GetValueOrDefault("Store.BankBin") ?? string.Empty, settings.GetValueOrDefault("Store.BankAccount") ?? string.Empty);
    }

    private Dictionary<string, Category> SeedCategories(List<CategorySeed> items, DateTime createdAt)
    {
        var result = new Dictionary<string, Category>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var category = Category.Create(item.Code, item.Name, item.Color, item.SortOrder);
            db.Add(category);
            SetTimestamps(category, createdAt);
            result[category.Code] = category;
        }

        return result;
    }

    private Dictionary<string, Topping> SeedToppings(List<ToppingSeed> items, DateTime createdAt)
    {
        var result = new Dictionary<string, Topping>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var topping = Topping.Create(item.Code, item.Name, item.Price, item.SortOrder);
            db.Add(topping);
            SetTimestamps(topping, createdAt);
            result[topping.Code] = topping;
        }

        return result;
    }

    private Dictionary<string, MenuItem> SeedMenuItems(
        List<MenuItemSeed> items,
        Dictionary<string, Category> categories,
        Dictionary<string, Topping> toppings,
        DateTime createdAt)
    {
        var result = new Dictionary<string, MenuItem>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var category = categories.GetValueOrDefault(item.Category)
                ?? throw Invalid($"món '{item.Code}' trỏ tới danh mục '{item.Category}' không có trong file seed.");
            var toppingIds = item.Toppings.Select(code =>
                (toppings.GetValueOrDefault(code) ?? throw Invalid($"món '{item.Code}' dùng topping '{code}' không có trong file seed.")).Id);

            var menuItem = MenuItem.Create(
                item.Code, item.Name, category.Id, item.Description, item.Sugar ?? true, item.Ice ?? true, item.SortOrder,
                item.Sizes.Select(s => (s.Name, s.Price, s.Default ?? false)), toppingIds);
            if (!string.IsNullOrWhiteSpace(item.Image))
                menuItem.SetImage(ImageFolder + item.Image.Trim());
            menuItem.SetSoldOut(item.SoldOut ?? false);
            menuItem.SetHidden(item.Hidden ?? false);

            db.Add(menuItem);
            SetTimestamps(menuItem, createdAt);
            result[menuItem.Code] = menuItem;
        }

        return result;
    }

    private List<Promotion> SeedPromotions(
        List<PromotionSeed> items,
        Dictionary<string, Category> categories,
        Dictionary<string, MenuItem> menuItems,
        DateTime createdAt)
    {
        var result = new List<Promotion>();
        foreach (var item in items)
        {
            Guid? categoryId = item.Category is null ? null
                : (categories.GetValueOrDefault(item.Category) ?? throw Invalid($"khuyến mãi '{item.Code}' trỏ tới danh mục '{item.Category}' không có.")).Id;
            var itemIds = (item.MenuItems ?? []).Select(code =>
                (menuItems.GetValueOrDefault(code) ?? throw Invalid($"khuyến mãi '{item.Code}' trỏ tới món '{code}' không có.")).Id);

            var promotion = Promotion.Create(
                item.Code, item.Name, item.Description, item.DiscountType, item.DiscountValue, item.MaxDiscount, item.Scope, categoryId,
                itemIds, item.MinOrderAmount, ParseTime(item.StartTime), ParseTime(item.EndTime), item.DaysOfWeek ?? [],
                SeedDates.FromToday(timeProvider, item.StartDayOffset),
                SeedDates.FromToday(timeProvider, item.EndDayOffset, EndOfDay),
                item.IsPaused ?? false);
            db.Add(promotion);
            SetTimestamps(promotion, createdAt);
            result.Add(promotion);
        }

        return result;
    }

    private Dictionary<string, Voucher> SeedVouchers(List<VoucherSeed> items, DateTime createdAt)
    {
        var result = new Dictionary<string, Voucher>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var voucher = Voucher.Create(
                item.Code, item.Description, item.DiscountType, item.DiscountValue, item.MaxDiscount, item.MinOrderAmount, item.MaxUses,
                item.ExpiresDayOffset is { } offset ? SeedDates.FromToday(timeProvider, offset, EndOfDay) : null,
                item.IsPaused ?? false);
            db.Add(voucher);
            SetTimestamps(voucher, createdAt);
            result[voucher.Code] = voucher;
        }

        return result;
    }

    private Dictionary<string, Customer> SeedCustomers(List<CustomerSeed> items)
    {
        var result = new Dictionary<string, Customer>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            var customer = Customer.Create(item.Phone, item.Name, item.Note);
            db.Add(customer);
            SetTimestamps(customer, SeedDates.DaysAgo(timeProvider, item.CreatedDaysAgo, ReviewTime));
            result[customer.Phone] = customer;
        }

        return result;
    }

    private Dictionary<(int Day, int Seq), Shift> SeedShifts(List<ShiftSeed> items, Dictionary<string, SeedUser> users)
    {
        var result = new Dictionary<(int, int), Shift>();
        foreach (var item in items)
        {
            var cashier = users.GetValueOrDefault(item.Cashier) ?? users[DefaultCashier];
            var openedAt = SeedDates.FromToday(timeProvider, item.Day, ParseTime(item.Open)!.Value.ToTimeSpan());
            var code = ShiftQueries.CodePrefix + DayStamp(item.Day) + item.Seq.ToString("00", CultureInfo.InvariantCulture);

            var shift = Shift.Open(code, cashier.Id, cashier.FullName, openedAt, item.OpeningCash);
            db.Add(shift);
            SetTimestamps(shift, openedAt);
            result[(item.Day, item.Seq)] = shift;
        }

        return result;
    }

    private OrderStats SeedOrders(
        List<OrderSeed> items,
        Dictionary<(int Day, int Seq), Shift> shifts,
        Dictionary<string, MenuItem> menuItems,
        Dictionary<string, Topping> toppings,
        List<Promotion> promotions,
        Dictionary<string, Voucher> vouchers,
        Dictionary<string, Customer> customers,
        Dictionary<string, SeedUser> users,
        StoreInfo store)
    {
        var itemsById = menuItems.Values.ToDictionary(m => m.Id);
        var toppingsById = toppings.Values.ToDictionary(t => t.Id);
        var stats = new OrderStats();

        // Mã hóa đơn theo thứ tự thanh toán trong ngày, gồm cả hóa đơn sau này bị hủy (06 §5.2).
        foreach (var dayGroup in items.GroupBy(o => o.D).OrderBy(g => g.Key))
        {
            var sequence = 0;
            foreach (var item in dayGroup.OrderBy(o => o.T, StringComparer.Ordinal))
            {
                sequence++;
                var shift = shifts.GetValueOrDefault((item.D, item.S))
                    ?? throw Invalid($"hóa đơn ngày {item.D} ca {item.S} không có ca tương ứng.");
                var paidAt = SeedDates.FromToday(timeProvider, item.D, ParseTime(item.T)!.Value.ToTimeSpan());

                var lineInputs = item.It.Select(line => new CartLineInput
                {
                    MenuItemId = (menuItems.GetValueOrDefault(line.M) ?? throw Invalid($"hóa đơn dùng món '{line.M}' không có.")).Id,
                    SizeName = line.Z,
                    Quantity = line.Q,
                    ToppingIds = (line.Tp ?? []).Select(code =>
                        (toppings.GetValueOrDefault(code) ?? throw Invalid($"hóa đơn dùng topping '{code}' không có.")).Id).ToList(),
                    SugarLevel = line.Su,
                    IceLevel = line.Ic,
                    Note = line.N,
                    Discount = ToDiscountInput(line.Dc)
                }).ToList();

                var lines = OrderPricingService.ResolveLines(lineInputs, itemsById, toppingsById, checkAvailability: false);
                var subtotal = lines.Sum(l => (l.SizePrice + l.Toppings.Sum(t => t.Price)) * l.Quantity);

                Voucher? voucher = null;
                if (!string.IsNullOrWhiteSpace(item.Vc))
                {
                    voucher = vouchers.GetValueOrDefault(item.Vc) ?? throw Invalid($"hóa đơn dùng voucher '{item.Vc}' không có.");
                    var reason = voucher.GetRejectReason(paidAt, subtotal);
                    if (reason is not null)
                        throw Invalid($"hóa đơn ngày {item.D} {item.T} dùng voucher {item.Vc} không hợp lệ: {reason}.");
                }

                var cart = OrderPricing.Price(
                    lines,
                    OrderPricingService.ToManual(ToDiscountInput(item.Dc)),
                    voucher,
                    OrderPricingService.ActivePromotions(promotions, paidAt));

                Customer? customer = null;
                if (!string.IsNullOrWhiteSpace(item.Cu))
                    customer = customers.GetValueOrDefault(Customer.NormalizePhone(item.Cu)) ?? throw Invalid($"hóa đơn dùng khách '{item.Cu}' không có.");

                var order = Order.Create(
                    shift.Id, shift.CashierId, shift.CashierName, item.Sv, item.Tb, cart,
                    customer is null ? null : (customer.Id, customer.Phone));

                var code = OrderService.CodePrefix + DayStamp(item.D) + sequence.ToString("0000", CultureInfo.InvariantCulture);
                var approvedBy = item.Dc?.By is { } by ? users.GetValueOrDefault(by) : null;
                var qrContent = item.Pm == PaymentMethod.ChuyenKhoan
                    ? $"VIETQR|{store.BankBin}|{store.BankAccount}|{cart.Total:0}|{code}"
                    : null;
                order.MarkPaid(code, null, item.Pm, item.Pm == PaymentMethod.TienMat ? item.Cash ?? cart.Total : null, qrContent, paidAt,
                    approvedBy is null ? null : (approvedBy.Id, approvedBy.Username));
                cart.Voucher?.RegisterUse();
                customer?.RecordOrder(order.PointsEarned, order.Total, paidAt);

                var accumulator = stats.Accumulators.GetValueOrDefault(shift.Id);
                DateTime? updatedAt = null;
                if (item.Cx is { } cancel)
                {
                    var cancelledAt = SeedDates.FromToday(timeProvider, item.D, ParseTime(cancel.At)!.Value.ToTimeSpan());
                    var cancelledBy = users.GetValueOrDefault(cancel.By) ?? users[DefaultCashier];
                    order.Cancel(cancel.Reason, cancelledBy.Id, cancelledBy.Username, cancelledAt);
                    cart.Voucher?.ReleaseUse();
                    customer?.RevertOrder(order.PointsEarned, order.Total);
                    updatedAt = cancelledAt;

                    accumulator.Cancelled++;
                    if (item.Pm == PaymentMethod.TienMat)
                        accumulator.CashCancelled += order.Total;
                    stats.Cancelled++;
                }
                else
                {
                    accumulator.Paid++;
                    if (item.Pm == PaymentMethod.TienMat)
                        accumulator.Cash += order.Total;
                    else
                        accumulator.Transfer += order.Total;
                    stats.Paid++;
                    stats.PaidSubtotal += order.Subtotal;
                }

                stats.Accumulators[shift.Id] = accumulator;
                stats.Orders++;

                db.Add(order);
                SetTimestamps(order, paidAt, updatedAt);
            }
        }

        return stats;
    }

    private void CloseShifts(
        List<ShiftSeed> items,
        Dictionary<(int Day, int Seq), Shift> shifts,
        Dictionary<Guid, Shift.Totals> totalsByShift,
        Dictionary<string, SeedUser> users)
    {
        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.Close))
                continue;

            var shift = shifts[(item.Day, item.Seq)];
            var closedAt = SeedDates.FromToday(timeProvider, item.Day, ParseTime(item.Close)!.Value.ToTimeSpan());
            var totals = totalsByShift.GetValueOrDefault(shift.Id, new Shift.Totals(0, 0, 0, 0, 0));
            shift.ApplySeedClose(totals, item.Diff, item.Note, closedAt);

            if (item.Review is { } review)
            {
                var reviewer = users.GetValueOrDefault(review.By) ?? users[DefaultCashier];
                shift.Review(review.Note, reviewer.Id, reviewer.Username, SeedDates.FromToday(timeProvider, item.Day + 1, ReviewTime));
            }
        }
    }

    private static ManualDiscountInput? ToDiscountInput(SeedDiscount? discount) =>
        discount is null ? null : new ManualDiscountInput { Type = discount.Type, Value = discount.Value, Reason = discount.Reason };

    private string DayStamp(int dayOffset) =>
        VietnamDates.DateOf(SeedDates.FromToday(timeProvider, dayOffset, new TimeSpan(12, 0, 0)))
            .ToString("yyMMdd", CultureInfo.InvariantCulture);

    private static TimeOnly? ParseTime(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null
        : VietnamDates.TryParseTime(value, out var time) ? time
        : throw Invalid($"giờ '{value}' không đúng định dạng HH:mm.");

    /// <summary>Gán sẵn ngày tạo, ngày sửa; interceptor giữ nguyên giá trị đã gán khi thêm mới.</summary>
    private void SetTimestamps(BaseEntity entity, DateTime createdAt, DateTime? updatedAt = null)
    {
        var entry = db.Entry(entity);
        entry.Property(e => e.CreatedAt).CurrentValue = createdAt;
        entry.Property(e => e.UpdatedAt).CurrentValue = updatedAt;
    }

    /// <summary>Xóa ảnh món đã tải lên (<c>wwwroot/uploads/menu</c>); ảnh mẫu <c>/seed/...</c> nằm ở FE nên không đụng tới.</summary>
    private void DeleteUploadedImages()
    {
        var folder = Path.Combine(fileStorageOptions.Value.RootPath, MenuItemService.UploadFolder);
        try
        {
            if (Directory.Exists(folder))
                Directory.Delete(folder, recursive: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Không xóa được thư mục ảnh tải lên {Folder}.", folder);
        }
    }

    private static InvalidOperationException Invalid(string message) =>
        new($"Dữ liệu seed không hợp lệ (FE/src/mock/seed/{SeedFileName}): {message}");
}
