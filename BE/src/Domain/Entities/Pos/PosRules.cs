namespace Domain.Entities.Pos;

/// <summary>
/// Hằng số nghiệp vụ của POS (06 §3): không phải cài đặt, không đổi qua giao diện.
/// </summary>
public static class PosRules
{
    /// <summary>BR-03: giảm theo phần trăm làm tròn xuống tới bội số này.</summary>
    public const int RoundingUnit = 1000;

    /// <summary>BR-04: thu ngân tự giảm tối đa phần trăm này của tổng tiền hàng.</summary>
    public const int CashierDiscountLimitPercent = 10;

    /// <summary>BR-12: lệch ca quá số này thì ca "Cần kiểm tra".</summary>
    public const decimal ShiftDifferenceThreshold = 50_000m;

    /// <summary>BR-15: tối đa số đơn giữ cùng lúc mỗi thu ngân.</summary>
    public const int MaxHeldOrders = 10;

    /// <summary>BR-17: số tiền cho một điểm.</summary>
    public const int PointsUnit = 10_000;

    public const int QuantityMin = 1;
    public const int QuantityMax = 99;

    /// <summary>Thời hạn mã xác nhận giảm giá vượt hạn mức (07 §2.5).</summary>
    public static readonly TimeSpan DiscountApprovalLifetime = TimeSpan.FromMinutes(5);

    /// <summary>Làm tròn xuống tới bội số 1.000 ₫ (BR-03).</summary>
    public static decimal RoundDown(decimal amount) => Math.Floor(amount / RoundingUnit) * RoundingUnit;

    /// <summary>Giá, số tiền giảm nhập tay phải là bội số 1.000 ₫ (SRS §2.4).</summary>
    public static bool IsThousandMultiple(decimal amount) => amount % RoundingUnit == 0;

    /// <summary>BR-17: 1 điểm cho mỗi 10.000 ₫ tổng thanh toán, làm tròn xuống.</summary>
    public static int PointsFor(decimal total) => total <= 0 ? 0 : (int)Math.Floor(total / PointsUnit);

    /// <summary>Định dạng tiền trong câu thông báo, giống FE <c>formatVnd</c>: <c>60.000 ₫</c>.</summary>
    public static string FormatVnd(decimal amount) =>
        amount.ToString("#,0", global::System.Globalization.CultureInfo.InvariantCulture).Replace(',', '.') + " ₫";
}
