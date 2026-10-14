using Application.Common.Time;
using Application.DTOs.Reports;
using Application.Validators.Common;
using FluentValidation;

namespace Application.Validators.Reports;

/// <summary>Khoảng ngày báo cáo (07 §2): tối đa 366 ngày (TC-30), <c>to</c> không nhỏ hơn <c>from</c>.</summary>
public abstract class ReportRangeQueryValidator<T> : AppValidator<T>
    where T : ReportRangeQuery
{
    public const string MaxDaysMessage = "Khoảng ngày tối đa 366 ngày";
    public const string ToBeforeFromMessage = "Ngày kết thúc phải sau ngày bắt đầu";

    protected ReportRangeQueryValidator()
    {
        RuleFor(x => x.From)
            .OptionalDate()
            .Must((q, _) => !HasBoth(q, out var from, out var to) || to.DayNumber - from.DayNumber + 1 <= ReportRangeQuery.MaxDays)
            .WithMessage(MaxDaysMessage);

        RuleFor(x => x.To)
            .OptionalDate()
            .Must((q, _) => !HasBoth(q, out var from, out var to) || to >= from)
            .WithMessage(ToBeforeFromMessage);
    }

    private static bool HasBoth(ReportRangeQuery query, out DateOnly from, out DateOnly to)
    {
        var ok = VietnamDates.TryParse(query.From, out from) & VietnamDates.TryParse(query.To, out to);
        return ok;
    }
}

public sealed class ReportRangeQueryRootValidator : ReportRangeQueryValidator<ReportRangeQuery>
{
}

public sealed class TopItemsQueryValidator : ReportRangeQueryValidator<TopItemsQuery>
{
    public TopItemsQueryValidator()
    {
        RuleFor(x => x.Limit).Must(v => v is null or >= 1 and <= 100).WithMessage("limit từ 1 đến 100");
    }
}

public sealed class CancelledOrdersQueryValidator : ReportRangeQueryValidator<CancelledOrdersQuery>
{
}
