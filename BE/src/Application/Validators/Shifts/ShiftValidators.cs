using Application.DTOs.Shifts;
using Application.Validators.Common;
using Domain.Entities.Pos.Shifts;
using FluentValidation;

namespace Application.Validators.Shifts;

public sealed class OpenShiftRequestValidator : AppValidator<OpenShiftRequest>
{
    public OpenShiftRequestValidator()
    {
        RuleFor(x => x.OpeningCash)
            .NotNull().WithMessage("Nhập tiền đầu ca")
            .GreaterThanOrEqualTo(0).WithMessage("Nhập tiền đầu ca");
    }
}

public sealed class CloseShiftRequestValidator : AppValidator<CloseShiftRequest>
{
    public CloseShiftRequestValidator()
    {
        RuleFor(x => x.CountedCash)
            .NotNull().WithMessage("Nhập tiền mặt thực đếm")
            .GreaterThanOrEqualTo(0).WithMessage("Nhập tiền mặt thực đếm");

        RuleFor(x => x.Note)
            .Must(v => v is null || v.Trim().Length <= Shift.NoteMaxLength)
            .WithMessage($"Ghi chú tối đa {Shift.NoteMaxLength} ký tự");
    }
}

public sealed class ReviewShiftRequestValidator : AppValidator<ReviewShiftRequest>
{
    public ReviewShiftRequestValidator()
    {
        RuleFor(x => x.Note)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Nhập ghi chú xử lý")
            .Must(v => v.Trim().Length <= Shift.NoteMaxLength).WithMessage($"Ghi chú tối đa {Shift.NoteMaxLength} ký tự");
    }
}

public sealed class ShiftQueryValidator : AppValidator<ShiftQuery>
{
    public ShiftQueryValidator()
    {
        RuleFor(x => x.From).OptionalDate();
        RuleFor(x => x.To).OptionalDate();
    }
}
