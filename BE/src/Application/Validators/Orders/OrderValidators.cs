using Application.DTOs.Orders;
using Application.Validators.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Orders;
using FluentValidation;

namespace Application.Validators.Orders;

/// <summary>Quy tắc giỏ hàng dùng chung cho giữ đơn và thanh toán (07 §2.5). Món, size, topping, voucher kiểm tra ở service.</summary>
internal static class CartInputRules
{
    private static readonly int[] SugarLevels = [0, 30, 50, 70, 100];

    public static void AddCartRules<T>(this AbstractValidator<T> validator)
        where T : CartInput
    {
        validator.RuleFor(x => x.Items)
            .NotEmpty().WithMessage("Đơn chưa có món");

        validator.RuleFor(x => x.TableTag)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập số thẻ bàn")
            .Must(v => v!.Trim().Length <= Order.TableTagMaxLength).WithMessage($"Số thẻ bàn tối đa {Order.TableTagMaxLength} ký tự")
            .When(x => x.ServiceType == ServiceType.TaiCho);

        validator.RuleForEach(x => x.Items).ChildRules(line =>
        {
            line.RuleFor(l => l.MenuItemId).NotEmpty().WithMessage("Món không hợp lệ");
            line.RuleFor(l => l.SizeName).Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Chọn size");
            line.RuleFor(l => l.Quantity)
                .InclusiveBetween(PosRules.QuantityMin, PosRules.QuantityMax)
                .WithMessage($"Số lượng từ {PosRules.QuantityMin} đến {PosRules.QuantityMax}");
            line.RuleFor(l => l.SugarLevel)
                .Must(v => v is null || SugarLevels.Contains(v.Value)).WithMessage("Mức đường là 0, 30, 50, 70 hoặc 100");
            line.RuleFor(l => l.Note)
                .Must(v => v is null || v.Trim().Length <= OrderItem.NoteMaxLength)
                .WithMessage($"Ghi chú tối đa {OrderItem.NoteMaxLength} ký tự");
            line.RuleFor(l => l.Discount).ValidManualDiscount();
        });

        validator.RuleFor(x => x.OrderDiscount).ValidManualDiscount();

        validator.RuleFor(x => x.VoucherCode)
            .Must(v => v is null || v.Trim().Length <= 12).WithMessage("Mã voucher tối đa 12 ký tự");
    }
}

public sealed class HoldOrderRequestValidator : AppValidator<HoldOrderRequest>
{
    public HoldOrderRequestValidator()
    {
        this.AddCartRules();
        RuleFor(x => x.HoldName)
            .Must(v => v is null || v.Trim().Length <= Order.HoldNameMaxLength)
            .WithMessage($"Tên đơn giữ tối đa {Order.HoldNameMaxLength} ký tự");
    }
}

public sealed class CheckoutRequestValidator : AppValidator<CheckoutRequest>
{
    public CheckoutRequestValidator()
    {
        this.AddCartRules();

        RuleFor(x => x.ClientRequestId)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Thiếu mã yêu cầu thanh toán")
            .Must(v => v.Trim().Length <= Order.ClientRequestIdMaxLength)
            .WithMessage($"Mã yêu cầu tối đa {Order.ClientRequestIdMaxLength} ký tự");

        RuleFor(x => x.Payment).NotNull().WithMessage("Thiếu thông tin thanh toán");

        RuleFor(x => x.Payment.CashReceived)
            .NotNull().WithMessage("Nhập tiền khách đưa")
            .GreaterThanOrEqualTo(0).WithMessage("Tiền khách đưa không hợp lệ")
            .When(x => x.Payment is { Method: PaymentMethod.TienMat });

        RuleFor(x => x.Payment.QrContent)
            .Must(v => v is null || v.Trim().Length <= Payment.QrContentMaxLength)
            .WithMessage($"Chuỗi QR tối đa {Payment.QrContentMaxLength} ký tự")
            .When(x => x.Payment is not null);

        RuleFor(x => x.ExpectedTotal).GreaterThanOrEqualTo(0).WithMessage("Tổng tiền không hợp lệ");
    }
}

public sealed class CancelOrderRequestValidator : AppValidator<CancelOrderRequest>
{
    public CancelOrderRequestValidator()
    {
        RuleFor(x => x.Reason)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập lý do hủy")
            .Must(v => v.Trim().Length <= Order.ReasonMaxLength).WithMessage($"Lý do tối đa {Order.ReasonMaxLength} ký tự");
    }
}

public sealed class DiscountApprovalRequestValidator : AppValidator<DiscountApprovalRequest>
{
    public DiscountApprovalRequestValidator()
    {
        RuleFor(x => x.Username).Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập tên đăng nhập quản lý");
        RuleFor(x => x.Password).Must(v => !string.IsNullOrEmpty(v)).WithMessage("Nhập mật khẩu quản lý");
    }
}

public sealed class OrderQueryValidator : AppValidator<OrderQuery>
{
    public OrderQueryValidator()
    {
        RuleFor(x => x.From).OptionalDate();
        RuleFor(x => x.To).OptionalDate();
    }
}
