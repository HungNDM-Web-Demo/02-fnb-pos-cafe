using Application.DTOs.Categories;
using Application.Validators.Common;
using Domain.Entities.Pos.MenuItems;
using FluentValidation;

namespace Application.Validators.Categories;

/// <summary>Thêm, sửa danh mục (FR-03). Trùng mã kiểm tra ở service (409).</summary>
public sealed class SaveCategoryRequestValidator : AppValidator<SaveCategoryRequest>
{
    public SaveCategoryRequestValidator()
    {
        RuleFor(x => x.Code)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập mã danh mục")
            .Must(PosValidationRules.IsCode).WithMessage($"Mã 1–{Category.CodeMaxLength} ký tự chữ, số, gạch ngang");

        RuleFor(x => x.Name)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập tên danh mục")
            .Must(v => v.Trim().Length <= Category.NameMaxLength).WithMessage($"Tên tối đa {Category.NameMaxLength} ký tự");

        RuleFor(x => x.Color)
            .Must(PosValidationRules.IsHexColor).WithMessage(PosValidationRules.ColorMessage);
    }
}

public sealed class ReorderCategoriesRequestValidator : AppValidator<ReorderCategoriesRequest>
{
    public ReorderCategoriesRequestValidator()
    {
        RuleFor(x => x.Ids)
            .NotEmpty().WithMessage("Thiếu danh sách danh mục")
            .Must(ids => ids.Distinct().Count() == ids.Count).WithMessage("Danh sách danh mục bị trùng");
    }
}
