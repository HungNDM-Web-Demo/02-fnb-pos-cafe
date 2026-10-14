'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shiftService } from '../services/shift.service'
import type {
  CloseShiftRequest,
  OpenShiftRequest,
  ReviewShiftRequest,
  ShiftQuery,
} from '../types/shift.types'

export const shiftKeys = {
  all: ['shifts'] as const,
  current: ['shifts', 'current'] as const,
  summary: ['shifts', 'current', 'summary'] as const,
  list: (query: ShiftQuery) => ['shifts', 'list', query] as const,
  detail: (id: string) => ['shifts', 'detail', id] as const,
}

/** Ca đang mở của người đăng nhập; null = chưa mở ca (TC-07) */
export function useCurrentShift(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: shiftKeys.current,
    queryFn: () => shiftService.getCurrent(),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  })
}

export function useCurrentShiftSummary(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: shiftKeys.summary,
    queryFn: () => shiftService.getCurrentSummary(),
    enabled: options.enabled ?? true,
    staleTime: 10_000,
  })
}

export function useShifts(query: ShiftQuery) {
  return useQuery({
    queryKey: shiftKeys.list(query),
    queryFn: () => shiftService.getList(query),
    placeholderData: keepPreviousData,
  })
}

export function useShift(id: string | null | undefined) {
  return useQuery({
    queryKey: shiftKeys.detail(id ?? ''),
    queryFn: () => shiftService.getById(id!),
    enabled: !!id,
  })
}

function useInvalidateShifts() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: shiftKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['reports'] })
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
  }
}

export function useOpenShift() {
  const invalidate = useInvalidateShifts()
  return useMutation({
    mutationFn: (input: OpenShiftRequest) => shiftService.open(input),
    onSuccess: invalidate,
  })
}

export function useCloseShift() {
  const invalidate = useInvalidateShifts()
  return useMutation({
    mutationFn: (input: CloseShiftRequest) => shiftService.close(input),
    onSuccess: invalidate,
  })
}

export function useReviewShift() {
  const invalidate = useInvalidateShifts()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewShiftRequest }) =>
      shiftService.review(id, input),
    onSuccess: invalidate,
  })
}
