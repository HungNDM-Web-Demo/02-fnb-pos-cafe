using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Promotions;

namespace Domain.Entities.Pos.Promotions;

/// <summary>
/// Khuyến mãi tự động (bảng <c>Pos_Promotions</c>, FR-26). <see cref="StartDate"/> là 00:00 ngày bắt đầu, <see cref="EndDate"/> là
/// 23:59:59 ngày kết thúc (giờ Việt Nam, lưu UTC). Khung giờ, ngày trong tuần xét theo giờ Việt Nam lúc thanh toán (BR-07).
/// </summary>
public class Promotion : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 150;
    public const int DescriptionMaxLength = 500;
    public const int DaysOfWeekMaxLength = 20;

    private readonly List<PromotionMenuItem> _menuItems = [];

    private Promotion()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }
    public decimal? MaxDiscount { get; private set; }
    public PromotionScope Scope { get; private set; }
    public Guid? CategoryId { get; private set; }
    public decimal MinOrderAmount { get; private set; }
    public TimeOnly? StartTime { get; private set; }
    public TimeOnly? EndTime { get; private set; }

    /// <summary>Chuỗi số cách nhau dấu phẩy, 1 = Thứ Hai … 7 = Chủ nhật; rỗng là mọi ngày.</summary>
    public string DaysOfWeek { get; private set; } = string.Empty;

    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public bool IsPaused { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public IReadOnlyCollection<PromotionMenuItem> MenuItems => _menuItems;

    public IReadOnlyList<int> DaysOfWeekList =>
        DaysOfWeek.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(int.Parse).ToList();

    public static Promotion Create(
        string code,
        string name,
        string? description,
        DiscountType discountType,
        decimal discountValue,
        decimal? maxDiscount,
        PromotionScope scope,
        Guid? categoryId,
        IEnumerable<Guid> menuItemIds,
        decimal minOrderAmount,
        TimeOnly? startTime,
        TimeOnly? endTime,
        IEnumerable<int> daysOfWeek,
        DateTime startDateUtc,
        DateTime endDateUtc,
        bool isPaused = false)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new DomainException("Mã khuyến mãi không được để trống.");

        var promotion = new Promotion { Code = code.Trim().ToUpperInvariant(), IsPaused = isPaused };
        promotion.Update(name, description, discountType, discountValue, maxDiscount, scope, categoryId, menuItemIds, minOrderAmount,
            startTime, endTime, daysOfWeek, startDateUtc, endDateUtc);
        return promotion;
    }

    public void Update(
        string name,
        string? description,
        DiscountType discountType,
        decimal discountValue,
        decimal? maxDiscount,
        PromotionScope scope,
        Guid? categoryId,
        IEnumerable<Guid> menuItemIds,
        decimal minOrderAmount,
        TimeOnly? startTime,
        TimeOnly? endTime,
        IEnumerable<int> daysOfWeek,
        DateTime startDateUtc,
        DateTime endDateUtc)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Tên khuyến mãi không được để trống.");
        if (discountType == DiscountType.PhanTram && discountValue is < 1 or > 100)
            throw new DomainException("Phần trăm giảm từ 1 đến 100");
        if (discountType == DiscountType.SoTien && (discountValue <= 0 || !PosRules.IsThousandMultiple(discountValue)))
            throw new DomainException("Số tiền giảm phải là bội số 1.000 ₫");
        if (scope == PromotionScope.DanhMuc && categoryId is null)
            throw new DomainException("Chọn danh mục áp dụng");
        var items = menuItemIds.Distinct().ToList();
        if (scope == PromotionScope.Mon && items.Count == 0)
            throw new DomainException("Chọn ít nhất một món áp dụng");
        if (endDateUtc < startDateUtc)
            throw new DomainException("Ngày kết thúc phải sau ngày bắt đầu");
        if (startTime is not null && endTime is not null && endTime <= startTime)
            throw new DomainException("Giờ kết thúc phải sau giờ bắt đầu");

        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        DiscountType = discountType;
        DiscountValue = discountValue;
        MaxDiscount = discountType == DiscountType.PhanTram ? maxDiscount : null;
        Scope = scope;
        CategoryId = scope == PromotionScope.DanhMuc ? categoryId : null;
        MinOrderAmount = Math.Max(0, minOrderAmount);
        StartTime = startTime;
        EndTime = endTime;
        DaysOfWeek = string.Join(',', daysOfWeek.Where(d => d is >= 1 and <= 7).Distinct().Order());
        StartDate = startDateUtc;
        EndDate = endDateUtc;

        if (scope != PromotionScope.Mon)
            items.Clear();
        _menuItems.RemoveAll(m => !items.Contains(m.MenuItemId));
        foreach (var id in items.Where(id => _menuItems.All(m => m.MenuItemId != id)))
            _menuItems.Add(new PromotionMenuItem(Id, id));
    }

    public void SetPaused(bool isPaused) => IsPaused = isPaused;

    /// <summary>Trạng thái hiển thị tại thời điểm <paramref name="nowUtc"/> (06 §4).</summary>
    public PromotionStatus GetStatus(DateTime nowUtc) =>
        IsPaused ? PromotionStatus.TamDung
        : nowUtc < StartDate ? PromotionStatus.SapChay
        : nowUtc > EndDate ? PromotionStatus.DaHet
        : PromotionStatus.DangChay;

    /// <summary>
    /// Đang hiệu lực tại thời điểm thanh toán (07 §3): không tạm dừng, trong ngày hiệu lực, đúng thứ, trong khung giờ
    /// (<c>startTime ≤ giờ &lt; endTime</c>). <paramref name="vietnamLocal"/> là giờ Việt Nam tương ứng với <paramref name="utc"/>.
    /// </summary>
    public bool IsEffectiveAt(DateTime utc, DateTime vietnamLocal)
    {
        if (IsPaused || IsDeleted || utc < StartDate || utc > EndDate)
            return false;

        var days = DaysOfWeekList;
        if (days.Count > 0 && !days.Contains(IsoDayOfWeek(vietnamLocal.DayOfWeek)))
            return false;

        if (StartTime is { } start && EndTime is { } end)
        {
            var time = TimeOnly.FromDateTime(vietnamLocal);
            return time >= start && time < end;
        }

        return true;
    }

    /// <summary>Dòng hóa đơn có thuộc phạm vi khuyến mãi cấp món không.</summary>
    public bool CoversItem(Guid menuItemId, Guid categoryId) => Scope switch
    {
        PromotionScope.DanhMuc => CategoryId == categoryId,
        PromotionScope.Mon => _menuItems.Any(m => m.MenuItemId == menuItemId),
        _ => false
    };

    /// <summary>1 = Thứ Hai … 7 = Chủ nhật.</summary>
    public static int IsoDayOfWeek(DayOfWeek day) => day == DayOfWeek.Sunday ? 7 : (int)day;
}
