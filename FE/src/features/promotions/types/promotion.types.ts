import type { PaginationQuery } from '@/types/api'
import type { DiscountType } from '@/features/orders/types/order.types'

/** DTO khuyến mãi, voucher: docs/07-DANH-SACH-API.md §2.7. */

export type PromotionScope = 'HoaDon' | 'DanhMuc' | 'Mon'
export type PromotionStatus = 'SapChay' | 'DangChay' | 'DaHet' | 'TamDung'
export type VoucherStatus = 'HoatDong' | 'HetLuot' | 'HetHan' | 'TamDung'

export const promotionScopeLabels: Record<PromotionScope, string> = {
  HoaDon: 'Cả hóa đơn',
  DanhMuc: 'Theo danh mục',
  Mon: 'Theo món',
}
export const promotionStatusLabels: Record<PromotionStatus, string> = {
  SapChay: 'Sắp chạy',
  DangChay: 'Đang chạy',
  DaHet: 'Đã hết',
  TamDung: 'Tạm dừng',
}
export const voucherStatusLabels: Record<VoucherStatus, string> = {
  HoatDong: 'Hoạt động',
  HetLuot: 'Hết lượt',
  HetHan: 'Hết hạn',
  TamDung: 'Tạm dừng',
}

export type PromotionDto = {
  id: string
  code: string
  name: string
  description?: string
  discountType: DiscountType
  discountValue: number
  maxDiscount?: number
  scope: PromotionScope
  categoryId?: string
  categoryName?: string
  /** Khi scope = Mon */
  menuItemIds: string[]
  minOrderAmount: number
  /** "14:00" */
  startTime?: string
  endTime?: string
  /** 1 = Thứ Hai … 7 = Chủ nhật; rỗng = mọi ngày */
  daysOfWeek: number[]
  /** yyyy-MM-dd theo giờ Việt Nam */
  startDate: string
  endDate: string
  isPaused: boolean
  status: PromotionStatus
  updatedAt: string
}

export type SavePromotionRequest = Omit<
  PromotionDto,
  'id' | 'code' | 'categoryName' | 'status' | 'updatedAt' | 'isPaused'
>

export type PromotionQuery = PaginationQuery & { status?: PromotionStatus }

export type VoucherDto = {
  id: string
  code: string
  description?: string
  discountType: DiscountType
  discountValue: number
  maxDiscount?: number
  minOrderAmount: number
  maxUses?: number
  usedCount: number
  /** ISO UTC */
  expiresAt?: string
  isPaused: boolean
  status: VoucherStatus
  updatedAt: string
}

export type SaveVoucherRequest = Omit<
  VoucherDto,
  'id' | 'usedCount' | 'status' | 'updatedAt' | 'isPaused'
>

export type VoucherQuery = PaginationQuery & { status?: VoucherStatus }

export type PauseRequest = { isPaused: boolean }

export type VoucherCheckRequest = { code: string; subtotal: number }

export type VoucherCheckResult = {
  voucherId: string
  code: string
  discountType: DiscountType
  discountValue: number
  maxDiscount?: number
  minOrderAmount: number
  /** Tính trên subtotal gửi lên theo 07 §3; BE tính lại khi thanh toán */
  estimatedDiscount: number
}
