using Application.DTOs.Vouchers;
using Application.Validators.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Promotions;
using Domain.Enums.Pos.Orders;
using FluentValidation;

namespace Application.Validators.Vouchers;

/// <summary>Thêm, sửa voucher (FR-27, 07 §2.7). Trùng mã kiểm tra ở service (409).</summary>
public sealed class SaveVoucherRequestValidator : AppValidator<SaveVoucherRequest>
{
    public SaveVoucherRequestValidator()
    {
        RuleFor(x => x.Code)
            .Must(v => v is not null && Voucher.IsValidCode(Voucher.NormalizeCode(v))).WithMessage(Voucher.CodeFormatMessage);

        RuleFor(x => x.Description)
            .Must(v => v is null || v.Trim().Length <= Voucher.DescriptionMaxLength)
            .WithMessage($"Mô tả tối đa {Voucher.DescriptionMaxLength} ký tự");

        RuleFor(x => x.DiscountValue)
            .Must((r, v) => r.DiscountType != DiscountType.PhanTram || v is >= 1 and <= 100)
            .WithMessage("Phần trăm giảm từ 1 đến 100")
            .Must((r, v) => r.DiscountType != DiscountType.SoTien || (v > 0 && PosRules.IsThousandMultiple(v)))
            .WithMessage("Số tiền giảm phải là bội số 1.000 ₫");

        RuleFor(x => x.MaxDiscount)
            .Must(v => v is null || (v > 0 && PosRules.IsThousandMultiple(v.Value)))
            .WithMessage("Giảm tối đa phải là bội số 1.000 ₫");

        RuleFor(x => x.MinOrderAmount).NonNegativeThousands();

        RuleFor(x => x.MaxUses)
            .Must(v => v is null || v >= 1).WithMessage("Số lượt tối đa phải lớn hơn 0");
    }
}

public sealed class VoucherCheckRequestValidator : AppValidator<VoucherCheckRequest>
{
    public VoucherCheckRequestValidator()
    {
        RuleFor(x => x.Code).Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập mã voucher");
        RuleFor(x => x.Subtotal).GreaterThanOrEqualTo(0).WithMessage("Tổng tiền hàng không hợp lệ");
    }
}
