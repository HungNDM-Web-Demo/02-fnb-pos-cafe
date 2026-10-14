import type { PaginationQuery } from '@/types/api'
import type { PaymentMethod } from '@/features/orders/types/order.types'

/** DTO báo cáo: docs/07-DANH-SACH-API.md §2.8. Chỉ tính hóa đơn DaThanhToan theo paidAt (BR-16). */

export type DateRangeQuery = { from: string; to: string }

export type DashboardReport = {
  /** Hôm nay yyyy-MM-dd */
  date: string
  /** Thời điểm tính (ISO) */
  asOf: string
  revenue: number
  orderCount: number
  /** 0 khi chưa có hóa đơn */
  avgOrderValue: number
  /** Hôm qua tới cùng giờ:phút */
  yesterdaySameTime: { revenue: number; orderCount: number }
  /** 1 chữ số; null khi hôm qua = 0 */
  revenueChangePercent?: number
  /** 24 phần tử, 0–23 */
  hourly: { hour: number; revenue: number; orderCount: number }[]
  /** 5, theo quantity */
  topItems: { menuItemId: string; code: string; name: string; quantity: number; revenue: number }[]
  openShifts: { id: string; code: string; cashierName: string; openedAt: string }[]
}

export type RevenueReport = {
  from: string
  to: string
  totals: { revenue: number; orderCount: number; discount: number; avgOrderValue: number }
  previous: { from: string; to: string; revenue: number; orderCount: number; discount: number }
  revenueChangePercent?: number
  /** Đủ mọi ngày trong khoảng; previousRevenue là ngày cùng vị trí ở kỳ trước */
  daily: {
    date: string
    revenue: number
    orderCount: number
    discount: number
    previousRevenue: number
  }[]
}

export type TopItemsQuery = DateRangeQuery & { categoryId?: string; limit?: number }

export type TopItemsReport = {
  totalQuantity: number
  totalRevenue: number
  items: {
    menuItemId: string
    code: string
    name: string
    categoryId: string
    categoryName: string
    quantity: number
    revenue: number
    /** % doanh thu, 1 chữ số */
    share: number
  }[]
}

export type HeatmapReport = {
  /** 7 × 24, dayOfWeek 1 = Thứ Hai … 7 = Chủ nhật */
  cells: { dayOfWeek: number; hour: number; revenue: number; orderCount: number }[]
  maxRevenue: number
}

export type PaymentMethodReport = {
  /** Luôn đủ 2 phương thức */
  items: { method: PaymentMethod; amount: number; orderCount: number; share: number }[]
}

export type CashierReport = {
  items: {
    cashierId: string
    cashierName: string
    shiftCount: number
    orderCount: number
    revenue: number
    totalDifference: number
    shiftsNeedingReview: number
  }[]
}

export type CancelledOrderItem = {
  id: string
  code: string
  paidAt: string
  cancelledAt: string
  cashierName: string
  cancelledByName: string
  cancelReason: string
  total: number
  paymentMethod: PaymentMethod
}

export type CancelledOrdersQuery = DateRangeQuery & PaginationQuery
