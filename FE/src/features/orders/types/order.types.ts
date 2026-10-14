import type { PaginationQuery } from '@/types/api'

/** DTO bán hàng, hóa đơn: docs/07-DANH-SACH-API.md §2.5. Enum chuỗi PascalCase khớp 06 §4. */

export type OrderStatus = 'DangGiu' | 'DaThanhToan' | 'DaHuy'
export type ServiceType = 'MangDi' | 'TaiCho'
export type PaymentMethod = 'TienMat' | 'ChuyenKhoan'
export type DiscountType = 'PhanTram' | 'SoTien'
export type IceLevel = 'KhongDa' | 'It' | 'Vua' | 'Nhieu'
export type SugarLevel = 0 | 30 | 50 | 70 | 100

export const SUGAR_LEVELS: SugarLevel[] = [0, 30, 50, 70, 100]
export const ICE_LEVELS: IceLevel[] = ['KhongDa', 'It', 'Vua', 'Nhieu']

export const iceLevelLabels: Record<IceLevel, string> = {
  KhongDa: 'Không đá',
  It: 'Ít đá',
  Vua: 'Vừa',
  Nhieu: 'Nhiều đá',
}

export const serviceTypeLabels: Record<ServiceType, string> = {
  MangDi: 'Mang đi',
  TaiCho: 'Tại chỗ',
}
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  TienMat: 'Tiền mặt',
  ChuyenKhoan: 'Chuyển khoản',
}
export const orderStatusLabels: Record<OrderStatus, string> = {
  DangGiu: 'Đang giữ',
  DaThanhToan: 'Đã thanh toán',
  DaHuy: 'Đã hủy',
}
export const discountTypeLabels: Record<DiscountType, string> = {
  PhanTram: 'Phần trăm',
  SoTien: 'Số tiền',
}

/** Giảm giá thủ công nhập ở màn bán hàng (dòng hoặc hóa đơn) */
export type ManualDiscount = { type: DiscountType; value: number; reason: string }

// ───────────────────────── Giỏ hàng gửi lên ─────────────────────────

export type CartLineInput = {
  menuItemId: string
  /** Phải là size hiện có của món */
  sizeName: string
  /** 1–99 */
  quantity: number
  /** Nằm trong toppingIds của món, chưa ẩn, chưa tạm hết */
  toppingIds: string[]
  /** Bắt buộc khi hasSugarOption */
  sugarLevel?: SugarLevel
  /** Bắt buộc khi hasIceOption */
  iceLevel?: IceLevel
  /** ≤ 200 ký tự */
  note?: string
  /** Giảm giá dòng (FR-12) */
  discount?: ManualDiscount
}

export type CartInput = {
  serviceType: ServiceType
  /** Bắt buộc khi TaiCho (TC-15) */
  tableTag?: string
  items: CartLineInput[]
  /** Giảm giá hóa đơn thủ công */
  orderDiscount?: ManualDiscount
  voucherCode?: string
  customerId?: string
}

/** POST /api/orders/held; holdName mặc định "Đơn N" */
export type HoldOrderRequest = CartInput & { holdName?: string }

export type CheckoutPayment = {
  method: PaymentMethod
  /** Bắt buộc khi TienMat, ≥ total (BR-08) */
  cashReceived?: number
  /** Chuỗi QR đã hiển thị, lưu để in lại */
  qrContent?: string
}

/** POST /api/orders */
export type CheckoutRequest = CartInput & {
  /** uuid FE sinh khi mở hộp thanh toán; giữ nguyên khi bấm lại (TC-24) */
  clientRequestId: string
  /** Thanh toán từ đơn giữ: cập nhật chính bản ghi đó */
  heldOrderId?: string
  payment: CheckoutPayment
  /** Từ POST /api/orders/discount-approvals khi vượt hạn mức */
  discountApprovalToken?: string
  /** Tổng FE đã hiển thị; khác tổng BE tính → 409 kèm serverTotal */
  expectedTotal: number
}

// ───────────────────────── DTO trả về ─────────────────────────

export type OrderItemToppingDto = { toppingId: string; name: string; price: number }

export type AppliedDiscount = { type: DiscountType; value: number; amount: number; reason: string }
export type AppliedPromotion = { promotionId: string; name: string; amount: number }

export type OrderItemDto = {
  id: string
  menuItemId: string
  itemCode: string
  itemName: string
  categoryId: string
  sizeName: string
  sizePrice: number
  toppings: OrderItemToppingDto[]
  sugarLevel?: SugarLevel
  iceLevel?: IceLevel
  note?: string
  quantity: number
  /** sizePrice + Σ topping */
  unitPrice: number
  /** unitPrice × quantity (BR-01) */
  lineTotal: number
  discount?: AppliedDiscount
  /** Khuyến mãi cấp món */
  promotion?: AppliedPromotion
  /** lineTotal − discount.amount − promotion.amount */
  lineNet: number
  /** Chỉ có ý nghĩa ở HeldOrderDto: món hoặc topping đã tạm hết/ẩn (BR-14, TC-05) */
  unavailable: boolean
}

export type OrderDto = {
  id: string
  /** null khi DangGiu */
  code?: string
  status: OrderStatus
  shiftId: string
  shiftCode: string
  cashierId: string
  cashierName: string
  serviceType: ServiceType
  tableTag?: string
  items: OrderItemDto[]
  /** Σ lineTotal */
  subtotal: number
  lineDiscountTotal: number
  itemPromotionDiscount: number
  orderDiscount?: AppliedDiscount & { approvedByName?: string }
  /** Khuyến mãi cấp hóa đơn */
  promotion?: AppliedPromotion
  voucher?: { voucherId: string; code: string; amount: number }
  discountTotal: number
  /** BR-02 */
  total: number
  customer?: { id: string; phone: string; name: string }
  /** BR-17 */
  pointsEarned: number
  payment?: {
    method: PaymentMethod
    amount: number
    cashReceived?: number
    changeAmount?: number
    qrContent?: string
  }
  paidAt?: string
  cancelledAt?: string
  cancelledByName?: string
  cancelReason?: string
  createdAt: string
}

export type OrderListItem = {
  id: string
  code: string
  status: OrderStatus
  paidAt: string
  cashierName: string
  serviceType: ServiceType
  tableTag?: string
  /** Σ quantity */
  itemCount: number
  total: number
  discountTotal: number
  paymentMethod: PaymentMethod
  voucherCode?: string
  cancelReason?: string
}

export type HeldOrderDto = OrderDto & {
  holdName: string
  /** Có dòng unavailable → FE cảnh báo và khóa Thanh toán (TC-05) */
  hasUnavailableItems: boolean
}

export type OrderQuery = PaginationQuery & {
  from?: string
  to?: string
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  shiftId?: string
  cashierId?: string
}

export type CancelOrderRequest = { reason: string }

export type NextCodeResult = { code: string }

export type DiscountApprovalRequest = { username: string; password: string }
export type DiscountApprovalDto = {
  /** Chuỗi ngẫu nhiên, 5 phút, dùng một lần */
  token: string
  approvedById: string
  /** Tên đăng nhập, ghi vào hóa đơn (TC-17 "quanly") */
  approvedByName: string
  expiresAt: string
}
