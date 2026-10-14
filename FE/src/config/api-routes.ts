/** Endpoint BE (QUY-UOC-API §3, docs/07-DANH-SACH-API.md §2). Đường dẫn tương đối, lib/axios.ts ghép với NEXT_PUBLIC_API_URL. */
export const apiRoutes = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    changePassword: '/api/auth/me/password',
  },
  demo: {
    accounts: '/api/demo/accounts',
    loginAs: '/api/demo/login-as',
    reset: '/api/demo/reset',
  },
  users: {
    list: '/api/users',
    detail: (id: string) => `/api/users/${id}`,
    lock: (id: string) => `/api/users/${id}/lock`,
    resetPassword: (id: string) => `/api/users/${id}/reset-password`,
  },
  roles: {
    list: '/api/roles',
    detail: (id: string) => `/api/roles/${id}`,
    permissions: (id: string) => `/api/roles/${id}/permissions`,
  },
  permissions: {
    list: '/api/permissions',
  },
  settings: {
    public: '/api/settings/public',
    list: '/api/settings',
  },
  uploads: {
    images: '/api/uploads/images',
  },
  auditLogs: {
    list: '/api/audit-logs',
  },

  // ───── Nghiệp vụ POS Quán Cafe (07-DANH-SACH-API §2) ─────
  /** §2.1 thực đơn gộp cho màn bán hàng */
  menu: '/api/menu',
  categories: {
    list: '/api/categories',
    detail: (id: string) => `/api/categories/${id}`,
    order: '/api/categories/order',
  },
  menuItems: {
    list: '/api/menu-items',
    detail: (id: string) => `/api/menu-items/${id}`,
    availability: (id: string) => `/api/menu-items/${id}/availability`,
    hidden: (id: string) => `/api/menu-items/${id}/hidden`,
    image: (id: string) => `/api/menu-items/${id}/image`,
  },
  toppings: {
    list: '/api/toppings',
    detail: (id: string) => `/api/toppings/${id}`,
    availability: (id: string) => `/api/toppings/${id}/availability`,
    hidden: (id: string) => `/api/toppings/${id}/hidden`,
  },
  orders: {
    list: '/api/orders',
    detail: (id: string) => `/api/orders/${id}`,
    nextCode: '/api/orders/next-code',
    cancel: (id: string) => `/api/orders/${id}/cancel`,
    held: '/api/orders/held',
    heldDetail: (id: string) => `/api/orders/held/${id}`,
    discountApprovals: '/api/orders/discount-approvals',
  },
  shifts: {
    list: '/api/shifts',
    current: '/api/shifts/current',
    currentSummary: '/api/shifts/current/summary',
    close: '/api/shifts/current/close',
    detail: (id: string) => `/api/shifts/${id}`,
    review: (id: string) => `/api/shifts/${id}/review`,
  },
  promotions: {
    list: '/api/promotions',
    active: '/api/promotions/active',
    detail: (id: string) => `/api/promotions/${id}`,
    pause: (id: string) => `/api/promotions/${id}/pause`,
  },
  vouchers: {
    list: '/api/vouchers',
    detail: (id: string) => `/api/vouchers/${id}`,
    pause: (id: string) => `/api/vouchers/${id}/pause`,
    check: '/api/vouchers/check',
  },
  reports: {
    dashboard: '/api/reports/dashboard',
    revenue: '/api/reports/revenue',
    topItems: '/api/reports/top-items',
    heatmap: '/api/reports/heatmap',
    paymentMethods: '/api/reports/payment-methods',
    cashiers: '/api/reports/cashiers',
    cancelledOrders: '/api/reports/cancelled-orders',
  },
  customers: {
    list: '/api/customers',
    lookup: '/api/customers/lookup',
    detail: (id: string) => `/api/customers/${id}`,
  },
  storeProfile: '/api/store-profile',
} as const
