import type {
  CartLineInput,
  ManualDiscount,
  ServiceType,
} from '@/features/orders/types/order.types'
import type { VoucherCheckResult } from '@/features/promotions/types/promotion.types'

/** GET /api/store-profile: thông tin quán in trên bill và QR (07 §2.10) */
export type StoreProfile = {
  name: string
  address: string
  phone: string
  receiptFooter: string
  /** Mã ngân hàng VietQR */
  bankBin: string
  bankAccount: string
  bankAccountName: string
}

/** Một dòng trong giỏ hàng trên máy (state Zustand, lưu sessionStorage, NFR-05) */
export type CartLine = CartLineInput & {
  /** Khóa ổn định để React và thao tác sửa/xóa; không gửi lên BE */
  key: string
}

export type CartCustomer = { id: string; phone: string; name: string }

export type DiscountApproval = {
  token: string
  approvedByName: string
  expiresAt: string
}

export type CartState = {
  lines: CartLine[]
  serviceType: ServiceType
  tableTag: string
  orderDiscount: ManualDiscount | null
  voucher: VoucherCheckResult | null
  customer: CartCustomer | null
  /** Giỏ mở lại từ đơn giữ: thanh toán sẽ cập nhật chính bản ghi đó */
  heldOrderId: string | null
  holdName: string | null
  /** Mã duyệt giảm giá vượt hạn mức của quản lý (FR-15) */
  approval: DiscountApproval | null
  /** uuid sinh khi mở hộp thanh toán, giữ nguyên khi bấm lại (TC-24) */
  clientRequestId: string | null
}
