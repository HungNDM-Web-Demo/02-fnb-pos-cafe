using Domain.Base;
using Domain.Common;

namespace Domain.Entities.Crm.Customers;

/// <summary>Khách tích điểm (bảng <c>Crm_Customers</c>, FR-33, FR-34, P3). Cột tổng hợp cập nhật ngay khi thanh toán, hủy.</summary>
public class Customer : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int PhoneMaxLength = 20;
    public const int NameMaxLength = 150;
    public const int NoteMaxLength = 500;

    private Customer()
    {
    }

    public string Phone { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int Points { get; private set; }
    public int OrderCount { get; private set; }
    public decimal TotalSpent { get; private set; }
    public DateTime? LastOrderAt { get; private set; }
    public string? Note { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public static Customer Create(string phone, string name, string? note)
    {
        var customer = new Customer { Phone = NormalizePhone(phone) };
        customer.Update(name, note);
        return customer;
    }

    /// <summary>Lưu 10 số liền: bỏ khoảng trắng, dấu chấm, gạch ngang (06 §4).</summary>
    public static string NormalizePhone(string phone) => new(phone.Where(char.IsDigit).ToArray());

    public void ChangePhone(string phone) => Phone = NormalizePhone(phone);

    public void Update(string name, string? note)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Tên khách không được để trống.");

        Name = name.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    /// <summary>Cộng điểm và tổng hợp khi hóa đơn thanh toán (BR-17).</summary>
    public void RecordOrder(int points, decimal total, DateTime paidAtUtc)
    {
        Points += points;
        OrderCount++;
        TotalSpent += total;
        if (LastOrderAt is null || paidAtUtc > LastOrderAt)
            LastOrderAt = paidAtUtc;
    }

    /// <summary>Trừ lại khi hủy hóa đơn (BR-13).</summary>
    public void RevertOrder(int points, decimal total)
    {
        Points = Math.Max(0, Points - points);
        OrderCount = Math.Max(0, OrderCount - 1);
        TotalSpent = Math.Max(0, TotalSpent - total);
    }
}
