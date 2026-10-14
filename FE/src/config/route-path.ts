/** Đường dẫn FE (kebab-case). Không gõ đường dẫn trực tiếp trong component. */
export const routePath = {
  root: '/',
  login: '/login',
  forbidden: '/forbidden',
  profile: '/profile',

  dashboard: '/dashboard',

  // ───── Nghiệp vụ POS Quán Cafe (02-SRS §9) ─────
  /** SCR-02 Bán hàng (toàn màn hình, không sidebar) */
  pos: '/pos',
  /** SCR-05 Bản in hóa đơn khổ 80 mm */
  posReceipt: (id: string) => `/pos/receipt/${id}`,
  /** SCR-07 Danh sách ca (quản lý) */
  shifts: '/shifts',
  /** SCR-06 Mở ca, chốt ca của thu ngân */
  shiftsCurrent: '/shifts/current',
  /** Phiếu chốt ca */
  shiftReceipt: (id: string) => `/shifts/receipt/${id}`,
  /** SCR-08 Danh sách hóa đơn */
  orders: '/orders',
  /** SCR-09 Thực đơn */
  menuItems: '/menu-items',
  /** SCR-10 Khuyến mãi và voucher */
  promotions: '/promotions',
  /** SCR-11 Báo cáo */
  reports: '/reports',
  /** SCR-12 Khách hàng */
  customers: '/customers',

  settingsUsers: '/settings/users',
  settingsRoles: '/settings/roles',
  settingsGeneral: '/settings/general',
  settingsAuditLogs: '/settings/audit-logs',
} as const
