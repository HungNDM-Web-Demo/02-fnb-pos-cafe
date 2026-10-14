using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Shifts;

namespace Domain.Entities.Pos.Shifts;

/// <summary>Ca bán hàng (bảng <c>Pos_Shifts</c>, FR-21, FR-22). Không bao giờ xóa, chỉ đổi trạng thái.</summary>
public class Shift : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 20;
    public const int CashierNameMaxLength = 150;
    public const int NoteMaxLength = 1000;

    private Shift()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public Guid CashierId { get; private set; }
    public string CashierName { get; private set; } = string.Empty;
    public DateTime OpenedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public decimal OpeningCash { get; private set; }
    public int OrderCount { get; private set; }
    public int CancelledOrderCount { get; private set; }
    public decimal CashSales { get; private set; }
    public decimal TransferSales { get; private set; }
    public decimal CashCancelled { get; private set; }
    public decimal? ExpectedCash { get; private set; }
    public decimal? CountedCash { get; private set; }
    public decimal? Difference { get; private set; }
    public string? Note { get; private set; }
    public ShiftStatus Status { get; private set; }
    public string? ReviewNote { get; private set; }
    public Guid? ReviewedById { get; private set; }
    public string? ReviewedByName { get; private set; }
    public DateTime? ReviewedAt { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public bool IsOpen => Status == ShiftStatus.DangMo;

    /// <summary>UC-03: mở ca với tiền đầu ca; mã <c>CA</c> + <c>yyMMdd</c> + 2 số do service sinh.</summary>
    public static Shift Open(string code, Guid cashierId, string cashierName, DateTime openedAtUtc, decimal openingCash)
    {
        if (openingCash < 0)
            throw new DomainException("Nhập tiền đầu ca");

        return new Shift
        {
            Code = code,
            CashierId = cashierId,
            CashierName = cashierName,
            OpenedAt = openedAtUtc,
            OpeningCash = openingCash,
            Status = ShiftStatus.DangMo
        };
    }

    /// <summary>Số tổng hợp tính từ hóa đơn trong ca (06 §4).</summary>
    public sealed record Totals(int OrderCount, int CancelledOrderCount, decimal CashSales, decimal TransferSales, decimal CashCancelled)
    {
        public decimal Revenue => CashSales + TransferSales;
    }

    /// <summary>BR-11: tiền mặt lý thuyết = tiền đầu ca + tiền mặt của hóa đơn còn hiệu lực (07 §2.6).</summary>
    public static decimal ComputeExpectedCash(decimal openingCash, Totals totals) => openingCash + totals.CashSales;

    /// <summary>BR-12: lệch quá ngưỡng thì "Cần kiểm tra".</summary>
    public static bool NeedsReview(decimal difference) => Math.Abs(difference) > PosRules.ShiftDifferenceThreshold;

    /// <summary>UC-10: chốt ca, ghi số tổng hợp và tính chênh lệch (BR-11, BR-12). Ghi chú bắt buộc khi lệch quá ngưỡng (E1).</summary>
    public void Close(Totals totals, decimal countedCash, string? note, DateTime closedAtUtc)
    {
        if (!IsOpen)
            throw new DomainException("Ca đã chốt");
        if (countedCash < 0)
            throw new DomainException("Nhập tiền mặt thực đếm");

        var expected = ComputeExpectedCash(OpeningCash, totals);
        var difference = countedCash - expected;
        var needsReview = NeedsReview(difference);
        if (needsReview && string.IsNullOrWhiteSpace(note))
            throw new DomainException("Chênh lệch quá 50.000 ₫, cần ghi chú");

        ApplyTotals(totals);
        ExpectedCash = expected;
        CountedCash = countedCash;
        Difference = difference;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ClosedAt = closedAtUtc;
        Status = needsReview ? ShiftStatus.CanKiemTra : ShiftStatus.DaChot;
    }

    /// <summary>FR-25: quản lý ghi chú xử lý ca "Cần kiểm tra".</summary>
    public void Review(string note, Guid reviewerId, string reviewerName, DateTime reviewedAtUtc)
    {
        if (Status != ShiftStatus.CanKiemTra)
            throw new DomainException("Chỉ ghi chú xử lý cho ca Cần kiểm tra");
        if (string.IsNullOrWhiteSpace(note))
            throw new DomainException("Nhập ghi chú xử lý");

        ReviewNote = note.Trim();
        ReviewedById = reviewerId;
        ReviewedByName = reviewerName;
        ReviewedAt = reviewedAtUtc;
        Status = ShiftStatus.DaKiemTra;
    }

    /// <summary>Seeder: ca đã chốt với chênh lệch mong muốn, tùy chọn đã được quản lý kiểm tra.</summary>
    public void ApplySeedClose(Totals totals, decimal difference, string? note, DateTime closedAtUtc)
    {
        ApplyTotals(totals);
        ExpectedCash = ComputeExpectedCash(OpeningCash, totals);
        CountedCash = ExpectedCash + difference;
        Difference = difference;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ClosedAt = closedAtUtc;
        Status = NeedsReview(difference) ? ShiftStatus.CanKiemTra : ShiftStatus.DaChot;
    }

    private void ApplyTotals(Totals totals)
    {
        OrderCount = totals.OrderCount;
        CancelledOrderCount = totals.CancelledOrderCount;
        CashSales = totals.CashSales;
        TransferSales = totals.TransferSales;
        CashCancelled = totals.CashCancelled;
    }
}
