import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { reportMock } from '../mock/report.mock'
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

/** Service báo cáo (07 §2.8): chọn mock hoặc API. */
export const reportService = {
  dashboard: (): Promise<DashboardReport> =>
    isMockMode()
      ? reportMock.dashboard()
      : apiCall.get<DashboardReport>(apiRoutes.reports.dashboard),
  revenue: (query: DateRangeQuery): Promise<RevenueReport> =>
    isMockMode()
      ? reportMock.revenue(query)
      : apiCall.get<RevenueReport>(apiRoutes.reports.revenue, { params: query }),
  topItems: (query: TopItemsQuery): Promise<TopItemsReport> =>
    isMockMode()
      ? reportMock.topItems(query)
      : apiCall.get<TopItemsReport>(apiRoutes.reports.topItems, { params: query }),
  heatmap: (query: DateRangeQuery): Promise<HeatmapReport> =>
    isMockMode()
      ? reportMock.heatmap(query)
      : apiCall.get<HeatmapReport>(apiRoutes.reports.heatmap, { params: query }),
  paymentMethods: (query: DateRangeQuery): Promise<PaymentMethodReport> =>
    isMockMode()
      ? reportMock.paymentMethods(query)
      : apiCall.get<PaymentMethodReport>(apiRoutes.reports.paymentMethods, { params: query }),
  cashiers: (query: DateRangeQuery): Promise<CashierReport> =>
    isMockMode()
      ? reportMock.cashiers(query)
      : apiCall.get<CashierReport>(apiRoutes.reports.cashiers, { params: query }),
  cancelledOrders: (query: CancelledOrdersQuery): Promise<PaginatedResult<CancelledOrderItem>> =>
    isMockMode()
      ? reportMock.cancelledOrders(query)
      : apiCall.get<PaginatedResult<CancelledOrderItem>>(apiRoutes.reports.cancelledOrders, {
          params: query,
        }),
}
