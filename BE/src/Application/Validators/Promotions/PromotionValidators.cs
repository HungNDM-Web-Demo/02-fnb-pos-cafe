using Application.Common.Time;
using Application.DTOs.Promotions;
using Application.Validators.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Promotions;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Promotions;
using FluentValidation;

namespace Application.Validators.Promotions;

/// <summary>Thêm, sửa khuyến mãi (FR-26, 07 §2.7).</summary>
public sealed class SavePromotionRequestValidator : AppValidator<SavePromotionRequest>
{
    public SavePromotionRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập tên khuyến mãi")
            .Must(v => v.Trim().Length <= Promotion.NameMaxLength).WithMessage($"Tên tối đa {Promotion.NameMaxLength} ký tự");

        RuleFor(x => x.Description)
            .Must(v => v is null || v.Trim().Length <= Promotion.DescriptionMaxLength)
            .WithMessage($"Mô tả tối đa {Promotion.DescriptionMaxLength} ký tự");

        RuleFor(x => x.DiscountValue)
            .Must((r, v) => r.DiscountType != DiscountType.PhanTram || v is >= 1 and <= 100)
            .WithMessage("Phần trăm giảm từ 1 đến 100")
            .Must((r, v) => r.DiscountType != DiscountType.SoTien || (v > 0 && PosRules.IsThousandMultiple(v)))
            .WithMessage("Số tiền giảm phải là bội số 1.000 ₫");

        RuleFor(x => x.MaxDiscount)
            .Must(v => v is null || (v > 0 && PosRules.IsThousandMultiple(v.Value)))
            .WithMessage("Giảm tối đa phải là bội số 1.000 ₫");

        RuleFor(x => x.MinOrderAmount).NonNegativeThousands();

        RuleFor(x => x.CategoryId)
            .NotNull().WithMessage("Chọn danh mục áp dụng")
            .NotEqual(Guid.Empty).WithMessage("Chọn danh mục áp dụng")
            .When(x => x.Scope == PromotionScope.DanhMuc);

        RuleFor(x => x.MenuItemIds)
            .NotEmpty().WithMessage("Chọn ít nhất một món áp dụng")
            .When(x => x.Scope == PromotionScope.Mon);

        RuleFor(x => x.StartTime).OptionalTime();
        RuleFor(x => x.EndTime).OptionalTime();
        RuleFor(x => x.EndTime)
            .Must((r, v) => string.IsNullOrWhiteSpace(v) == string.IsNullOrWhiteSpace(r.StartTime))
            .WithMessage("Nhập đủ giờ bắt đầu và kết thúc")
            .Must((r, v) =>
                !VietnamDates.TryParseTime(r.StartTime, out var start) || !VietnamDates.TryParseTime(v, out var end) || end > start)
            .WithMessage("Giờ kết thúc phải sau giờ bắt đầu");

        RuleFor(x => x.DaysOfWeek)
            .Must(days => days.All(d => d is >= 1 and <= 7)).WithMessage("Ngày trong tuần từ 1 (Thứ Hai) đến 7 (Chủ nhật)");

        RuleFor(x => x.StartDate).ValidDate();
        RuleFor(x => x.EndDate)
            .ValidDate()
            .Must((r, v) =>
                !VietnamDates.TryParse(r.StartDate, out var start) || !VietnamDates.TryParse(v, out var end) || end >= start)
            .WithMessage("Ngày kết thúc phải sau ngày bắt đầu");
    }
}

public sealed class SetPausedRequestValidator : AppValidator<SetPausedRequest>
{
}
