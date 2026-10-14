using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Promotions;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

// Bảng khuyến mãi, voucher: Pos_Promotions, Pos_PromotionMenuItems, Pos_Vouchers (06 §4).

public sealed class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.ToTable("Pos_Promotions");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Code).HasMaxLength(Promotion.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Promotion.NameMaxLength).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(Promotion.DescriptionMaxLength);
        builder.Property(x => x.DiscountValue).HasPrecision(18, 2);
        builder.Property(x => x.MaxDiscount).HasPrecision(18, 2);
        builder.Property(x => x.MinOrderAmount).HasPrecision(18, 2);
        builder.Property(x => x.DaysOfWeek).HasMaxLength(Promotion.DaysOfWeekMaxLength).IsRequired();

        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();

        builder.HasOne<Category>()
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.MenuItems)
            .WithOne(x => x.Promotion)
            .HasForeignKey(x => x.PromotionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(x => x.MenuItems).AutoInclude();
    }
}

public sealed class PromotionMenuItemConfiguration : IEntityTypeConfiguration<PromotionMenuItem>
{
    public void Configure(EntityTypeBuilder<PromotionMenuItem> builder)
    {
        builder.ToTable("Pos_PromotionMenuItems");

        builder.HasKey(x => new { x.PromotionId, x.MenuItemId });
        builder.HasIndex(x => x.MenuItemId);

        builder.HasOne(x => x.MenuItem)
            .WithMany()
            .HasForeignKey(x => x.MenuItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(x => !x.Promotion.IsDeleted && !x.MenuItem.IsDeleted);
    }
}

public sealed class VoucherConfiguration : IEntityTypeConfiguration<Voucher>
{
    public void Configure(EntityTypeBuilder<Voucher> builder)
    {
        builder.ToTable("Pos_Vouchers");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Code).HasMaxLength(Voucher.CodeMaxLength).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(Voucher.DescriptionMaxLength);
        builder.Property(x => x.DiscountValue).HasPrecision(18, 2);
        builder.Property(x => x.MaxDiscount).HasPrecision(18, 2);
        builder.Property(x => x.MinOrderAmount).HasPrecision(18, 2);

        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
    }
}
