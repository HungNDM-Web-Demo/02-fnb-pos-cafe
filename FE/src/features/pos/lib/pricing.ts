import type {
  AppliedDiscount,
  AppliedPromotion,
  DiscountType,
  IceLevel,
  ManualDiscount,
  OrderItemToppingDto,
  SugarLevel,
} from '@/features/orders/types/order.types'
import type { PromotionDto } from '@/features/promotions/types/promotion.types'

/**
 * Công thức tính tiền (docs/07-DANH-SACH-API.md §3) — nguồn sự thật chung của giỏ hàng trên máy
 * (NFR-02), handler mock và seed. BE `OrderPricingService` phải ra cùng số với cùng đầu vào.
 * Hàm thuần, không đọc localStorage, không phụ thuộc React.
 */

/** BR-03: làm tròn xuống tới bội số 1.000 ₫ */
export const roundDown = (x: number) => Math.floor(x / 1000) * 1000

/** BR-04: thu ngân tự giảm tối đa 10% tổng tiền hàng */
export const CASHIER_DISCOUNT_PERCENT = 10

export type PricingLineInput = {
  /** Khóa dòng để trả kết quả tương ứng (tùy chọn) */
  key?: string
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
  discount?: ManualDiscount
}

export type PricingVoucher = {
  voucherId: string
  code: string
  discountType: DiscountType
  discountValue: number
  maxDiscount?: number
  minOrderAmount: number
}

export type PricingInput = {
  lines: PricingLineInput[]
  orderDiscount?: ManualDiscount | null
  /** Voucher đã kiểm tra hợp lệ (BR-06), null khi không có */
  voucher?: PricingVoucher | null
  /** Khuyến mãi đang chạy (GET /api/promotions/active); hàm tự xét khung giờ theo `at` */
  promotions: PromotionDto[]
  /** Thời điểm thanh toán (BR-07) */
  at: Date
}

export type PricedLine = {
  key?: string
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
  unitPrice: number
  lineTotal: number
  discount?: AppliedDiscount
  promotion?: AppliedPromotion
  lineNet: number
}

export type PricingResult = {
  lines: PricedLine[]
  subtotal: number
  lineDiscountTotal: number
  itemPromotionDiscount: number
  orderDiscount?: AppliedDiscount
  /** Khuyến mãi cấp hóa đơn đã áp (sau BR-05) */
  promotion?: AppliedPromotion
  voucher?: { voucherId: string; code: string; amount: number }
  discountTotal: number
  total: number
  /** Hạn mức thu ngân tự giảm (BR-04) */
  discountLimit: number
  /** Giảm giá thủ công = giảm dòng + giảm hóa đơn */
  manualDiscount: number
  /** Vượt hạn mức → cần quản lý xác nhận */
  needsApproval: boolean
  /** Mức giảm cấp hóa đơn bị bỏ vì không cộng dồn (BR-05), để FE báo cho thu ngân */
  skipped?: { kind: 'voucher' | 'promotion'; name: string; amount: number }
  /** Voucher gửi lên nhưng tổng tiền hàng chưa đạt đơn tối thiểu */
  voucherBelowMinimum: boolean
  /** BR-17 */
  pointsEarned: number
}

// ───────────────────────── Khuyến mãi đang hiệu lực ─────────────────────────

/** yyyy-MM-dd theo giờ máy */
export function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 1 = Thứ Hai … 7 = Chủ nhật (quy ước 07 §2.7) */
export const isoDayOfWeek = (date: Date) => ((date.getDay() + 6) % 7) + 1

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Khuyến mãi "đang hiệu lực" tại thời điểm t (07 §3): không tạm dừng, trong khoảng ngày,
 * đúng thứ trong tuần, và startTime ≤ giờ(t) < endTime khi có khung giờ.
 */
export function isPromotionActive(p: PromotionDto, at: Date): boolean {
  if (p.isPaused) return false
  const day = localDateKey(at)
  if (day < p.startDate || day > p.endDate) return false
  if (p.daysOfWeek.length > 0 && !p.daysOfWeek.includes(isoDayOfWeek(at))) return false
  if (p.startTime && p.endTime) {
    const minutes = at.getHours() * 60 + at.getMinutes()
    if (minutes < toMinutes(p.startTime) || minutes >= toMinutes(p.endTime)) return false
  }
  return true
}

/** Trạng thái hiển thị của khuyến mãi theo hôm nay (06 §4) */
export function promotionStatusAt(
  p: Pick<PromotionDto, 'isPaused' | 'startDate' | 'endDate'>,
  today = new Date()
): 'SapChay' | 'DangChay' | 'DaHet' | 'TamDung' {
  if (p.isPaused) return 'TamDung'
  const day = localDateKey(today)
  if (day < p.startDate) return 'SapChay'
  if (day > p.endDate) return 'DaHet'
  return 'DangChay'
}

// ───────────────────────── Tính một khoản giảm ─────────────────────────

/** Giảm thủ công trên một mức tiền: PhanTram → roundDown; SoTien → không vượt mức */
export function manualDiscountAmount(
  discount: ManualDiscount | null | undefined,
  base: number
): number {
  if (!discount || base <= 0) return 0
  if (discount.type === 'PhanTram') return Math.min(base, roundDown((base * discount.value) / 100))
  return Math.min(discount.value, base)
}

function capped(
  kind: DiscountType,
  value: number,
  maxDiscount: number | undefined,
  base: number
): number {
  if (base <= 0) return 0
  if (kind === 'PhanTram') {
    const raw = roundDown((base * value) / 100)
    return Math.min(raw, maxDiscount ?? Infinity, base)
  }
  return Math.min(value, base)
}

/** Mức giảm của voucher trên số tiền còn lại (07 §3 bước 7) */
export function voucherAmount(v: PricingVoucher, remaining: number): number {
  return capped(v.discountType, v.discountValue, v.maxDiscount, remaining)
}

// ───────────────────────── Hàm chính ─────────────────────────

export function priceCart(input: PricingInput): PricingResult {
  const active = input.promotions.filter((p) => isPromotionActive(p, input.at))
  const itemPromotions = active.filter((p) => p.scope !== 'HoaDon')
  const orderPromotions = active.filter((p) => p.scope === 'HoaDon')

  // Bước 1–2: dòng và giảm giá dòng thủ công
  const lines: PricedLine[] = input.lines.map((line) => {
    const unitPrice = line.sizePrice + line.toppings.reduce((s, t) => s + t.price, 0)
    const lineTotal = unitPrice * line.quantity
    const discountAmount = manualDiscountAmount(line.discount, lineTotal)
    const discount: AppliedDiscount | undefined =
      line.discount && discountAmount > 0
        ? {
            type: line.discount.type,
            value: line.discount.value,
            amount: discountAmount,
            reason: line.discount.reason,
          }
        : undefined
    return {
      key: line.key,
      menuItemId: line.menuItemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      categoryId: line.categoryId,
      sizeName: line.sizeName,
      sizePrice: line.sizePrice,
      toppings: line.toppings,
      sugarLevel: line.sugarLevel,
      iceLevel: line.iceLevel,
      note: line.note,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      discount,
      lineNet: lineTotal - discountAmount,
    }
  })

  // Bước 3: khuyến mãi cấp món — mỗi dòng chọn mức lớn nhất, rồi cắt theo maxDiscount từ dòng cuối
  const candidate = lines.map((line) => {
    const base = line.lineTotal - (line.discount?.amount ?? 0)
    let best: { promotion: PromotionDto; amount: number } | null = null
    for (const p of itemPromotions) {
      const inScope =
        (p.scope === 'DanhMuc' && p.categoryId === line.categoryId) ||
        (p.scope === 'Mon' && p.menuItemIds.includes(line.menuItemId))
      if (!inScope || base <= 0) continue
      const amount =
        p.discountType === 'PhanTram'
          ? Math.min(base, roundDown((base * p.discountValue) / 100))
          : Math.min(base, p.discountValue * line.quantity)
      if (amount > 0 && (!best || amount > best.amount)) best = { promotion: p, amount }
    }
    return best
  })
  for (const p of itemPromotions) {
    if (p.maxDiscount === undefined || p.maxDiscount === null) continue
    let total = candidate.reduce((s, c) => s + (c?.promotion.id === p.id ? c.amount : 0), 0)
    for (let i = candidate.length - 1; i >= 0 && total > p.maxDiscount; i--) {
      const c = candidate[i]
      if (!c || c.promotion.id !== p.id) continue
      const cut = Math.min(c.amount, total - p.maxDiscount)
      c.amount -= cut
      total -= cut
    }
  }
  candidate.forEach((c, i) => {
    if (c && c.amount > 0) {
      lines[i].promotion = { promotionId: c.promotion.id, name: c.promotion.name, amount: c.amount }
      lines[i].lineNet -= c.amount
    }
  })

  // Bước 4
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const lineDiscountTotal = lines.reduce((s, l) => s + (l.discount?.amount ?? 0), 0)
  const itemPromotionDiscount = lines.reduce((s, l) => s + (l.promotion?.amount ?? 0), 0)
  let remaining = subtotal - lineDiscountTotal - itemPromotionDiscount

  // Bước 5: giảm giá hóa đơn thủ công
  const orderDiscountAmount = manualDiscountAmount(input.orderDiscount, remaining)
  const orderDiscount: AppliedDiscount | undefined =
    input.orderDiscount && orderDiscountAmount > 0
      ? {
          type: input.orderDiscount.type,
          value: input.orderDiscount.value,
          amount: orderDiscountAmount,
          reason: input.orderDiscount.reason,
        }
      : undefined
  remaining -= orderDiscountAmount

  // Bước 6: hạn mức thu ngân
  const discountLimit = roundDown((subtotal * CASHIER_DISCOUNT_PERCENT) / 100)
  const manualDiscount = lineDiscountTotal + orderDiscountAmount
  const needsApproval = manualDiscount > discountLimit

  // Bước 7: voucher (xét đơn tối thiểu trên subtotal)
  const voucherBelowMinimum = !!input.voucher && subtotal < input.voucher.minOrderAmount
  const voucherAmt =
    input.voucher && !voucherBelowMinimum ? voucherAmount(input.voucher, remaining) : 0

  // Bước 8: khuyến mãi cấp hóa đơn, chọn lớn nhất
  let bestPromo: { promotion: PromotionDto; amount: number } | null = null
  for (const p of orderPromotions) {
    if (subtotal < p.minOrderAmount) continue
    const amount = capped(p.discountType, p.discountValue, p.maxDiscount, remaining)
    if (amount > 0 && (!bestPromo || amount > bestPromo.amount))
      bestPromo = { promotion: p, amount }
  }

  // Bước 9: không cộng dồn, bằng nhau giữ voucher
  let voucher: PricingResult['voucher']
  let promotion: AppliedPromotion | undefined
  let skipped: PricingResult['skipped']
  const promoAmt = bestPromo?.amount ?? 0
  if (voucherAmt > 0 && voucherAmt >= promoAmt) {
    voucher = { voucherId: input.voucher!.voucherId, code: input.voucher!.code, amount: voucherAmt }
    if (bestPromo) skipped = { kind: 'promotion', name: bestPromo.promotion.name, amount: promoAmt }
  } else if (bestPromo && promoAmt > 0) {
    promotion = {
      promotionId: bestPromo.promotion.id,
      name: bestPromo.promotion.name,
      amount: promoAmt,
    }
    if (voucherAmt > 0) skipped = { kind: 'voucher', name: input.voucher!.code, amount: voucherAmt }
  }

  // Bước 10
  const discountTotal =
    lineDiscountTotal +
    itemPromotionDiscount +
    orderDiscountAmount +
    (voucher?.amount ?? 0) +
    (promotion?.amount ?? 0)
  const total = Math.max(0, subtotal - discountTotal)

  return {
    lines,
    subtotal,
    lineDiscountTotal,
    itemPromotionDiscount,
    orderDiscount,
    promotion,
    voucher,
    discountTotal,
    total,
    discountLimit,
    manualDiscount,
    needsApproval,
    skipped,
    voucherBelowMinimum,
    pointsEarned: Math.floor(total / 10000),
  }
}

/** BR-08: tiền thối; âm nghĩa là còn thiếu */
export const changeAmount = (cashReceived: number, total: number) => cashReceived - total

/** Nút mệnh giá nhanh (07 §3 bước 11): đủ tiền, 50.000, 100.000, 200.000, 500.000 */
export const QUICK_CASH = [50_000, 100_000, 200_000, 500_000] as const
