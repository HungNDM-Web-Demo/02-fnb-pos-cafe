'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { reportService } from '../services/report.service'
import type { CancelledOrdersQuery, DateRangeQuery, TopItemsQuery } from '../types/report.types'

export const reportKeys = {
  all: ['reports'] as const,
  dashboard: ['reports', 'dashboard'] as const,
  revenue: (q: DateRangeQuery) => ['reports', 'revenue', q] as const,
  topItems: (q: TopItemsQuery) => ['reports', 'top-items', q] as const,
  heatmap: (q: DateRangeQuery) => ['reports', 'heatmap', q] as const,
  paymentMethods: (q: DateRangeQuery) => ['reports', 'payment-methods', q] as const,
  cashiers: (q: DateRangeQuery) => ['reports', 'cashiers', q] as const,
  cancelled: (q: CancelledOrdersQuery) => ['reports', 'cancelled', q] as const,
}

export function useDashboardReport(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reportKeys.dashboard,
    queryFn: () => reportService.dashboard(),
    enabled: options.enabled ?? true,
    refetchInterval: 60_000,
  })
}

type Opt = { enabled?: boolean }
const common = { placeholderData: keepPreviousData, staleTime: 60_000 }

export const useRevenueReport = (q: DateRangeQuery, o: Opt = {}) =>
  useQuery({
    queryKey: reportKeys.revenue(q),
    queryFn: () => reportService.revenue(q),
    enabled: o.enabled ?? true,
    ...common,
  })
export const useTopItemsReport = (q: TopItemsQuery, o: Opt = {}) =>
  useQuery({
    queryKey: reportKeys.topItems(q),
    queryFn: () => reportService.topItems(q),
    enabled: o.enabled ?? true,
    ...common,
  })
export const useHeatmapReport = (q: DateRangeQuery, o: Opt = {}) =>
  useQuery({
    queryKey: reportKeys.heatmap(q),
    queryFn: () => reportService.heatmap(q),
    enabled: o.enabled ?? true,
    ...common,
  })
export const usePaymentMethodReport = (q: DateRangeQuery, o: Opt = {}) =>
  useQuery({
    queryKey: reportKeys.paymentMethods(q),
    queryFn: () => reportService.paymentMethods(q),
    enabled: o.enabled ?? true,
    ...common,
  })
export const useCashierReport = (q: DateRangeQuery, o: Opt = {}) =>
  useQuery({
    queryKey: reportKeys.cashiers(q),
    queryFn: () => reportService.cashiers(q),
    enabled: o.enabled ?? true,
    ...common,
  })
export const useCancelledOrdersReport = (q: CancelledOrdersQuery, o: Opt = {}) =>
  useQuery({
    queryKey: reportKeys.cancelled(q),
    queryFn: () => reportService.cancelledOrders(q),
    enabled: o.enabled ?? true,
    ...common,
  })
