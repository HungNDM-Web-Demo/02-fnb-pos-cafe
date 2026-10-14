import demoData from '@/mock/seed/demo-data.json'
import { mockDb } from '@/mock/mock-db'
import { dayOffset, daysAgo, stableId } from '@/mock/mock-helpers'
import { systemSeed } from '@/mock/system-seed'
import { userIdOf } from '@/mock/system-data'
import type { MenuItemSizeDto } from '@/features/menu-items/types/menu.types'
import type {
  IceLevel,
  ManualDiscount,
  OrderDto,
  OrderItemDto,
  PaymentMethod,
  ServiceType,
  SugarLevel,
} from '@/features/orders/types/order.types'
import type {
  PromotionDto,
  PromotionScope,
  VoucherDto,
} from '@/features/promotions/types/promotion.types'
import type { ShiftDto, ShiftStatus } from '@/features/shifts/types/shift.types'
import type { CustomerDto } from '@/features/customers/types/customer.types'
import type { DiscountType } from '@/features/orders/types/order.types'
import { localDateKey, priceCart, type PricingLineInput, type PricingVoucher } from '../lib/pricing'

/**
 * Collection dữ liệu nghiệp vụ ở chế độ mock (bảng Pos_*, Crm_*) và hàm nạp từ
 * `src/mock/seed/demo-data.json` (nguồn duy nhất, BE DemoDataSeeder nhúng cùng file).
 * Cách suy ra trường: docs/06-THIET-KE-CSDL.md §5.2; tiền tính lại bằng `pricing.ts` (07 §3).
 */

// Sửa demo-data.json là trình duyệt tự bỏ dữ liệu mẫu cũ (xem MockDb.registerSeed)
mockDb.registerSeed('demo-data', demoData)

// ───────────────────────── Bản ghi ─────────────────────────

export type CategoryRecord = {
  id: string
  code: string
  name: string
  color: string
  sortOrder: number
  isHidden: boolean
  createdAt: string
  updatedAt: string
}

export type MenuItemRecord = {
  id: string
  code: string
  name: string
  categoryId: string
  imageUrl?: string
  description?: string
  hasSugarOption: boolean
  hasIceOption: boolean
  isSoldOut: boolean
  isHidden: boolean
  sortOrder: number
  sizes: MenuItemSizeDto[]
  toppingIds: string[]
  createdAt: string
  updatedAt: string
}

export type ToppingRecord = {
  id: string
  code: string
  name: string
  price: number
  isSoldOut: boolean
  isHidden: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** Pos_Shifts; số tổng hợp ghi lúc chốt, ca đang mở tính từ hóa đơn khi đọc */
export type ShiftRecord = ShiftDto

/** Pos_Orders (gồm đơn giữ) */
export type OrderRecord = OrderDto & {
  clientRequestId?: string | null
  holdName?: string
}

export type PromotionRecord = Omit<PromotionDto, 'status' | 'categoryName'> & { createdAt: string }

export type VoucherRecord = Omit<VoucherDto, 'status'> & { createdAt: string }

export type CustomerRecord = CustomerDto

// ───────────────────────── Kiểu dữ liệu JSON ─────────────────────────

type SeedCategory = { code: string; name: string; color: string; sortOrder: number }
type SeedMenuItem = {
  code: string
  name: string
  category: string
  description?: string
  image?: string
  sugar?: boolean
  ice?: boolean
  sortOrder: number
  sizes: { name: string; price: number; default?: boolean }[]
  toppings: string[]
  soldOut?: boolean
  hidden?: boolean
}
type SeedTopping = { code: string; name: string; price: number; sortOrder: number }
type SeedPromotion = {
  code: string
  name: string
  description?: string
  discountType: DiscountType
  discountValue: number
  maxDiscount?: number
  scope: PromotionScope
  category?: string
  menuItems?: string[]
  minOrderAmount: number
  startTime?: string
  endTime?: string
  daysOfWeek?: number[]
  startDayOffset: number
  endDayOffset: number
  isPaused?: boolean
}
type SeedVoucher = {
  code: string
  description?: string
  discountType: DiscountType
  discountValue: number
  maxDiscount?: number
  minOrderAmount: number
  maxUses?: number
  expiresDayOffset?: number
  isPaused?: boolean
}
type SeedCustomer = { phone: string; name: string; note?: string; createdDaysAgo: number }
type SeedShift = {
  day: number
  seq: number
  cashier: string
  open: string
  close: string | null
  openingCash: number
  diff: number
  note?: string
  review?: { note: string; by: string }
}
type SeedOrderLine = {
  m: string
  z: string
  q: number
  tp?: string[]
  su?: SugarLevel
  ic?: IceLevel
  n?: string
  dc?: ManualDiscount
}
type SeedOrder = {
  d: number
  s: number
  t: string
  sv: ServiceType
  tb?: string
  pm: PaymentMethod
  cash?: number
  vc?: string
  cu?: string
  dc?: ManualDiscount & { by?: string }
  cx?: { at: string; by: string; reason: string }
  it: SeedOrderLine[]
}
type SeedFile = {
  categories: SeedCategory[]
  menuItems: SeedMenuItem[]
  toppings: SeedTopping[]
  promotions: SeedPromotion[]
  vouchers: SeedVoucher[]
  customers: SeedCustomer[]
  shifts: SeedShift[]
  orders: SeedOrder[]
}

const seed = demoData as unknown as SeedFile

// ───────────────────────── Tiện ích ─────────────────────────

export const categoryIdOf = (code: string) => stableId('category', code)
export const menuItemIdOf = (code: string) => stableId('menu-item', code)
export const toppingIdOf = (code: string) => stableId('topping', code)
export const promotionIdOf = (code: string) => stableId('promotion', code)
export const voucherIdOf = (code: string) => stableId('voucher', code)
export const customerIdOf = (phone: string) => stableId('customer', phone)
export const shiftIdOf = (day: number, seq: number) => stableId('shift', day, seq)

/** yyMMdd của một ngày (mã hóa đơn, mã ca) */
export const yyMMdd = (date: Date) =>
  `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`

export const shiftCodeOf = (openedAt: Date, seq: number) =>
  `CA${yyMMdd(openedAt)}${String(seq).padStart(2, '0')}`
export const orderCodeOf = (paidAt: Date, seq: number) =>
  `HD${yyMMdd(paidAt)}${String(seq).padStart(4, '0')}`

/** Tên hiển thị của tài khoản trong seed hệ thống (thu ngân, quản lý) */
export function seedUserName(username: string): string {
  return systemSeed.users.find((u) => u.username === username)?.fullName ?? username
}

/** Ngày thứ n so với hôm nay, lúc 00:00, dạng yyyy-MM-dd */
function dayKeyOffset(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return localDateKey(d)
}

const endOfDayOffset = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(23, 59, 59, 0)
  return d.toISOString()
}

// ───────────────────────── Nạp seed (tính một lần mỗi ngày) ─────────────────────────

type BuiltSeed = {
  categories: CategoryRecord[]
  menuItems: MenuItemRecord[]
  toppings: ToppingRecord[]
  promotions: PromotionRecord[]
  vouchers: VoucherRecord[]
  customers: CustomerRecord[]
  shifts: ShiftRecord[]
  orders: OrderRecord[]
}

let built: { day: string; data: BuiltSeed } | null = null

function buildSeed(): BuiltSeed {
  const today = localDateKey(new Date())
  if (built && built.day === today) return built.data

  const createdBase = daysAgo(100, '08:00')

  const categories: CategoryRecord[] = seed.categories.map((c) => ({
    id: categoryIdOf(c.code),
    code: c.code,
    name: c.name,
    color: c.color,
    sortOrder: c.sortOrder,
    isHidden: false,
    createdAt: createdBase,
    updatedAt: createdBase,
  }))

  const toppings: ToppingRecord[] = seed.toppings.map((t) => ({
    id: toppingIdOf(t.code),
    code: t.code,
    name: t.name,
    price: t.price,
    isSoldOut: false,
    isHidden: false,
    sortOrder: t.sortOrder,
    createdAt: createdBase,
    updatedAt: createdBase,
  }))

  const menuItems: MenuItemRecord[] = seed.menuItems.map((m) => {
    const id = menuItemIdOf(m.code)
    const hasDefault = m.sizes.some((s) => s.default)
    return {
      id,
      code: m.code,
      name: m.name,
      categoryId: categoryIdOf(m.category),
      imageUrl: m.image ? `/seed/menu/${m.image}` : undefined,
      description: m.description,
      hasSugarOption: m.sugar ?? true,
      hasIceOption: m.ice ?? true,
      isSoldOut: m.soldOut ?? false,
      isHidden: m.hidden ?? false,
      sortOrder: m.sortOrder,
      sizes: m.sizes.map((s, i) => ({
        id: stableId('size', m.code, s.name),
        name: s.name,
        price: s.price,
        isDefault: hasDefault ? !!s.default : i === 0,
        sortOrder: (i + 1) * 10,
      })),
      toppingIds: m.toppings.map(toppingIdOf),
      createdAt: createdBase,
      updatedAt: createdBase,
    }
  })

  const promotions: PromotionRecord[] = seed.promotions.map((p) => ({
    id: promotionIdOf(p.code),
    code: p.code,
    name: p.name,
    description: p.description,
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscount: p.maxDiscount,
    scope: p.scope,
    categoryId: p.category ? categoryIdOf(p.category) : undefined,
    menuItemIds: (p.menuItems ?? []).map(menuItemIdOf),
    minOrderAmount: p.minOrderAmount,
    startTime: p.startTime,
    endTime: p.endTime,
    daysOfWeek: p.daysOfWeek ?? [],
    startDate: dayKeyOffset(p.startDayOffset),
    endDate: dayKeyOffset(p.endDayOffset),
    isPaused: p.isPaused ?? false,
    updatedAt: createdBase,
    createdAt: createdBase,
  }))

  const vouchers: VoucherRecord[] = seed.vouchers.map((v) => ({
    id: voucherIdOf(v.code),
    code: v.code,
    description: v.description,
    discountType: v.discountType,
    discountValue: v.discountValue,
    maxDiscount: v.maxDiscount,
    minOrderAmount: v.minOrderAmount,
    maxUses: v.maxUses,
    usedCount: 0,
    expiresAt: v.expiresDayOffset === undefined ? undefined : endOfDayOffset(v.expiresDayOffset),
    isPaused: v.isPaused ?? false,
    updatedAt: createdBase,
    createdAt: createdBase,
  }))

  const customers: CustomerRecord[] = seed.customers.map((c) => ({
    id: customerIdOf(c.phone),
    phone: c.phone,
    name: c.name,
    note: c.note,
    points: 0,
    orderCount: 0,
    totalSpent: 0,
    lastOrderAt: undefined,
    createdAt: daysAgo(c.createdDaysAgo, '10:00'),
  }))

  // Ca: mã, giờ; tổng hợp điền sau khi tính hóa đơn
  const shiftKey = (day: number, seq: number) => `${day}/${seq}`
  const shiftMap = new Map<string, ShiftRecord>()
  const seqInDay = new Map<number, number>()
  const shifts: ShiftRecord[] = seed.shifts.map((s) => {
    const openedAt = dayOffset(s.day, s.open)
    const n = (seqInDay.get(s.day) ?? 0) + 1
    seqInDay.set(s.day, n)
    const record: ShiftRecord = {
      id: shiftIdOf(s.day, s.seq),
      code: shiftCodeOf(new Date(openedAt), n),
      status: 'DangMo',
      cashierId: userIdOf(s.cashier),
      cashierName: seedUserName(s.cashier),
      openedAt,
      closedAt: s.close ? dayOffset(s.day, s.close) : undefined,
      openingCash: s.openingCash,
      orderCount: 0,
      cancelledOrderCount: 0,
      cashSales: 0,
      transferSales: 0,
      cashCancelled: 0,
      note: s.note,
    }
    shiftMap.set(shiftKey(s.day, s.seq), record)
    return record
  })

  // Hóa đơn: tính lại tiền theo 07 §3 với khuyến mãi tại thời điểm thanh toán
  const itemByCode = new Map(seed.menuItems.map((m) => [m.code, m]))
  const toppingByCode = new Map(seed.toppings.map((t) => [t.code, t]))
  const voucherByCode = new Map(vouchers.map((v) => [v.code, v]))
  const customerByPhone = new Map(customers.map((c) => [c.phone, c]))
  const promotionDtos = promotions.map((p) => ({ ...p, status: 'DangChay' as const }))
  const seqByDay = new Map<number, number>()
  const orders: OrderRecord[] = []
  const indexByDay = new Map<number, number>()

  for (const o of seed.orders) {
    const shift = shiftMap.get(shiftKey(o.d, o.s))
    if (!shift) continue
    const paidAtDate = new Date(dayOffset(o.d, o.t))
    const paidAt = paidAtDate.toISOString()
    const seqNo = (seqByDay.get(o.d) ?? 0) + 1
    seqByDay.set(o.d, seqNo)
    const index = (indexByDay.get(o.d) ?? 0) + 1
    indexByDay.set(o.d, index)
    const id = stableId('order', o.d, o.s, index)

    const lines: PricingLineInput[] = o.it.map((l) => {
      const item = itemByCode.get(l.m)!
      const size = item.sizes.find((s) => s.name === l.z) ?? item.sizes[0]
      return {
        menuItemId: menuItemIdOf(item.code),
        itemCode: item.code,
        itemName: item.name,
        categoryId: categoryIdOf(item.category),
        sizeName: size.name,
        sizePrice: size.price,
        toppings: (l.tp ?? []).map((code) => {
          const t = toppingByCode.get(code)!
          return { toppingId: toppingIdOf(code), name: t.name, price: t.price }
        }),
        sugarLevel: (item.sugar ?? true) ? (l.su ?? 100) : undefined,
        iceLevel: (item.ice ?? true) ? (l.ic ?? 'Vua') : undefined,
        note: l.n,
        quantity: l.q,
        discount: l.dc,
      }
    })

    const voucher = o.vc ? voucherByCode.get(o.vc) : undefined
    const pricingVoucher: PricingVoucher | null = voucher
      ? {
          voucherId: voucher.id,
          code: voucher.code,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          maxDiscount: voucher.maxDiscount,
          minOrderAmount: voucher.minOrderAmount,
        }
      : null
    const priced = priceCart({
      lines,
      orderDiscount: o.dc ? { type: o.dc.type, value: o.dc.value, reason: o.dc.reason } : null,
      voucher: pricingVoucher,
      promotions: promotionDtos,
      at: paidAtDate,
    })

    const customer = o.cu ? customerByPhone.get(o.cu) : undefined
    const cancelled = !!o.cx
    const items: OrderItemDto[] = priced.lines.map((l, i) => ({
      id: stableId('order-item', id, i),
      menuItemId: l.menuItemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      categoryId: l.categoryId,
      sizeName: l.sizeName,
      sizePrice: l.sizePrice,
      toppings: l.toppings,
      sugarLevel: l.sugarLevel,
      iceLevel: l.iceLevel,
      note: l.note,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      discount: l.discount,
      promotion: l.promotion,
      lineNet: l.lineNet,
      unavailable: false,
    }))

    const cashReceived =
      o.pm === 'TienMat' ? Math.max(o.cash ?? priced.total, priced.total) : undefined
    const order: OrderRecord = {
      id,
      code: orderCodeOf(paidAtDate, seqNo),
      status: cancelled ? 'DaHuy' : 'DaThanhToan',
      shiftId: shift.id,
      shiftCode: shift.code,
      cashierId: shift.cashierId,
      cashierName: shift.cashierName,
      serviceType: o.sv,
      tableTag: o.sv === 'TaiCho' ? o.tb : undefined,
      items,
      subtotal: priced.subtotal,
      lineDiscountTotal: priced.lineDiscountTotal,
      itemPromotionDiscount: priced.itemPromotionDiscount,
      orderDiscount: priced.orderDiscount
        ? { ...priced.orderDiscount, approvedByName: o.dc?.by }
        : undefined,
      promotion: priced.promotion,
      voucher: priced.voucher,
      discountTotal: priced.discountTotal,
      total: priced.total,
      customer: customer
        ? { id: customer.id, phone: customer.phone, name: customer.name }
        : undefined,
      pointsEarned: priced.pointsEarned,
      payment: {
        method: o.pm,
        amount: priced.total,
        cashReceived,
        changeAmount: cashReceived === undefined ? undefined : cashReceived - priced.total,
        qrContent: o.pm === 'ChuyenKhoan' ? undefined : undefined,
      },
      paidAt,
      cancelledAt: o.cx ? dayOffset(o.d, o.cx.at) : undefined,
      cancelledByName: o.cx ? o.cx.by : undefined,
      cancelReason: o.cx?.reason,
      createdAt: new Date(paidAtDate.getTime() - 3 * 60_000).toISOString(),
      clientRequestId: null,
    }
    orders.push(order)

    // Tổng hợp ca (BR-11), voucher (BR-06), khách hàng (BR-17)
    if (cancelled) {
      shift.cancelledOrderCount += 1
      if (o.pm === 'TienMat') shift.cashCancelled += priced.total
    } else {
      shift.orderCount += 1
      if (o.pm === 'TienMat') shift.cashSales += priced.total
      else shift.transferSales += priced.total
      if (priced.voucher && voucher) voucher.usedCount += 1
      if (customer) {
        customer.points += priced.pointsEarned
        customer.orderCount += 1
        customer.totalSpent += priced.total
        if (!customer.lastOrderAt || customer.lastOrderAt < paidAt) customer.lastOrderAt = paidAt
      }
    }
  }

  // Trạng thái ca theo BR-12; ca chưa chốt (close null) giữ DangMo
  for (const s of seed.shifts) {
    const shift = shiftMap.get(shiftKey(s.day, s.seq))!
    if (!s.close) continue
    shift.expectedCash = shift.openingCash + shift.cashSales
    shift.countedCash = shift.expectedCash + s.diff
    shift.difference = s.diff
    let status: ShiftStatus = Math.abs(s.diff) > 50_000 ? 'CanKiemTra' : 'DaChot'
    if (status === 'CanKiemTra' && s.review) {
      status = 'DaKiemTra'
      shift.reviewNote = s.review.note
      shift.reviewedByName = s.review.by
      shift.reviewedAt = dayOffset(s.day + 1, '09:00')
    }
    shift.status = status
  }

  const data: BuiltSeed = {
    categories,
    menuItems,
    toppings,
    promotions,
    vouchers,
    customers,
    shifts,
    orders,
  }
  built = { day: today, data }
  return data
}

// ───────────────────────── Collection ─────────────────────────

export const categoriesDb = mockDb.collection<CategoryRecord>(
  'categories',
  () => buildSeed().categories
)
export const menuItemsDb = mockDb.collection<MenuItemRecord>(
  'menu-items',
  () => buildSeed().menuItems
)
export const toppingsDb = mockDb.collection<ToppingRecord>('toppings', () => buildSeed().toppings)
export const shiftsDb = mockDb.collection<ShiftRecord>('shifts', () => buildSeed().shifts)
export const ordersDb = mockDb.collection<OrderRecord>('orders', () => buildSeed().orders)
export const promotionsDb = mockDb.collection<PromotionRecord>(
  'promotions',
  () => buildSeed().promotions
)
export const vouchersDb = mockDb.collection<VoucherRecord>('vouchers', () => buildSeed().vouchers)
export const customersDb = mockDb.collection<CustomerRecord>(
  'customers',
  () => buildSeed().customers
)

// Đặt lại dữ liệu: bỏ bản seed đã tính để ngày tương đối tính lại theo hôm nay
mockDb.onReset(() => {
  built = null
})
