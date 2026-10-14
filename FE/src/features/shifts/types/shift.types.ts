import type { PaginationQuery } from '@/types/api'
import type { OrderListItem } from '@/features/orders/types/order.types'

/** DTO ca làm: docs/07-DANH-SACH-API.md §2.6. */

export type ShiftStatus = 'DangMo' | 'DaChot' | 'CanKiemTra' | 'DaKiemTra'

export const shiftStatusLabels: Record<ShiftStatus, string> = {
  DangMo: 'Đang mở',
  DaChot: 'Đã chốt',
  CanKiemTra: 'Cần kiểm tra',
  DaKiemTra: 'Đã kiểm tra',
}

/** BR-12: lệch quá 50.000 ₫ thì ca "Cần kiểm tra" */
export const SHIFT_DIFFERENCE_LIMIT = 50_000

export type ShiftDto = {
  id: string
  code: string
  status: ShiftStatus
  cashierId: string
  cashierName: string
  openedAt: string
  closedAt?: string
  openingCash: number
  orderCount: number
  cancelledOrderCount: number
  cashSales: number
  transferSales: number
  cashCancelled: number
  expectedCash?: number
  countedCash?: number
  difference?: number
  note?: string
  reviewNote?: string
  reviewedByName?: string
  reviewedAt?: string
}

export type ShiftSummary = {
  shiftId: string
  code: string
  openedAt: string
  openingCash: number
  /** DaThanhToan */
  orderCount: number
  cancelledOrderCount: number
  cashSales: number
  transferSales: number
  /** Tiền mặt của hóa đơn DaHuy (thông tin) */
  cashCancelled: number
  /** cashSales + transferSales */
  revenue: number
  /** BR-11 */
  expectedCash: number
  /** BR-15 */
  heldOrders: { id: string; holdName: string; total: number }[]
}

export type OpenShiftRequest = { openingCash: number }
export type CloseShiftRequest = { countedCash: number; note?: string }
export type ReviewShiftRequest = { note: string }

export type ShiftListItem = {
  id: string
  code: string
  status: ShiftStatus
  cashierName: string
  openedAt: string
  closedAt?: string
  orderCount: number
  /** cashSales + transferSales; ca đang mở tính tạm thời */
  revenue: number
  expectedCash?: number
  countedCash?: number
  difference?: number
}

export type ShiftDetail = ShiftDto & {
  revenue: number
  /** Mọi hóa đơn của ca, gồm đã hủy, theo paidAt */
  orders: OrderListItem[]
}

export type ShiftQuery = PaginationQuery & {
  from?: string
  to?: string
  cashierId?: string
  status?: ShiftStatus
}
