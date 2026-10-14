import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { auditCreate, auditUpdate } from '@/mock/mock-audit'
import { requirePermission, type MockSessionContext } from '@/mock/mock-auth'
import { domain, forbidden, notFound, validation } from '@/mock/mock-errors'
import { inDateRange, listQuery, newId } from '@/mock/mock-helpers'
import {
  ordersDb,
  shiftCodeOf,
  shiftsDb,
  type OrderRecord,
  type ShiftRecord,
} from '@/features/pos/mock/pos.db'
import { localDateKey } from '@/features/pos/lib/pricing'
import type { OrderListItem } from '@/features/orders/types/order.types'
import type { PaginatedResult } from '@/types/api'
import type {
  CloseShiftRequest,
  OpenShiftRequest,
  ReviewShiftRequest,
  ShiftDetail,
  ShiftDto,
  ShiftListItem,
  ShiftQuery,
  ShiftSummary,
} from '../types/shift.types'
import { SHIFT_DIFFERENCE_LIMIT } from '../types/shift.types'

/** Handler /api/shifts ở chế độ mock (07 §2.6). */

const nowIso = () => new Date().toISOString()

const can = (ctx: MockSessionContext, code: string) =>
  ctx.isSuperAdmin || ctx.permissions.includes(code)

/** Ca đang mở của một thu ngân (BR-10: tối đa một) */
export function openShiftOf(cashierId: string): ShiftRecord | undefined {
  return shiftsDb.find((s) => s.cashierId === cashierId && s.status === 'DangMo')
}

/** Số tổng hợp của một ca tính từ hóa đơn (ca đang mở; ca đã chốt đọc cột đã ghi) */
export function computeShiftTotals(shift: ShiftRecord, orders?: OrderRecord[]) {
  const list = orders ?? ordersDb.filter((o) => o.shiftId === shift.id)
  let orderCount = 0
  let cancelledOrderCount = 0
  let cashSales = 0
  let transferSales = 0
  let cashCancelled = 0
  for (const o of list) {
    if (o.status === 'DaThanhToan') {
      orderCount++
      if (o.payment?.method === 'TienMat') cashSales += o.total
      else transferSales += o.total
    } else if (o.status === 'DaHuy') {
      cancelledOrderCount++
      if (o.payment?.method === 'TienMat') cashCancelled += o.total
    }
  }
  return { orderCount, cancelledOrderCount, cashSales, transferSales, cashCancelled }
}

/** ShiftDto với số tổng hợp hiện hành (ca đang mở tính lại từ hóa đơn) */
export function toShiftDto(shift: ShiftRecord): ShiftDto {
  if (shift.status !== 'DangMo') return { ...shift }
  const totals = computeShiftTotals(shift)
  return { ...shift, ...totals, expectedCash: shift.openingCash + totals.cashSales }
}

export function toShiftListItem(shift: ShiftRecord): ShiftListItem {
  const dto = toShiftDto(shift)
  return {
    id: dto.id,
    code: dto.code,
    status: dto.status,
    cashierName: dto.cashierName,
    openedAt: dto.openedAt,
    closedAt: dto.closedAt,
    orderCount: dto.orderCount,
    revenue: dto.cashSales + dto.transferSales,
    expectedCash: dto.status === 'DangMo' ? undefined : dto.expectedCash,
    countedCash: dto.countedCash,
    difference: dto.difference,
  }
}

function orderListItem(o: OrderRecord): OrderListItem {
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

function buildSummary(shift: ShiftRecord): ShiftSummary {
  const orders = ordersDb.filter((o) => o.shiftId === shift.id)
  const totals = computeShiftTotals(shift, orders)
  return {
    shiftId: shift.id,
    code: shift.code,
    openedAt: shift.openedAt,
    openingCash: shift.openingCash,
    ...totals,
    revenue: totals.cashSales + totals.transferSales,
    expectedCash: shift.openingCash + totals.cashSales,
    heldOrders: orders
      .filter((o) => o.status === 'DangGiu')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((o) => ({ id: o.id, holdName: o.holdName ?? 'Đơn giữ', total: o.total })),
  }
}

export const shiftMock = {
  /** GET /api/shifts/current: null tương ứng 204 (chưa có ca → hộp Mở ca, TC-07) */
  async getCurrent(): Promise<ShiftDto | null> {
    await mockDelay(100, 250)
    const ctx = requirePermission(permissions.shifts.operate)
    const shift = openShiftOf(ctx.user.id)
    return shift ? toShiftDto(shift) : null
  },

  /** POST /api/shifts: mở ca (UC-03). Đã có ca đang mở → trả ca đó (E2). */
  async open(input: OpenShiftRequest): Promise<ShiftDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.shifts.operate)
    const existing = openShiftOf(ctx.user.id)
    if (existing) return toShiftDto(existing)
    const openingCash = Number(input.openingCash)
    if (
      input.openingCash === undefined ||
      input.openingCash === null ||
      Number.isNaN(openingCash) ||
      openingCash < 0
    ) {
      throw validation({ openingCash: 'Nhập tiền đầu ca' })
    }
    const now = new Date()
    const today = localDateKey(now)
    const seq = shiftsDb.count((s) => localDateKey(new Date(s.openedAt)) === today) + 1
    const record = shiftsDb.insert({
      id: newId(),
      code: shiftCodeOf(now, seq),
      status: 'DangMo',
      cashierId: ctx.user.id,
      cashierName: ctx.user.fullName,
      openedAt: now.toISOString(),
      openingCash,
      orderCount: 0,
      cancelledOrderCount: 0,
      cashSales: 0,
      transferSales: 0,
      cashCancelled: 0,
    })
    auditCreate('Shift', record)
    return toShiftDto(record)
  },

  /** GET /api/shifts/current/summary (FR-22); null khi chưa có ca */
  async getCurrentSummary(): Promise<ShiftSummary | null> {
    await mockDelay(100, 250)
    const ctx = requirePermission(permissions.shifts.operate)
    const shift = openShiftOf(ctx.user.id)
    return shift ? buildSummary(shift) : null
  },

  /** POST /api/shifts/current/close (UC-10, BR-11, BR-12, BR-15) */
  async close(input: CloseShiftRequest): Promise<ShiftDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.shifts.operate)
    const shift = openShiftOf(ctx.user.id)
    if (!shift) throw domain('Chưa mở ca, mở ca trước khi bán hàng')
    const summary = buildSummary(shift)
    if (summary.heldOrders.length > 0) {
      throw domain(
        `Còn ${summary.heldOrders.length} đơn giữ, thanh toán hoặc xóa trước khi chốt ca`,
        {
          heldOrders: summary.heldOrders,
        }
      )
    }
    const countedCash = Number(input.countedCash)
    if (
      input.countedCash === undefined ||
      input.countedCash === null ||
      Number.isNaN(countedCash) ||
      countedCash < 0
    ) {
      throw validation({ countedCash: 'Nhập tiền mặt thực đếm' })
    }
    const difference = countedCash - summary.expectedCash
    const note = input.note?.trim() || undefined
    if (Math.abs(difference) > SHIFT_DIFFERENCE_LIMIT && !note) {
      throw validation({ note: 'Chênh lệch quá 50.000 ₫, cần ghi chú' })
    }
    const after = shiftsDb.update(shift.id, {
      status: Math.abs(difference) > SHIFT_DIFFERENCE_LIMIT ? 'CanKiemTra' : 'DaChot',
      closedAt: nowIso(),
      orderCount: summary.orderCount,
      cancelledOrderCount: summary.cancelledOrderCount,
      cashSales: summary.cashSales,
      transferSales: summary.transferSales,
      cashCancelled: summary.cashCancelled,
      expectedCash: summary.expectedCash,
      countedCash,
      difference,
      note,
    })!
    auditUpdate('Shift', shift, after)
    return after
  },

  /** GET /api/shifts (FR-24): mặc định 7 ngày gần nhất */
  async getList(query: ShiftQuery): Promise<PaginatedResult<ShiftListItem>> {
    await mockDelay()
    requirePermission(permissions.shifts.view)
    let from = query.from
    const to = query.to
    if (!from && !to) {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      from = localDateKey(d)
    }
    const items = shiftsDb
      .filter(
        (s) =>
          inDateRange(s.openedAt, from, to) &&
          (!query.cashierId || s.cashierId === query.cashierId) &&
          (!query.status || s.status === query.status)
      )
      .map(toShiftListItem)
    return listQuery(items, query, {
      searchFields: ['code', 'cashierName'],
      defaultSortBy: 'openedAt',
    })
  },

  /** GET /api/shifts/{id}: shifts.view hoặc ca của mình */
  async getById(id: string): Promise<ShiftDetail> {
    await mockDelay()
    const ctx = requirePermission(permissions.shifts.view, permissions.shifts.operate)
    const shift = shiftsDb.get(id)
    if (!shift) throw notFound('Không tìm thấy ca.')
    if (!can(ctx, permissions.shifts.view) && shift.cashierId !== ctx.user.id) throw forbidden()
    const dto = toShiftDto(shift)
    const orders = ordersDb
      .filter((o) => o.shiftId === id && o.status !== 'DangGiu')
      .sort((a, b) => (a.paidAt ?? '').localeCompare(b.paidAt ?? ''))
      .map(orderListItem)
    return { ...dto, revenue: dto.cashSales + dto.transferSales, orders }
  },

  /** PATCH /api/shifts/{id}/review (FR-25, TC-11) */
  async review(id: string, input: ReviewShiftRequest): Promise<ShiftDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.shifts.review)
    const shift = shiftsDb.get(id)
    if (!shift) throw notFound('Không tìm thấy ca.')
    if (shift.status !== 'CanKiemTra') throw domain('Chỉ ghi chú xử lý cho ca Cần kiểm tra')
    const note = input.note?.trim()
    if (!note) throw validation({ note: 'Nhập ghi chú xử lý' })
    const after = shiftsDb.update(id, {
      status: 'DaKiemTra',
      reviewNote: note,
      reviewedByName: ctx.user.username,
      reviewedAt: nowIso(),
    })!
    auditUpdate('Shift', shift, after)
    return after
  },
}
