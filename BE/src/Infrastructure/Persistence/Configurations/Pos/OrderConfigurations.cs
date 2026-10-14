using Domain.Entities.Pos.MenuItems;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Promotions;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Pos;

// Bảng bán hàng: Pos_Orders, Pos_OrderItems, Pos_OrderItemToppings, Pos_Payments (06 §4).

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Pos_Orders");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Code).HasMaxLength(Order.CodeMaxLength);
        builder.Property(x => x.ClientRequestId).HasMaxLength(Order.ClientRequestIdMaxLength);
        builder.Property(x => x.CashierName).HasMaxLength(Order.CashierNameMaxLength).IsRequired();
        builder.Property(x => x.HoldName).HasMaxLength(Order.HoldNameMaxLength);
        builder.Property(x => x.TableTag).HasMaxLength(Order.TableTagMaxLength);
        builder.Property(x => x.Subtotal).HasPrecision(18, 2);
        builder.Property(x => x.LineDiscountTotal).HasPrecision(18, 2);
        builder.Property(x => x.ItemPromotionDiscount).HasPrecision(18, 2);
        builder.Property(x => x.OrderDiscountValue).HasPrecision(18, 2);
        builder.Property(x => x.OrderDiscountAmount).HasPrecision(18, 2);
        builder.Property(x => x.OrderDiscountReason).HasMaxLength(Order.ReasonMaxLength);
        builder.Property(x => x.DiscountApprovedByName).HasMaxLength(Order.ApproverNameMaxLength);
        builder.Property(x => x.PromotionName).HasMaxLength(Order.PromotionNameMaxLength);
        builder.Property(x => x.PromotionDiscount).HasPrecision(18, 2);
        builder.Property(x => x.VoucherCode).HasMaxLength(Order.VoucherCodeMaxLength);
        builder.Property(x => x.VoucherDiscount).HasPrecision(18, 2);
        builder.Property(x => x.DiscountTotal).HasPrecision(18, 2);
        builder.Property(x => x.Total).HasPrecision(18, 2);
        builder.Property(x => x.CustomerPhone).HasMaxLength(Order.CustomerPhoneMaxLength);
        builder.Property(x => x.CancelledByName).HasMaxLength(Order.ApproverNameMaxLength);
        builder.Property(x => x.CancelReason).HasMaxLength(Order.ReasonMaxLength);

        // Unique khi khác null: index có filter theo provider, viết ở đây vì không phải bảng xóa mềm.
        builder.HasIndex(x => x.Code).IsUnique().HasFilter("\"Code\" IS NOT NULL");
        builder.HasIndex(x => x.ClientRequestId).IsUnique().HasFilter("\"ClientRequestId\" IS NOT NULL");
        builder.HasIndex(x => x.ShiftId);
        builder.HasIndex(x => new { x.Status, x.PaidAt });
        builder.HasIndex(x => new { x.CashierId, x.PaidAt });
        builder.HasIndex(x => x.CustomerId);

        builder.HasOne(x => x.Shift)
            .WithMany()
            .HasForeignKey(x => x.ShiftId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.CashierId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Promotion>()
            .WithMany()
            .HasForeignKey(x => x.PromotionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Voucher>()
            .WithMany()
            .HasForeignKey(x => x.VoucherId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Customer)
            .WithMany()
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Items)
            .WithOne()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Payment)
            .WithOne()
            .HasForeignKey<Payment>(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("Pos_OrderItems");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.ItemCode).HasMaxLength(OrderItem.ItemCodeMaxLength).IsRequired();
        builder.Property(x => x.ItemName).HasMaxLength(OrderItem.ItemNameMaxLength).IsRequired();
        builder.Property(x => x.SizeName).HasMaxLength(OrderItem.SizeNameMaxLength).IsRequired();
        builder.Property(x => x.SizePrice).HasPrecision(18, 2);
        builder.Property(x => x.Note).HasMaxLength(OrderItem.NoteMaxLength);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Property(x => x.LineTotal).HasPrecision(18, 2);
        builder.Property(x => x.DiscountValue).HasPrecision(18, 2);
        builder.Property(x => x.DiscountAmount).HasPrecision(18, 2);
        builder.Property(x => x.DiscountReason).HasMaxLength(OrderItem.DiscountReasonMaxLength);
        builder.Property(x => x.PromotionName).HasMaxLength(Order.PromotionNameMaxLength);
        builder.Property(x => x.PromotionDiscount).HasPrecision(18, 2);

        builder.HasIndex(x => x.OrderId);
        builder.HasIndex(x => x.MenuItemId);

        // BR-18: món đã bán không xóa được.
        builder.HasOne<MenuItem>()
            .WithMany()
            .HasForeignKey(x => x.MenuItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Toppings)
            .WithOne()
            .HasForeignKey(x => x.OrderItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OrderItemToppingConfiguration : IEntityTypeConfiguration<OrderItemTopping>
{
    public void Configure(EntityTypeBuilder<OrderItemTopping> builder)
    {
        builder.ToTable("Pos_OrderItemToppings");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.ToppingName).HasMaxLength(OrderItemTopping.NameMaxLength).IsRequired();
        builder.Property(x => x.Price).HasPrecision(18, 2);

        builder.HasIndex(x => x.OrderItemId);

        builder.HasOne<Topping>()
            .WithMany()
            .HasForeignKey(x => x.ToppingId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Pos_Payments");
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.CashReceived).HasPrecision(18, 2);
        builder.Property(x => x.ChangeAmount).HasPrecision(18, 2);
        builder.Property(x => x.QrContent).HasMaxLength(Payment.QrContentMaxLength);

        builder.HasIndex(x => x.OrderId).IsUnique();
    }
}
