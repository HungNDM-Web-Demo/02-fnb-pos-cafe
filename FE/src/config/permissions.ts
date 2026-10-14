/**
 * Mã quyền, khai báo giống hệt BE `Application/Constants/Permissions.cs`
 * và danh sách seed `src/mock/seed/system.json` (+ project.json).
 * Định dạng `{resource}.{action}`. Không gõ chuỗi mã quyền trực tiếp trong component.
 */
export const permissions = {
  dashboard: {
    view: 'dashboard.view',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
  },
  roles: {
    view: 'roles.view',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
  },
  settings: {
    view: 'settings.view',
    update: 'settings.update',
  },
  auditLogs: {
    view: 'audit-logs.view',
  },
  // ───── Quyền nghiệp vụ POS Quán Cafe (02-SRS §7, 07-DANH-SACH-API §1) ─────
  menuItems: {
    view: 'menu-items.view',
    create: 'menu-items.create',
    update: 'menu-items.update',
    delete: 'menu-items.delete',
    /** Báo tạm hết, bán lại (FR-06) */
    availability: 'menu-items.availability',
  },
  orders: {
    /** Bán hàng, giữ đơn, thanh toán (UC-04 → UC-07) */
    create: 'orders.create',
    /** Tra cứu hóa đơn của mình */
    view: 'orders.view',
    /** Tra cứu hóa đơn của mọi thu ngân */
    viewAll: 'orders.view-all',
    /** Giảm giá trong hạn mức, nhập voucher (BR-04) */
    discount: 'orders.discount',
    /** Xác nhận giảm giá vượt hạn mức (FR-15) */
    discountOverride: 'orders.discount-override',
    reprint: 'orders.reprint',
    cancel: 'orders.cancel',
  },
  shifts: {
    /** Mở ca, chốt ca của mình */
    operate: 'shifts.operate',
    /** Xem mọi ca */
    view: 'shifts.view',
    /** Ghi chú xử lý ca cần kiểm tra (FR-25) */
    review: 'shifts.review',
  },
  promotions: {
    view: 'promotions.view',
    create: 'promotions.create',
    update: 'promotions.update',
    delete: 'promotions.delete',
  },
  reports: {
    view: 'reports.view',
  },
  customers: {
    view: 'customers.view',
    create: 'customers.create',
  },
} as const

/** Mã vai trò hệ thống (BR-SYS-06) và vai trò riêng của dự án. */
export const roleCodes = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  staff: 'STAFF',
  cashier: 'CASHIER',
} as const

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T]
export type PermissionCode = Leaves<typeof permissions>
