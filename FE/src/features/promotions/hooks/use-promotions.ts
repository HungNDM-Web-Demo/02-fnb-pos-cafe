'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { promotionService } from '../services/promotion.service'
import type {
  PromotionQuery,
  SavePromotionRequest,
  SaveVoucherRequest,
  VoucherCheckRequest,
  VoucherQuery,
} from '../types/promotion.types'

export const promotionKeys = {
  all: ['promotions'] as const,
  list: (query: PromotionQuery) => ['promotions', 'list', query] as const,
  active: ['promotions', 'active'] as const,
}
export const voucherKeys = {
  all: ['vouchers'] as const,
  list: (query: VoucherQuery) => ['vouchers', 'list', query] as const,
}

export function usePromotions(query: PromotionQuery) {
  return useQuery({
    queryKey: promotionKeys.list(query),
    queryFn: () => promotionService.getPromotions(query),
    placeholderData: keepPreviousData,
  })
}

/** Khuyến mãi đang chạy hôm nay cho màn bán hàng (FR-14); FE tự xét khung giờ tại máy */
export function useActivePromotions(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: promotionKeys.active,
    queryFn: () => promotionService.getActivePromotions(),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}

export function useVouchers(query: VoucherQuery) {
  return useQuery({
    queryKey: voucherKeys.list(query),
    queryFn: () => promotionService.getVouchers(query),
    placeholderData: keepPreviousData,
  })
}

function useInvalidatePromotions() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: promotionKeys.all })
    void queryClient.invalidateQueries({ queryKey: voucherKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
  }
}

export function useSavePromotion() {
  const invalidate = useInvalidatePromotions()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SavePromotionRequest }) =>
      id ? promotionService.updatePromotion(id, input) : promotionService.createPromotion(input),
    onSuccess: invalidate,
  })
}

export function usePausePromotion() {
  const invalidate = useInvalidatePromotions()
  return useMutation({
    mutationFn: ({ id, isPaused }: { id: string; isPaused: boolean }) =>
      promotionService.pausePromotion(id, { isPaused }),
    onSuccess: invalidate,
  })
}

export function useDeletePromotion() {
  const invalidate = useInvalidatePromotions()
  return useMutation({
    mutationFn: (id: string) => promotionService.deletePromotion(id),
    onSuccess: invalidate,
  })
}

export function useSaveVoucher() {
  const invalidate = useInvalidatePromotions()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveVoucherRequest }) =>
      id ? promotionService.updateVoucher(id, input) : promotionService.createVoucher(input),
    onSuccess: invalidate,
  })
}

export function usePauseVoucher() {
  const invalidate = useInvalidatePromotions()
  return useMutation({
    mutationFn: ({ id, isPaused }: { id: string; isPaused: boolean }) =>
      promotionService.pauseVoucher(id, { isPaused }),
    onSuccess: invalidate,
  })
}

export function useDeleteVoucher() {
  const invalidate = useInvalidatePromotions()
  return useMutation({
    mutationFn: (id: string) => promotionService.deleteVoucher(id),
    onSuccess: invalidate,
  })
}

/** UC-06 1b: kiểm tra voucher khi thu ngân nhập mã */
export function useCheckVoucher() {
  return useMutation({
    mutationFn: (input: VoucherCheckRequest) => promotionService.checkVoucher(input),
  })
}
