using Application.DTOs.Toppings;
using Application.Validators.Common;
using Domain.Entities.Pos.MenuItems;
using FluentValidation;

namespace Application.Validators.Toppings;

/// <summary>Thêm, sửa topping (FR-05). Trùng mã kiểm tra ở service (409).</summary>
public sealed class SaveToppingRequestValidator : AppValidator<SaveToppingRequest>
{
    public SaveToppingRequestValidator()
    {
        RuleFor(x => x.Code)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập mã topping")
            .Must(PosValidationRules.IsCode).WithMessage($"Mã 1–{Topping.CodeMaxLength} ký tự chữ, số, gạch ngang");

        RuleFor(x => x.Name)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập tên topping")
            .Must(v => v.Trim().Length <= Topping.NameMaxLength).WithMessage($"Tên tối đa {Topping.NameMaxLength} ký tự");

        RuleFor(x => x.Price).NonNegativeThousands();
    }
}
