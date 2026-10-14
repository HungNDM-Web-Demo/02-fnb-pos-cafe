using Domain.Entities.Pos.MenuItems;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

// Bảng thực đơn: Pos_Categories, Pos_MenuItems, Pos_MenuItemSizes, Pos_Toppings, Pos_MenuItemToppings (06 §4).

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Pos_Categories");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Code).HasMaxLength(Category.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Category.NameMaxLength).IsRequired();
        builder.Property(x => x.Color).HasMaxLength(Category.ColorMaxLength).IsRequired();

        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
    }
}

public sealed class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("Pos_MenuItems");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Code).HasMaxLength(MenuItem.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(MenuItem.NameMaxLength).IsRequired();
        builder.Property(x => x.ImageUrl).HasMaxLength(MenuItem.ImageUrlMaxLength);
        builder.Property(x => x.Description).HasMaxLength(MenuItem.DescriptionMaxLength);

        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
        builder.HasIndex(x => new { x.CategoryId, x.SortOrder });

        // Danh mục chặn xóa khi còn món (service kiểm tra, DB bảo vệ thêm).
        builder.HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Sizes)
            .WithOne()
            .HasForeignKey(x => x.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.MenuItemToppings)
            .WithOne(x => x.MenuItem)
            .HasForeignKey(x => x.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(x => x.Sizes).AutoInclude();
        builder.Navigation(x => x.MenuItemToppings).AutoInclude();
    }
}

public sealed class MenuItemSizeConfiguration : IEntityTypeConfiguration<MenuItemSize>
{
    public void Configure(EntityTypeBuilder<MenuItemSize> builder)
    {
        builder.ToTable("Pos_MenuItemSizes");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Name).HasMaxLength(MenuItemSize.NameMaxLength).IsRequired();
        builder.Property(x => x.Price).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.MenuItemId, x.Name }).IsUnique();
    }
}

public sealed class ToppingConfiguration : IEntityTypeConfiguration<Topping>
{
    public void Configure(EntityTypeBuilder<Topping> builder)
    {
        builder.ToTable("Pos_Toppings");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Code).HasMaxLength(Topping.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Topping.NameMaxLength).IsRequired();
        builder.Property(x => x.Price).HasPrecision(18, 2);

        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
    }
}

public sealed class MenuItemToppingConfiguration : IEntityTypeConfiguration<MenuItemTopping>
{
    public void Configure(EntityTypeBuilder<MenuItemTopping> builder)
    {
        builder.ToTable("Pos_MenuItemToppings");

        builder.HasKey(x => new { x.MenuItemId, x.ToppingId });
        builder.HasIndex(x => x.ToppingId);

        builder.HasOne(x => x.Topping)
            .WithMany()
            .HasForeignKey(x => x.ToppingId)
            .OnDelete(DeleteBehavior.Cascade);

        // Ẩn cùng món, topping đã xóa mềm.
        builder.HasQueryFilter(x => !x.MenuItem.IsDeleted && !x.Topping.IsDeleted);
    }
}
