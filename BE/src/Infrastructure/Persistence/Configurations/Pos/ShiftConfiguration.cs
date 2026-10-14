using Domain.Entities.Pos.Shifts;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

public sealed class ShiftConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> builder)
    {
        builder.ToTable("Pos_Shifts");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Code).HasMaxLength(Shift.CodeMaxLength).IsRequired();
        builder.Property(x => x.CashierName).HasMaxLength(Shift.CashierNameMaxLength).IsRequired();
        builder.Property(x => x.OpeningCash).HasPrecision(18, 2);
        builder.Property(x => x.CashSales).HasPrecision(18, 2);
        builder.Property(x => x.TransferSales).HasPrecision(18, 2);
        builder.Property(x => x.CashCancelled).HasPrecision(18, 2);
        builder.Property(x => x.ExpectedCash).HasPrecision(18, 2);
        builder.Property(x => x.CountedCash).HasPrecision(18, 2);
        builder.Property(x => x.Difference).HasPrecision(18, 2);
        builder.Property(x => x.Note).HasMaxLength(Shift.NoteMaxLength);
        builder.Property(x => x.ReviewNote).HasMaxLength(Shift.NoteMaxLength);
        builder.Property(x => x.ReviewedByName).HasMaxLength(Shift.CashierNameMaxLength);

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => new { x.CashierId, x.Status });
        builder.HasIndex(x => x.OpenedAt);

        // Thu ngân: không xóa tài khoản đang có ca.
        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.CashierId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
