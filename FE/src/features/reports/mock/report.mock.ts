import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import { validation } from '@/mock/mock-errors'
import { paginate } from '@/mock/mock-helpers'
import { isoDayOfWeek, localDateKey } from '@/features/pos/lib/pricing'
import { categoriesDb, ordersDb, shiftsDb, type OrderRecord } from '@/features/pos/mock/pos.db'
import type { PaymentMethod } from '@/features/orders/types/order.types'
import type { PaginatedResult } from '@/types/api'
import type {
  CancelledOrderItem,
  CancelledOrdersQuery,
  CashierReport,
  DashboardReport,
  DateRangeQuery,
  HeatmapReport,
  PaymentMethodReport,
  RevenueReport,
  TopItemsQuery,
  TopItemsReport,
} from '../types/report.types'

/** Handler /api/reports ở chế độ mock (07 §2.8). Chỉ tính hóa đơn DaThanhToan theo paidAt (BR-16). */

export const MAX_RANGE_DAYS = 366
const DATE = /^\d{4}-\d{2}-\d{2}$/

const parseDay = (key: string) => new Date(`${key}T00:00:00`)
const addDays = (date: Date, n: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000)

/**
 * Kiểm tra from/to (TC-30). Thiếu cả hai: 30 ngày tới hôm nay; chỉ có from: 30 ngày từ from;
 * chỉ có to: 30 ngày tới to (07 §5 #10).
 */
export function validateRange(query: Partial<DateRangeQuery>) {
  let fromKey = query.from || ''
  let toKey = query.to || ''
  if (!fromKey && !toKey) toKey = localDateKey(new Date())
  if (!fromKey && DATE.test(toKey)) fromKey = localDateKey(addDays(parseDay(toKey), -29))
  if (!toKey && DATE.test(fromKey)) toKey = localDateKey(addDays(parseDay(fromKey), 29))
  const errors: Record<string, string> = {}
  if (!DATE.test(fromKey)) errors.from = 'Chọn ngày bắt đầu'
  if (!DATE.test(toKey)) errors.to = 'Chọn ngày kết thúc'
  if (Object.keys(errors).length) throw validation(errors)
  const from = parseDay(fromKey)
  const to = parseDay(toKey)
  if (to < from)
    throw validation(
      { to: 'Ngày kết thúc phải sau ngày bắt đầu' },
      'Ngày kết thúc phải sau ngày bắt đầu'
    )
  const days = diffDays(from, to) + 1
  if (days > MAX_RANGE_DAYS)
    throw validation({ from: 'Khoảng ngày tối đa 366 ngày' }, 'Khoảng ngày tối đa 366 ngày')
  return { from, to, days, fromKey, toKey }
}

const paidKey = (o: OrderRecord) => localDateKey(new Date(o.paidAt!))

function paidOrdersBetween(from: Date, to: Date): OrderRecord[] {
  const start = from.getTime()
  const end = addDays(to, 1).getTime()
  return ordersDb.filter((o) => {
    if (o.status !== 'DaThanhToan' || !o.paidAt) return false
    const t = new Date(o.paidAt).getTime()
    return t >= start && t < end
  })
}

const sum = (list: OrderRecord[], pick: (o: OrderRecord) => number) =>
  list.reduce((s, o) => s + pick(o), 0)

const changePercent = (current: number, previous: number): number | undefined =>
  previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : undefined

export const reportMock = {
  /** GET /api/reports/dashboard (FR-01, FR-02) */
  async dashboard(): Promise<DashboardReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const now = new Date()
    const todayStart = parseDay(localDateKey(now))
    const today = paidOrdersBetween(todayStart, todayStart)
    const yesterdayStart = addDays(todayStart, -1)
    const sameTimeYesterday = addDays(now, -1).getTime()
    const yesterday = paidOrdersBetween(yesterdayStart, yesterdayStart).filter(
      (o) => new Date(o.paidAt!).getTime() <= sameTimeYesterday
    )
    const revenue = sum(today, (o) => o.total)
    const yRevenue = sum(yesterday, (o) => o.total)

    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, orderCount: 0 }))
    for (const o of today) {
      const h = new Date(o.paidAt!).getHours()
      hourly[h].revenue += o.total
      hourly[h].orderCount += 1
    }

    const byItem = new Map<
      string,
      { menuItemId: string; code: string; name: string; quantity: number; revenue: number }
    >()
    for (const o of today) {
      for (const line of o.items) {
        const cur = byItem.get(line.menuItemId) ?? {
          menuItemId: line.menuItemId,
          code: line.itemCode,
          name: line.itemName,
          quantity: 0,
          revenue: 0,
        }
        cur.quantity += line.quantity
        cur.revenue += line.lineNet
        byItem.set(line.menuItemId, cur)
      }
    }

    return {
      date: localDateKey(now),
      asOf: now.toISOString(),
      revenue,
      orderCount: today.length,
      avgOrderValue: today.length ? Math.round(revenue / today.length) : 0,
      yesterdaySameTime: { revenue: yRevenue, orderCount: yesterday.length },
      revenueChangePercent: changePercent(revenue, yRevenue),
      hourly,
      topItems: [...byItem.values()]
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .slice(0, 5),
      openShifts: shiftsDb
        .filter((s) => s.status === 'DangMo')
        .map((s) => ({ id: s.id, code: s.code, cashierName: s.cashierName, openedAt: s.openedAt })),
    }
  },

  /** GET /api/reports/revenue (FR-28, TC-28) */
  async revenue(query: DateRangeQuery): Promise<RevenueReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to, days } = validateRange(query)
    const prevFrom = addDays(from, -days)
    const prevTo = addDays(from, -1)
    const current = paidOrdersBetween(from, to)
    const previous = paidOrdersBetween(prevFrom, prevTo)

    const byDay = new Map<string, { revenue: number; orderCount: number; discount: number }>()
    for (const o of current) {
      const key = paidKey(o)
      const cur = byDay.get(key) ?? { revenue: 0, orderCount: 0, discount: 0 }
      cur.revenue += o.total
      cur.orderCount += 1
      cur.discount += o.discountTotal
      byDay.set(key, cur)
    }
    const prevByDay = new Map<string, number>()
    for (const o of previous) {
      const key = paidKey(o)
      prevByDay.set(key, (prevByDay.get(key) ?? 0) + o.total)
    }

    const daily = Array.from({ length: days }, (_, i) => {
      const date = localDateKey(addDays(from, i))
      const cur = byDay.get(date) ?? { revenue: 0, orderCount: 0, discount: 0 }
      return {
        date,
        ...cur,
        previousRevenue: prevByDay.get(localDateKey(addDays(prevFrom, i))) ?? 0,
      }
    })

    const revenue = sum(current, (o) => o.total)
    const prevRevenue = sum(previous, (o) => o.total)
    return {
      from: localDateKey(from),
      to: localDateKey(to),
      totals: {
        revenue,
        orderCount: current.length,
        discount: sum(current, (o) => o.discountTotal),
        avgOrderValue: current.length ? Math.round(revenue / current.length) : 0,
      },
      previous: {
        from: localDateKey(prevFrom),
        to: localDateKey(prevTo),
        revenue: prevRevenue,
        orderCount: previous.length,
        discount: sum(previous, (o) => o.discountTotal),
      },
      revenueChangePercent: changePercent(revenue, prevRevenue),
      daily,
    }
  },

  /** GET /api/reports/top-items (FR-29): revenue = Σ lineNet */
  async topItems(query: TopItemsQuery): Promise<TopItemsReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to } = validateRange(query)
    const categories = new Map(categoriesDb.all().map((c) => [c.id, c.name]))
    const byItem = new Map<string, TopItemsReport['items'][number]>()
    let totalQuantity = 0
    let totalRevenue = 0
    for (const o of paidOrdersBetween(from, to)) {
      for (const line of o.items) {
        if (query.categoryId && line.categoryId !== query.categoryId) continue
        const cur = byItem.get(line.menuItemId) ?? {
          menuItemId: line.menuItemId,
          code: line.itemCode,
          name: line.itemName,
          categoryId: line.categoryId,
          categoryName: categories.get(line.categoryId) ?? '',
          quantity: 0,
          revenue: 0,
          share: 0,
        }
        cur.quantity += line.quantity
        cur.revenue += line.lineNet
        totalQuantity += line.quantity
        totalRevenue += line.lineNet
        byItem.set(line.menuItemId, cur)
      }
    }
    const items = [...byItem.values()]
      .map((x) => ({
        ...x,
        share: totalRevenue ? Math.round((x.revenue / totalRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, query.limit && query.limit > 0 ? query.limit : 20)
    return { totalQuantity, totalRevenue, items }
  },

  /** GET /api/reports/heatmap (FR-30): 7 × 24 */
  async heatmap(query: DateRangeQuery): Promise<HeatmapReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to } = validateRange(query)
    const cells = Array.from({ length: 7 * 24 }, (_, i) => ({
      dayOfWeek: Math.floor(i / 24) + 1,
      hour: i % 24,
      revenue: 0,
      orderCount: 0,
    }))
    for (const o of paidOrdersBetween(from, to)) {
      const d = new Date(o.paidAt!)
      const cell = cells[(isoDayOfWeek(d) - 1) * 24 + d.getHours()]
      cell.revenue += o.total
      cell.orderCount += 1
    }
    return { cells, maxRevenue: Math.max(0, ...cells.map((c) => c.revenue)) }
  },

  /** GET /api/reports/payment-methods (FR-31) */
  async paymentMethods(query: DateRangeQuery): Promise<PaymentMethodReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to } = validateRange(query)
    const orders = paidOrdersBetween(from, to)
    const total = sum(orders, (o) => o.total)
    const methods: PaymentMethod[] = ['TienMat', 'ChuyenKhoan']
    return {
      items: methods.map((method) => {
        const list = orders.filter((o) => o.payment?.method === method)
        const amount = sum(list, (o) => o.total)
        return {
          method,
          amount,
          orderCount: list.length,
          share: total ? Math.round((amount / total) * 1000) / 10 : 0,
        }
      }),
    }
  },

  /** GET /api/reports/cashiers (FR-31): ca theo openedAt trong khoảng */
  async cashiers(query: DateRangeQuery): Promise<CashierReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to } = validateRange(query)
    const start = from.getTime()
    const end = addDays(to, 1).getTime()
    const byCashier = new Map<string, CashierReport['items'][number]>()
    const ensure = (id: string, name: string) => {
      const cur = byCashier.get(id) ?? {
        cashierId: id,
        cashierName: name,
        shiftCount: 0,
        orderCount: 0,
        revenue: 0,
        totalDifference: 0,
        shiftsNeedingReview: 0,
      }
      byCashier.set(id, cur)
      return cur
    }
    for (const s of shiftsDb.all()) {
      const t = new Date(s.openedAt).getTime()
      if (t < start || t >= end) continue
      const row = ensure(s.cashierId, s.cashierName)
      row.shiftCount += 1
      row.totalDifference += s.difference ?? 0
      if (s.status === 'CanKiemTra') row.shiftsNeedingReview += 1
    }
    for (const o of paidOrdersBetween(from, to)) {
      const row = ensure(o.cashierId, o.cashierName)
      row.orderCount += 1
      row.revenue += o.total
    }
    return { items: [...byCashier.values()].sort((a, b) => b.revenue - a.revenue) }
  },

  /** GET /api/reports/cancelled-orders (SRS §6, TC-29) */
  async cancelledOrders(query: CancelledOrdersQuery): Promise<PaginatedResult<CancelledOrderItem>> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to } = validateRange(query)
    const start = from.getTime()
    const end = addDays(to, 1).getTime()
    const items = ordersDb
      .filter((o) => {
        // 07 §5 #9: lọc theo ngày hủy
        if (o.status !== 'DaHuy' || !o.cancelledAt) return false
        const t = new Date(o.cancelledAt).getTime()
        return t >= start && t < end
      })
      .sort((a, b) => (b.cancelledAt ?? '').localeCompare(a.cancelledAt ?? ''))
      .map<CancelledOrderItem>((o) => ({
        id: o.id,
        code: o.code ?? '',
        paidAt: o.paidAt!,
        cancelledAt: o.cancelledAt ?? o.paidAt!,
        cashierName: o.cashierName,
        cancelledByName: o.cancelledByName ?? '',
        cancelReason: o.cancelReason ?? '',
        total: o.total,
        paymentMethod: o.payment?.method ?? 'TienMat',
      }))
    return paginate(items, query)
  },
}
