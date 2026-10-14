namespace Application.Constants;

/// <summary>
/// Mã quyền nghiệp vụ của POS Quán Cafe (02-SRS §7, 07-DANH-SACH-API §1). Tách khỏi <see cref="Permissions"/> (quyền nền)
/// để không sửa file nền. Mỗi mã phải có trong FE/src/mock/seed/project.json và FE src/config/permissions.ts;
/// test <c>ProjectPermissionConstantsTests</c> kiểm tra việc này.
/// </summary>
public static class ProjectPermissions
{
    public static class MenuItems
    {
        public const string View = "menu-items.view";
        public const string Create = "menu-items.create";
        public const string Update = "menu-items.update";
        public const string Delete = "menu-items.delete";

        /// <summary>Báo tạm hết, bán lại (FR-06); thu ngân cũng có.</summary>
        public const string Availability = "menu-items.availability";
    }

    public static class Orders
    {
        /// <summary>Bán hàng, giữ đơn, thanh toán; cũng dùng để đọc thực đơn gộp và khuyến mãi đang chạy.</summary>
        public const string Create = "orders.create";

        /// <summary>Tra cứu hóa đơn của mình.</summary>
        public const string View = "orders.view";

        /// <summary>Tra cứu hóa đơn của mọi thu ngân.</summary>
        public const string ViewAll = "orders.view-all";

        /// <summary>Giảm giá trong hạn mức, nhập voucher.</summary>
        public const string Discount = "orders.discount";

        /// <summary>Xác nhận giảm giá vượt hạn mức (FR-15).</summary>
        public const string DiscountOverride = "orders.discount-override";

        /// <summary>In lại hóa đơn (FE kiểm tra, không có endpoint riêng).</summary>
        public const string Reprint = "orders.reprint";

        public const string Cancel = "orders.cancel";
    }

    public static class Shifts
    {
        /// <summary>Mở ca, chốt ca của mình.</summary>
        public const string Operate = "shifts.operate";

        /// <summary>Xem mọi ca.</summary>
        public const string View = "shifts.view";

        /// <summary>Ghi chú xử lý ca cần kiểm tra (FR-25).</summary>
        public const string Review = "shifts.review";
    }

    public static class Promotions
    {
        public const string View = "promotions.view";
        public const string Create = "promotions.create";
        public const string Update = "promotions.update";
        public const string Delete = "promotions.delete";
    }

    public static class Reports
    {
        public const string View = "reports.view";
    }

    public static class Customers
    {
        public const string View = "customers.view";
        public const string Create = "customers.create";
    }
}
