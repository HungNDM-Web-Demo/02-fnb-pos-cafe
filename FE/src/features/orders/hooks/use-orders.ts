'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orderService } from '../services/order.service'
import type {
  CancelOrderRequest,
  CheckoutRequest,
  DiscountApprovalRequest,
  HoldOrderRequest,
  OrderQuery,
} from '../types/order.types'

export const orderKeys = {
  all: ['orders'] as const,
  list: (query: OrderQuery) => ['orders', 'list', query] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  held: ['orders', 'held'] as const,
  nextCode: ['orders', 'next-code'] as const,
}

export function useOrders(query: OrderQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: orderKeys.list(query),
    queryFn: () => orderService.getList(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: () => orderService.getById(id!),
    enabled: !!id,
  })
}

export function useHeldOrders(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: orderKeys.held,
    queryFn: () => orderService.getHeld(),
    enabled: options.enabled ?? true,
    staleTime: 10_000,
  })
}

/** Mã hóa đơn dự kiến cho QR; lấy mới mỗi lần mở hộp thanh toán */
export function useNextOrderCode(enabled: boolean) {
  return useQuery({
    queryKey: orderKeys.nextCode,
    queryFn: () => orderService.nextCode(),
    enabled,
    staleTime: 0,
    gcTime: 0,
  })
}

/** Sau khi thanh toán/hủy: làm mới hóa đơn, ca, báo cáo, voucher, khách hàng, thực đơn (everSold) */
export function useInvalidateSales() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of [
      'orders',
      'shifts',
      'reports',
      'promotions',
      'vouchers',
      'customers',
      'menu',
      'audit-logs',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useCheckout() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: (request: CheckoutRequest) => orderService.checkout(request),
    onSuccess: invalidate,
  })
}

export function useCancelOrder() {
  const invalidate = useInvalidateSales()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CancelOrderRequest }) =>
      orderService.cancel(id, input),
    onSuccess: invalidate,
  })
}

export function useHoldOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id?: string | null; request: HoldOrderRequest }) =>
      id ? orderService.updateHeld(id, request) : orderService.hold(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.held })
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export function useDeleteHeldOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => orderService.deleteHeld(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.held })
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export function useApproveDiscount() {
  return useMutation({
    mutationFn: (request: DiscountApprovalRequest) => orderService.approveDiscount(request),
  })
}
