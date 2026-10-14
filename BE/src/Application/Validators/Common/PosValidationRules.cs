using System.Text.RegularExpressions;
using Application.Common.Time;
using Application.DTOs.Orders;
using Domain.Entities.Pos;
using Domain.Enums.Pos.Orders;
using FluentValidation;

namespace Application.Validators.Common;

/// <summary>Quy tắc kiểm tra dùng lại ở nhiều validator của POS (câu thông báo theo 07).</summary>
public static partial class PosValidationRules
{
    public const string ThousandMultipleMessage = "Giá phải là bội số 1.000 ₫";
    public const string ColorMessage = "Màu dạng #RRGGBB, vd #B45309";
    public const string DateMessage = "Ngày dạng yyyy-MM-dd";
    public const string TimeMessage = "Giờ dạng HH:mm";

    /// <summary>Giá &gt; 0 và là bội số 1.000 ₫ (UC-01 E2).</summary>
    public static IRuleBuilderOptions<T, decimal> PositiveThousands<T>(this IRuleBuilder<T, decimal> rule) =>
        rule.GreaterThan(0).WithMessage(ThousandMultipleMessage)
            .Must(PosRules.IsThousandMultiple).WithMessage(ThousandMultipleMessage);

    /// <summary>Giá ≥ 0 và là bội số 1.000 ₫.</summary>
    public static IRuleBuilderOptions<T, decimal> NonNegativeThousands<T>(this IRuleBuilder<T, decimal> rule) =>
        rule.GreaterThanOrEqualTo(0).WithMessage(ThousandMultipleMessage)
            .Must(PosRules.IsThousandMultiple).WithMessage(ThousandMultipleMessage);

    /// <summary>Giảm giá thủ công: phần trăm 1–100, số tiền bội số 1.000, có lý do (07 §3 bước 2).</summary>
    public static IRuleBuilderOptions<T, ManualDiscountInput?> ValidManualDiscount<T>(this IRuleBuilder<T, ManualDiscountInput?> rule) =>
        rule.Must(d => d is null || d.Type != DiscountType.PhanTram || d.Value is >= 1 and <= 100)
                .WithMessage("Phần trăm giảm từ 1 đến 100")
            .Must(d => d is null || d.Type != DiscountType.SoTien || (d.Value > 0 && PosRules.IsThousandMultiple(d.Value)))
                .WithMessage("Số tiền giảm phải là bội số 1.000 ₫")
            .Must(d => d is null || !string.IsNullOrWhiteSpace(d.Reason))
                .WithMessage("Chọn lý do giảm giá")
            .Must(d => d is null || d.Reason.Trim().Length <= 200)
                .WithMessage("Lý do tối đa 200 ký tự");

    /// <summary>Ngày yyyy-MM-dd, bắt buộc.</summary>
    public static IRuleBuilderOptions<T, string> ValidDate<T>(this IRuleBuilder<T, string> rule) =>
        rule.Must(v => VietnamDates.TryParse(v, out _)).WithMessage(DateMessage);

    /// <summary>Ngày yyyy-MM-dd, không bắt buộc.</summary>
    public static IRuleBuilderOptions<T, string?> OptionalDate<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(v => string.IsNullOrWhiteSpace(v) || VietnamDates.TryParse(v, out _)).WithMessage(DateMessage);

    /// <summary>Giờ HH:mm, không bắt buộc.</summary>
    public static IRuleBuilderOptions<T, string?> OptionalTime<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(v => string.IsNullOrWhiteSpace(v) || VietnamDates.TryParseTime(v, out _)).WithMessage(TimeMessage);

    public static bool IsHexColor(string? value) => value is not null && ColorRegex().IsMatch(value.Trim());

    /// <summary>Mã danh mục, món, topping: 1–20 ký tự chữ in hoa, số, gạch ngang, gạch dưới.</summary>
    public static bool IsCode(string? value) => value is not null && CodeRegex().IsMatch(value.Trim());

    /// <summary>SĐT khách: 10 chữ số, bắt đầu bằng 0 (cho phép khoảng trắng, dấu chấm, gạch ngang khi nhập).</summary>
    public static bool IsPhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        return digits.Length == 10 && digits[0] == '0' && value.Trim().All(c => char.IsDigit(c) || c is ' ' or '.' or '-');
    }

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex ColorRegex();

    [GeneratedRegex("^[A-Za-z0-9_-]{1,20}$")]
    private static partial Regex CodeRegex();
}
