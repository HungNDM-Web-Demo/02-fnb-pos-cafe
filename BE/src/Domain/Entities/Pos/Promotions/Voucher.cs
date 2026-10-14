using System.Text.RegularExpressions;
using Domain.Base;
using Domain.Common;
using Domain.Enums.Pos.Orders;
using Domain.Enums.Pos.Promotions;

namespace Domain.Entities.Pos.Promotions;

/// <summary>Voucher (bảng <c>Pos_Vouchers</c>, FR-27, BR-06). Mã lưu chữ in hoa, 4–12 ký tự A–Z0–9.</summary>
public partial class Voucher : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 12;
    public const int CodeMinLength = 4;
    public const int DescriptionMaxLength = 200;

    public const string CodeFormatMessage = "Mã 4–12 ký tự chữ in hoa và số";

    private Voucher()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }
    public decimal? MaxDiscount { get; private set; }
    public decimal MinOrderAmount { get; private set; }
    public int? MaxUses { get; private set; }
    public int UsedCount { get; private set; }
    public DateTime? ExpiresAt { get; private set; }
    public bool IsPaused { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public static Voucher Create(
        string code,
        string? description,
        DiscountType discountType,
        decimal discountValue,
        decimal? maxDiscount,
        decimal minOrderAmount,
        int? maxUses,
        DateTime? expiresAtUtc,
        bool isPaused = false)
    {
        var normalized = NormalizeCode(code);
        if (!IsValidCode(normalized))
            throw new DomainException(CodeFormatMessage);

        var voucher = new Voucher { Code = normalized, IsPaused = isPaused };
        voucher.Update(description, discountType, discountValue, maxDiscount, minOrderAmount, maxUses, expiresAtUtc);
        return voucher;
    }

    public static string NormalizeCode(string code) => code.Trim().ToUpperInvariant();

    public static bool IsValidCode(string code) => CodeRegex().IsMatch(code);

    public void Update(
        string? description,
        DiscountType discountType,
        decimal discountValue,
        decimal? maxDiscount,
        decimal minOrderAmount,
        int? maxUses,
        DateTime? expiresAtUtc)
    {
        if (discountType == DiscountType.PhanTram && discountValue is < 1 or > 100)
            throw new DomainException("Phần trăm giảm từ 1 đến 100");
        if (discountType == DiscountType.SoTien && (discountValue <= 0 || !PosRules.IsThousandMultiple(discountValue)))
            throw new DomainException("Số tiền giảm phải là bội số 1.000 ₫");
        if (maxUses is < 1)
            throw new DomainException("Số lượt tối đa phải lớn hơn 0");

        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        DiscountType = discountType;
        DiscountValue = discountValue;
        MaxDiscount = discountType == DiscountType.PhanTram ? maxDiscount : null;
        MinOrderAmount = Math.Max(0, minOrderAmount);
        MaxUses = maxUses;
        ExpiresAt = expiresAtUtc;
    }

    public void SetPaused(bool isPaused) => IsPaused = isPaused;

    public bool IsExpired(DateTime nowUtc) => ExpiresAt is { } expires && nowUtc > expires;

    public bool IsUsedUp => MaxUses is { } max && UsedCount >= max;

    /// <summary>Trạng thái hiển thị (06 §4): tạm dừng, hết hạn, hết lượt, hoạt động.</summary>
    public VoucherStatus GetStatus(DateTime nowUtc) =>
        IsPaused ? VoucherStatus.TamDung
        : IsExpired(nowUtc) ? VoucherStatus.HetHan
        : IsUsedUp ? VoucherStatus.HetLuot
        : VoucherStatus.HoatDong;

    /// <summary>Lý do không dùng được (07 §2.7, đúng thứ tự); null khi hợp lệ. <paramref name="subtotal"/> là tổng tiền hàng.</summary>
    public string? GetRejectReason(DateTime nowUtc, decimal subtotal)
    {
        if (IsDeleted)
            return "Voucher không tồn tại";
        if (IsPaused)
            return "Voucher đang tạm dừng";
        if (IsExpired(nowUtc))
            return "Voucher đã hết hạn";
        if (IsUsedUp)
            return "Voucher đã hết lượt";
        if (subtotal < MinOrderAmount)
            return $"Đơn tối thiểu {PosRules.FormatVnd(MinOrderAmount)}";
        return null;
    }

    /// <summary>BR-06: tăng lượt khi thanh toán thành công.</summary>
    public void RegisterUse() => UsedCount++;

    /// <summary>BR-13: trả lượt khi hủy hóa đơn.</summary>
    public void ReleaseUse() => UsedCount = Math.Max(0, UsedCount - 1);

    [GeneratedRegex("^[A-Z0-9]{4,12}$")]
    private static partial Regex CodeRegex();
}
