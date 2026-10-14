import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { ApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission, type MockSessionContext } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { domain, forbidden, notFound, validation } from '@/mock/mock-errors'
import { inDateRange, listQuery, newId } from '@/mock/mock-helpers'
import { effectivePermissions, isSuperAdmin, liveUsers, verifyPassword } from '@/mock/system-data'
import {
  priceCart,
  type PricingLineInput,
  type PricingResult,
  type PricingVoucher,
} from '@/features/pos/lib/pricing'
import {
  customersDb,
  menuItemsDb,
  orderCodeOf,
  ordersDb,
  toppingsDb,
  vouchersDb,
  type OrderRecord,
} from '@/features/pos/mock/pos.db'
import {
  activePromotions,
  toPricingVoucher,
  validateVoucher,
} from '@/features/promotions/mock/promotion.mock'
import { openShiftOf } from '@/features/shifts/mock/shift.mock'
import { localDateKey } from '@/features/pos/lib/pricing'
import type { PaginatedResult } from '@/types/api'
import type {
  CancelOrderRequest,
  CartInput,
  CheckoutRequest,
  DiscountApprovalDto,
  DiscountApprovalRequest,
  HeldOrderDto,
  HoldOrderRequest,
  NextCodeResult,
  OrderDto,
  OrderItemDto,
  OrderListItem,
  OrderQuery,
} from '../types/order.types'

/** Handler /api/orders ở chế độ mock (07 §2.5): giữ đơn, thanh toán, hủy, duyệt giảm giá. */

const nowIso = () => new Date().toISOString()
const MAX_HELD = 10
const APPROVAL_MINUTES = 5

const can = (ctx: MockSessionContext, code: string) =>
  ctx.isSuperAdmin || ctx.permissions.includes(code)

/** Token duyệt giảm giá của quản lý: giữ trong bộ nhớ của tab, 5 phút, dùng một lần (07 §2.5) */
const approvalTokens = new Map<
  string,
  { approvedById: string; approvedByName: string; expiresAt: number }
>()
mockDb.onReset(() => approvalTokens.clear())

export function toOrderListItem(o: OrderRecord): OrderListItem {
  return {
    id: o.id,
    code: o.code ?? '',
    status: o.status,
    paidAt: o.paidAt ?? o.createdAt,
    cashierName: o.cashierName,
    serviceType: o.serviceType,
    tableTag: o.tableTag,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    total: o.total,
    discountTotal: o.discountTotal,
    paymentMethod: o.payment?.method ?? 'TienMat',
    voucherCode: o.voucher?.code,
    cancelReason: o.cancelReason,
  }
}

function stripRecord(o: OrderRecord): OrderDto {
  const { clientRequestId: _c, holdName: _h, ...dto } = o
  void _c
  void _h
  return dto
}

/** Đơn giữ kèm cờ unavailable tính theo thực đơn hiện tại (BR-14, TC-05) */
function toHeldOrderDto(o: OrderRecord): HeldOrderDto {
  const items: OrderItemDto[] = o.items.map((line) => {
    const item = menuItemsDb.get(line.menuItemId)
    const itemBad =
      !item || item.isHidden || item.isSoldOut || !item.sizes.some((s) => s.name === line.sizeName)
    const toppingBad = line.toppings.some((t) => {
      const topping = toppingsDb.get(t.toppingId)
      return !topping || topping.isHidden || topping.isSoldOut
    })
    return { ...line, unavailable: itemBad || toppingBad }
  })
  return {
    ...stripRecord(o),
    items,
    holdName: o.holdName ?? 'Đơn giữ',
    hasUnavailableItems: items.some((i) => i.unavailable),
  }
}

function getOrderOr404(id: string) {
  const o = ordersDb.get(id)
  if (!o || o.status === 'DangGiu') throw notFound('Không tìm thấy hóa đơn.')
  return o
}

/** Đổi giỏ gửi lên thành dòng để tính tiền; kiểm tra món, size, topping, số lượng (lỗi §2.5) */
function buildLines(cart: CartInput): PricingLineInput[] {
  if (!cart.items?.length) throw validation({ items: 'Đơn chưa có món' }, 'Đơn chưa có món')
  if (cart.serviceType === 'TaiCho' && !cart.tableTag?.trim()) {
    throw validation({ tableTag: 'Nhập số thẻ bàn' }, 'Nhập số thẻ bàn')
  }
  const errors: Record<string, string> = {}
  let detail = ''
  const lines: PricingLineInput[] = []
  cart.items.forEach((input, i) => {
    const item = menuItemsDb.get(input.menuItemId)
    if (!item || item.isHidden) {
      errors[`items[${i}].menuItemId`] =
        detail = `Món ${item?.name ?? input.menuItemId} không còn trong thực đơn`
      return
    }
    if (item.isSoldOut) {
      errors[`items[${i}].menuItemId`] = detail = `${item.name} đang tạm hết`
      return
    }
    const size = item.sizes.find((s) => s.name === input.sizeName)
    if (!size) {
      errors[`items[${i}].menuItemId`] = detail = `Món ${item.name} không còn trong thực đơn`
      return
    }
    const quantity = Number(input.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      errors[`items[${i}].quantity`] = detail = 'Số lượng từ 1 đến 99'
      return
    }
    if (input.discount) {
      const d = input.discount
      const bad =
        d.type === 'PhanTram'
          ? !(d.value >= 1 && d.value <= 100)
          : !(d.value > 0) || d.value % 1000 !== 0
      if (bad || !d.reason?.trim()) {
        errors[`items[${i}].discount`] = detail = 'Giảm giá dòng chưa hợp lệ'
        return
      }
    }
    const toppings = []
    for (const toppingId of input.toppingIds ?? []) {
      const topping = toppingsDb.get(toppingId)
      if (!topping || topping.isHidden || !item.toppingIds.includes(toppingId)) {
        errors[`items[${i}].toppingIds`] =
          detail = `Topping ${topping?.name ?? toppingId} không còn trong thực đơn`
        return
      }
      if (topping.isSoldOut) {
        errors[`items[${i}].toppingIds`] = detail = `${topping.name} đang tạm hết`
        return
      }
      toppings.push({ toppingId: topping.id, name: topping.name, price: topping.price })
    }
    lines.push({
      key: String(i),
      menuItemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      categoryId: item.categoryId,
      sizeName: size.name,
      sizePrice: size.price,
      toppings,
      sugarLevel: item.hasSugarOption ? (input.sugarLevel ?? 100) : undefined,
      iceLevel: item.hasIceOption ? (input.iceLevel ?? 'Vua') : undefined,
      note: input.note?.trim().slice(0, 200) || undefined,
      quantity,
      discount: input.discount,
    })
  })
  if (Object.keys(errors).length) throw validation(errors, detail)
  return lines
}

function toItems(priced: PricingResult): OrderItemDto[] {
  return priced.lines.map((l) => ({
    id: newId(),
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
}

/** Tính tiền một giỏ theo thời điểm hiện tại; voucher kiểm tra BR-06 */
function priceInput(
  cart: CartInput,
  at: Date,
  voucherField: 'code' | 'voucherCode' = 'voucherCode'
) {
  const lines = buildLines(cart)
  const subtotal = lines.reduce(
    (s, l) => s + (l.sizePrice + l.toppings.reduce((x, t) => x + t.price, 0)) * l.quantity,
    0
  )
  let voucher: PricingVoucher | null = null
  let voucherRecordId: string | undefined
  if (cart.voucherCode?.trim()) {
    const record = validateVoucher(cart.voucherCode, subtotal, at, voucherField)
    voucher = toPricingVoucher(record)
    voucherRecordId = record.id
  }
  const priced = priceCart({
    lines,
    orderDiscount: cart.orderDiscount ?? null,
    voucher,
    promotions: activePromotions(),
    at,
  })
  return { priced, voucherRecordId }
}

function customerOf(id: string | undefined) {
  if (!id) return undefined
  const c = customersDb.get(id)
  return c ? { id: c.id, phone: c.phone, name: c.name } : undefined
}

/** Mã hóa đơn tiếp theo trong ngày (BR-09): HD + yyMMdd + số thứ tự 4 chữ số */
function nextOrderCode(now = new Date()): string {
  const prefix = orderCodeOf(now, 0).slice(0, -4)
  const max = ordersDb.all().reduce((acc, o) => {
    if (!o.code?.startsWith(prefix)) return acc
    const n = Number(o.code.slice(prefix.length))
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return orderCodeOf(now, max + 1)
}

export const orderMock = {
  /** GET /api/orders (FR-19): không có orders.view-all thì chỉ thấy hóa đơn của mình */
  async getList(query: OrderQuery): Promise<PaginatedResult<OrderListItem>> {
    await mockDelay()
    const ctx = requirePermission(permissions.orders.view)
    const viewAll = can(ctx, permissions.orders.viewAll)
    const items = ordersDb
      .filter(
        (o) =>
          o.status !== 'DangGiu' &&
          (viewAll
            ? !query.cashierId || o.cashierId === query.cashierId
            : o.cashierId === ctx.user.id) &&
          inDateRange(o.paidAt, query.from, query.to) &&
          (!query.status || o.status === query.status) &&
          (!query.paymentMethod || o.payment?.method === query.paymentMethod) &&
          (!query.shiftId || o.shiftId === query.shiftId)
      )
      .map(toOrderListItem)
    return listQuery(items, query, { searchFields: ['code', 'tableTag'], defaultSortBy: 'paidAt' })
  },

  async getById(id: string): Promise<OrderDto> {
    await mockDelay(100, 250)
    const ctx = requirePermission(permissions.orders.view)
    const o = getOrderOr404(id)
    if (!can(ctx, permissions.orders.viewAll) && o.cashierId !== ctx.user.id) throw forbidden()
    return stripRecord(o)
  },

  /** GET /api/orders/next-code: mã dự kiến cho nội dung QR (UC-07 2a) */
  async nextCode(): Promise<NextCodeResult> {
    await mockDelay(50, 150)
    requirePermission(permissions.orders.create)
    return { code: nextOrderCode() }
  },

  /** POST /api/orders: thanh toán (UC-07). Cùng clientRequestId → trả hóa đơn cũ (TC-24). */
  async checkout(request: CheckoutRequest): Promise<OrderDto> {
    await mockDelay(300, 600)
    const ctx = requirePermission(permissions.orders.create)
    // 07 §5 #1: giỏ có giảm giá dòng, giảm giá hóa đơn hoặc voucher thì cần thêm orders.discount
    const usesDiscount =
      !!request.orderDiscount ||
      !!request.voucherCode?.trim() ||
      request.items?.some((i) => !!i.discount)
    if (usesDiscount && !can(ctx, permissions.orders.discount)) throw forbidden()
    // Thứ tự kiểm tra (07 §5 #3): trùng clientRequestId → ca → đơn giữ → món → voucher → khách
    // → expectedTotal (409) → tiền mặt thiếu → hạn mức, token duyệt
    if (request.clientRequestId) {
      const existing = ordersDb.find((o) => o.clientRequestId === request.clientRequestId)
      if (existing) return stripRecord(existing)
    }
    const shift = openShiftOf(ctx.user.id)
    if (!shift) throw domain('Chưa mở ca, mở ca trước khi bán hàng')

    let held: OrderRecord | undefined
    if (request.heldOrderId) {
      held = ordersDb.get(request.heldOrderId)
      if (!held || held.status !== 'DangGiu' || held.cashierId !== ctx.user.id)
        throw notFound('Đơn giữ không còn')
    }

    const now = new Date()
    const { priced, voucherRecordId } = priceInput(request, now)

    if (request.customerId && !customersDb.get(request.customerId)) {
      throw validation({ customerId: 'Khách hàng không tồn tại' }, 'Khách hàng không tồn tại')
    }

    if (Math.round(Number(request.expectedTotal)) !== priced.total) {
      throw ApiError.fromStatus(
        409,
        'Tổng tiền đã thay đổi (khuyến mãi hoặc giá), kiểm tra lại đơn',
        {
          serverTotal: priced.total,
        }
      )
    }

    const payment = request.payment
    if (!payment || (payment.method !== 'TienMat' && payment.method !== 'ChuyenKhoan')) {
      throw validation({ 'payment.method': 'Chọn phương thức thanh toán' })
    }
    let cashReceived: number | undefined
    let change: number | undefined
    if (payment.method === 'TienMat') {
      cashReceived = Number(payment.cashReceived ?? 0)
      if (cashReceived < priced.total) {
        const missing = priced.total - cashReceived
        throw validation(
          { 'payment.cashReceived': `Còn thiếu ${formatVnd(missing)}` },
          `Còn thiếu ${formatVnd(missing)}`
        )
      }
      change = cashReceived - priced.total
    }

    // BR-04: vượt hạn mức cần mã duyệt của quản lý
    let approvedByName: string | undefined
    if (priced.needsApproval) {
      const token = request.discountApprovalToken
        ? approvalTokens.get(request.discountApprovalToken)
        : undefined
      if (!request.discountApprovalToken) {
        throw domain('Giảm giá vượt hạn mức 10%, cần quản lý xác nhận', {
          discountLimit: priced.discountLimit,
          requestedDiscount: priced.manualDiscount,
        })
      }
      if (!token || token.expiresAt < Date.now()) {
        throw domain('Mã xác nhận của quản lý không hợp lệ, xác nhận lại')
      }
      approvedByName = token.approvedByName
    }

    // Token dùng một lần
    if (request.discountApprovalToken) approvalTokens.delete(request.discountApprovalToken)

    const customer = customerOf(request.customerId)
    const record: OrderRecord = {
      id: held?.id ?? newId(),
      code: nextOrderCode(now),
      status: 'DaThanhToan',
      shiftId: shift.id,
      shiftCode: shift.code,
      cashierId: ctx.user.id,
      cashierName: ctx.user.fullName,
      serviceType: request.serviceType,
      tableTag: request.serviceType === 'TaiCho' ? request.tableTag?.trim() : undefined,
      items: toItems(priced),
      subtotal: priced.subtotal,
      lineDiscountTotal: priced.lineDiscountTotal,
      itemPromotionDiscount: priced.itemPromotionDiscount,
      orderDiscount: priced.orderDiscount ? { ...priced.orderDiscount, approvedByName } : undefined,
      promotion: priced.promotion,
      voucher: priced.voucher,
      discountTotal: priced.discountTotal,
      total: priced.total,
      customer,
      pointsEarned: priced.pointsEarned,
      payment: {
        method: payment.method,
        amount: priced.total,
        cashReceived,
        changeAmount: change,
        qrContent: payment.method === 'ChuyenKhoan' ? payment.qrContent : undefined,
      },
      paidAt: now.toISOString(),
      createdAt: held?.createdAt ?? now.toISOString(),
      clientRequestId: request.clientRequestId || null,
    }

    mockDb.batch(() => {
      if (held) ordersDb.update(held.id, () => record)
      else ordersDb.insert(record)
      // BR-06: voucher tăng lượt khi thanh toán thành công (và thật sự được áp)
      if (priced.voucher && voucherRecordId) {
        vouchersDb.update(voucherRecordId, (v) => ({
          ...v,
          usedCount: v.usedCount + 1,
          updatedAt: nowIso(),
        }))
      }
      // BR-17: cộng điểm
      if (customer) {
        customersDb.update(customer.id, (c) => ({
          ...c,
          points: c.points + priced.pointsEarned,
          orderCount: c.orderCount + 1,
          totalSpent: c.totalSpent + priced.total,
          lastOrderAt: record.paidAt,
        }))
      }
    })
    auditCreate('Order', {
      id: record.id,
      code: record.code,
      total: record.total,
      status: record.status,
    })
    return stripRecord(record)
  },

  /** POST /api/orders/{id}/cancel (UC-08, BR-13) */
  async cancel(id: string, input: CancelOrderRequest): Promise<OrderDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.orders.cancel)
    const order = getOrderOr404(id)
    if (order.status === 'DaHuy') throw domain('Hóa đơn đã hủy trước đó')
    const shiftOpen = openShiftOf(order.cashierId)?.id === order.shiftId
    if (!shiftOpen) throw domain('Chỉ hủy được hóa đơn trong ca đang mở')
    const reason = input.reason?.trim()
    if (!reason) throw validation({ reason: 'Nhập lý do hủy' }, 'Nhập lý do hủy')
    if (reason.length > 200) throw validation({ reason: 'Lý do tối đa 200 ký tự' })

    const after = mockDb.batch(() => {
      const updated = ordersDb.update(id, {
        status: 'DaHuy',
        cancelledAt: nowIso(),
        cancelledByName: ctx.user.username,
        cancelReason: reason,
      })!
      if (order.voucher) {
        vouchersDb.update(order.voucher.voucherId, (v) => ({
          ...v,
          usedCount: Math.max(0, v.usedCount - 1),
        }))
      }
      if (order.customer) {
        customersDb.update(order.customer.id, (c) => ({
          ...c,
          points: Math.max(0, c.points - order.pointsEarned),
          orderCount: Math.max(0, c.orderCount - 1),
          totalSpent: Math.max(0, c.totalSpent - order.total),
        }))
      }
      return updated
    })
    auditUpdate('Order', order, after)
    return stripRecord(after)
  },

  // ───────── Đơn giữ (UC-05) ─────────
  async getHeld(): Promise<HeldOrderDto[]> {
    await mockDelay(100, 250)
    const ctx = requirePermission(permissions.orders.create)
    const shift = openShiftOf(ctx.user.id)
    if (!shift) return []
    return ordersDb
      .filter(
        (o) => o.status === 'DangGiu' && o.shiftId === shift.id && o.cashierId === ctx.user.id
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toHeldOrderDto)
  },

  async hold(request: HoldOrderRequest): Promise<HeldOrderDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.orders.create)
    const shift = openShiftOf(ctx.user.id)
    if (!shift) throw domain('Chưa mở ca, mở ca trước khi bán hàng')
    const mine = ordersDb.filter(
      (o) => o.status === 'DangGiu' && o.cashierId === ctx.user.id && o.shiftId === shift.id
    )
    if (mine.length >= MAX_HELD) throw domain('Tối đa 10 đơn giữ, thanh toán hoặc xóa bớt')
    const now = new Date()
    const { priced } = priceInput(request, now)
    const record: OrderRecord = {
      id: newId(),
      status: 'DangGiu',
      shiftId: shift.id,
      shiftCode: shift.code,
      cashierId: ctx.user.id,
      cashierName: ctx.user.fullName,
      serviceType: request.serviceType,
      tableTag: request.serviceType === 'TaiCho' ? request.tableTag?.trim() : undefined,
      items: toItems(priced),
      subtotal: priced.subtotal,
      lineDiscountTotal: priced.lineDiscountTotal,
      itemPromotionDiscount: priced.itemPromotionDiscount,
      orderDiscount: priced.orderDiscount,
      promotion: priced.promotion,
      voucher: priced.voucher,
      discountTotal: priced.discountTotal,
      total: priced.total,
      customer: customerOf(request.customerId),
      pointsEarned: priced.pointsEarned,
      createdAt: now.toISOString(),
      holdName: request.holdName?.trim() || `Đơn ${mine.length + 1}`,
      clientRequestId: null,
    }
    ordersDb.insert(record)
    return toHeldOrderDto(record)
  },

  async updateHeld(id: string, request: HoldOrderRequest): Promise<HeldOrderDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.orders.create)
    const held = ordersDb.get(id)
    if (!held || held.status !== 'DangGiu' || held.cashierId !== ctx.user.id)
      throw notFound('Đơn giữ không còn')
    const { priced } = priceInput(request, new Date())
    const after = ordersDb.update(id, {
      serviceType: request.serviceType,
      tableTag: request.serviceType === 'TaiCho' ? request.tableTag?.trim() : undefined,
      items: toItems(priced),
      subtotal: priced.subtotal,
      lineDiscountTotal: priced.lineDiscountTotal,
      itemPromotionDiscount: priced.itemPromotionDiscount,
      orderDiscount: priced.orderDiscount,
      promotion: priced.promotion,
      voucher: priced.voucher,
      discountTotal: priced.discountTotal,
      total: priced.total,
      customer: customerOf(request.customerId),
      pointsEarned: priced.pointsEarned,
      holdName: request.holdName?.trim() || held.holdName,
    })!
    return toHeldOrderDto(after)
  },

  async deleteHeld(id: string): Promise<void> {
    await mockDelay(100, 250)
    const ctx = requirePermission(permissions.orders.create)
    const held = ordersDb.get(id)
    if (!held || held.status !== 'DangGiu' || held.cashierId !== ctx.user.id)
      throw notFound('Đơn giữ không còn')
    ordersDb.remove(id)
    auditDelete('Order', { id: held.id, holdName: held.holdName, total: held.total })
  },

  /** POST /api/orders/discount-approvals (FR-15, TC-17, TC-18) */
  async approveDiscount(request: DiscountApprovalRequest): Promise<DiscountApprovalDto> {
    await mockDelay(300, 500)
    requirePermission(permissions.orders.discount)
    const username = request.username?.trim().toLowerCase()
    const user = username ? liveUsers().find((u) => u.username === username) : undefined
    // 400 (không phải 401) để lib/axios.ts không làm mới token của thu ngân
    if (!user || !request.password || !verifyPassword(user, request.password)) {
      throw domain('Tên đăng nhập hoặc mật khẩu không đúng')
    }
    if (!user.isActive) throw domain('Tài khoản đã bị khóa, liên hệ quản trị viên')
    const allowed =
      isSuperAdmin(user) || effectivePermissions(user).includes(permissions.orders.discountOverride)
    if (!allowed) throw forbidden('Tài khoản không có quyền xác nhận giảm giá')
    const token = newId().replace(/-/g, '') + newId().replace(/-/g, '')
    const expiresAt = Date.now() + APPROVAL_MINUTES * 60_000
    approvalTokens.set(token, { approvedById: user.id, approvedByName: user.username, expiresAt })
    return {
      token,
      approvedById: user.id,
      approvedByName: user.username,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  },
}

/** Dùng cho báo cáo: khóa ngày yyyy-MM-dd của thời điểm thanh toán */
export const paidDayKey = (o: OrderRecord) => (o.paidAt ? localDateKey(new Date(o.paidAt)) : '')
