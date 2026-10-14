using Application.DTOs.Customers;
using Application.Validators.Common;
using Domain.Entities.Crm.Customers;
using FluentValidation;

namespace Application.Validators.Customers;

/// <summary>Thêm nhanh, sửa khách (FR-33). Trùng SĐT kiểm tra ở service (409).</summary>
public sealed class SaveCustomerRequestValidator : AppValidator<SaveCustomerRequest>
{
    public const string PhoneMessage = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0";

    public SaveCustomerRequestValidator()
    {
        RuleFor(x => x.Phone).Must(PosValidationRules.IsPhone).WithMessage(PhoneMessage);

        RuleFor(x => x.Name)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập tên khách")
            .Must(v => v.Trim().Length <= Customer.NameMaxLength).WithMessage($"Tên tối đa {Customer.NameMaxLength} ký tự");

        RuleFor(x => x.Note)
            .Must(v => v is null || v.Trim().Length <= Customer.NoteMaxLength)
            .WithMessage($"Ghi chú tối đa {Customer.NoteMaxLength} ký tự");
    }
}
