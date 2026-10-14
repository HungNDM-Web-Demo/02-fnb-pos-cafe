using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Promotions;

namespace Infrastructure.Persistence.Seeders;

// Hình dạng của FE/src/mock/seed/demo-data.json (06 §5.2), nguồn duy nhất cho FE mock và DemoDataSeeder.
// Ngày ghi tương đối bằng số ngày (dayOffset, daysAgo), giờ "HH:mm" theo giờ Việt Nam; tiền không ghi trong file, seeder tính lại.

internal sealed class PosSeedFile
{
    public List<CategorySeed>? Categories { get; init; }
    public List<MenuItemSeed>? MenuItems { get; init; }
    public List<ToppingSeed>? Toppings { get; init; }
    public List<PromotionSeed>? Promotions { get; init; }
    public List<VoucherSeed>? Vouchers { get; init; }
    public List<CustomerSeed>? Customers { get; init; }
    public List<ShiftSeed>? Shifts { get; init; }
    public List<OrderSeed>? Orders { get; init; }
}

internal sealed class CategorySeed
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public int SortOrder { get; init; }
}

internal sealed class MenuItemSizeSeed
{
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public bool? Default { get; init; }
}

internal sealed class MenuItemSeed
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;

    /// <summary>Mã danh mục.</summary>
    public string Category { get; init; } = string.Empty;

    public string? Description { get; init; }

    /// <summary>Tên file trong FE/public/seed/menu/.</summary>
    public string? Image { get; init; }

    public bool? Sugar { get; init; }
    public bool? Ice { get; init; }
    public List<MenuItemSizeSeed> Sizes { get; init; } = [];

    /// <summary>Mã topping được phép.</summary>
    public List<string> Toppings { get; init; } = [];

    public bool? SoldOut { get; init; }
    public bool? Hidden { get; init; }
    public int SortOrder { get; init; }
}

internal sealed class ToppingSeed
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public int SortOrder { get; init; }
}

internal sealed class PromotionSeed
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DiscountType DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscount { get; init; }
    public PromotionScope Scope { get; init; }

    /// <summary>Mã danh mục khi scope = DanhMuc.</summary>
    public string? Category { get; init; }

    /// <summary>Mã món khi scope = Mon.</summary>
    public List<string>? MenuItems { get; init; }

    public decimal MinOrderAmount { get; init; }
    public string? StartTime { get; init; }
    public string? EndTime { get; init; }
    public List<int>? DaysOfWeek { get; init; }
    public int StartDayOffset { get; init; }
    public int EndDayOffset { get; init; }
    public bool? IsPaused { get; init; }
}

internal sealed class VoucherSeed
{
    public string Code { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DiscountType DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscount { get; init; }
    public decimal MinOrderAmount { get; init; }
    public int? MaxUses { get; init; }
    public int? ExpiresDayOffset { get; init; }
    public bool? IsPaused { get; init; }
}

internal sealed class CustomerSeed
{
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Note { get; init; }
    public int CreatedDaysAgo { get; init; }
}

internal sealed class ShiftReviewSeed
{
    public string Note { get; init; } = string.Empty;
    public string By { get; init; } = string.Empty;
}

internal sealed class ShiftSeed
{
    /// <summary>dayOffset ≤ 0.</summary>
    public int Day { get; init; }

    /// <summary>1 sáng, 2 chiều.</summary>
    public int Seq { get; init; }

    /// <summary>Tên đăng nhập thu ngân.</summary>
    public string Cashier { get; init; } = string.Empty;

    public string Open { get; init; } = string.Empty;

    /// <summary>Null khi ca đang mở.</summary>
    public string? Close { get; init; }

    public decimal OpeningCash { get; init; }

    /// <summary>Chênh lệch mong muốn.</summary>
    public decimal Diff { get; init; }

    public string? Note { get; init; }
    public ShiftReviewSeed? Review { get; init; }
}

internal sealed class SeedDiscount
{
    public DiscountType Type { get; init; }
    public decimal Value { get; init; }
    public string Reason { get; init; } = string.Empty;

    /// <summary>Người duyệt khi vượt hạn mức.</summary>
    public string? By { get; init; }
}

internal sealed class SeedCancel
{
    public string At { get; init; } = string.Empty;
    public string By { get; init; } = string.Empty;
    public string Reason { get; init; } = string.Empty;
}

internal sealed class OrderLineSeed
{
    /// <summary>Mã món.</summary>
    public string M { get; init; } = string.Empty;

    /// <summary>Tên size.</summary>
    public string Z { get; init; } = string.Empty;

    public int Q { get; init; }

    /// <summary>Mã topping.</summary>
    public List<string>? Tp { get; init; }

    public int? Su { get; init; }
    public IceLevel? Ic { get; init; }
    public string? N { get; init; }
    public SeedDiscount? Dc { get; init; }
}

internal sealed class OrderSeed
{
    public int D { get; init; }
    public int S { get; init; }

    /// <summary>Giờ thanh toán HH:mm.</summary>
    public string T { get; init; } = string.Empty;

    public ServiceType Sv { get; init; }
    public string? Tb { get; init; }
    public PaymentMethod Pm { get; init; }
    public decimal? Cash { get; init; }
    public string? Vc { get; init; }

    /// <summary>SĐT khách tích điểm.</summary>
    public string? Cu { get; init; }

    public SeedDiscount? Dc { get; init; }
    public SeedCancel? Cx { get; init; }
    public List<OrderLineSeed> It { get; init; } = [];
}
