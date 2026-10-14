using Application.DTOs.MenuItems;
using Application.Validators.Common;
using Domain.Entities.Pos.MenuItems;
using FluentValidation;

namespace Application.Validators.MenuItems;

/// <summary>
/// Thêm, sửa món (FR-04, UC-01 E2). Thứ tự kiểm tra theo 07 §2.3: định dạng (400) trước, danh mục và trùng mã ở service.
/// </summary>
public sealed class SaveMenuItemRequestValidator : AppValidator<SaveMenuItemRequest>
{
    public SaveMenuItemRequestValidator()
    {
        RuleFor(x => x.Code)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập mã món")
            .Must(PosValidationRules.IsCode).WithMessage($"Mã 1–{MenuItem.CodeMaxLength} ký tự chữ, số, gạch ngang");

        RuleFor(x => x.Name)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập tên món")
            .Must(v => v.Trim().Length <= MenuItem.NameMaxLength).WithMessage($"Tên tối đa {MenuItem.NameMaxLength} ký tự");

        RuleFor(x => x.CategoryId).NotEmpty().WithMessage("Chọn danh mục");

        RuleFor(x => x.Description)
            .Must(v => v is null || v.Trim().Length <= MenuItem.DescriptionMaxLength)
            .WithMessage($"Mô tả tối đa {MenuItem.DescriptionMaxLength} ký tự");

        RuleFor(x => x.Sizes)
            .NotEmpty().WithMessage("Cần ít nhất một size")
            .Must(sizes => sizes.Count(s => s.IsDefault) <= 1).WithMessage("Chỉ một size được đặt mặc định")
            .Must(sizes => sizes.Select(s => s.Name.Trim().ToUpperInvariant()).Distinct().Count() == sizes.Count)
            .WithMessage("Tên size bị trùng");

        RuleForEach(x => x.Sizes).ChildRules(size =>
        {
            size.RuleFor(s => s.Name)
                .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập tên size")
                .Must(v => v.Trim().Length <= MenuItemSize.NameMaxLength).WithMessage($"Tên size tối đa {MenuItemSize.NameMaxLength} ký tự");
            size.RuleFor(s => s.Price).PositiveThousands();
        });

        RuleFor(x => x.ToppingIds)
            .Must(ids => ids.All(id => id != Guid.Empty)).WithMessage("Topping không hợp lệ");
    }
}

public sealed class SetAvailabilityRequestValidator : AppValidator<SetAvailabilityRequest>
{
}

public sealed class SetHiddenRequestValidator : AppValidator<SetHiddenRequest>
{
}
