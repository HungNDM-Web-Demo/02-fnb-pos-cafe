import type { PaginationQuery } from '@/types/api'
import type { OrderListItem } from '@/features/orders/types/order.types'

/** DTO khách hàng (P3): docs/07-DANH-SACH-API.md §2.9. */

export type CustomerDto = {
  id: string
  phone: string
  name: string
  note?: string
  points: number
  orderCount: number
  totalSpent: number
  lastOrderAt?: string
  createdAt: string
}

export type SaveCustomerRequest = { phone: string; name: string; note?: string }

/** Kèm 20 hóa đơn gần nhất */
export type CustomerDetail = CustomerDto & { recentOrders: OrderListItem[] }

export type CustomerQuery = PaginationQuery
