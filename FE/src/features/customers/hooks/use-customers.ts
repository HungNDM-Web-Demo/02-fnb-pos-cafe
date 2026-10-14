'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerService } from '../services/customer.service'
import type { CustomerQuery, SaveCustomerRequest } from '../types/customer.types'

export const customerKeys = {
  all: ['customers'] as const,
  list: (query: CustomerQuery) => ['customers', 'list', query] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
}

export function useCustomers(query: CustomerQuery) {
  return useQuery({
    queryKey: customerKeys.list(query),
    queryFn: () => customerService.getList(query),
    placeholderData: keepPreviousData,
  })
}

export function useCustomer(id: string | null | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: () => customerService.getById(id!),
    enabled: !!id,
  })
}

/** Tra nhanh theo SĐT ở màn bán hàng (FR-33) */
export function useLookupCustomer() {
  return useMutation({ mutationFn: (phone: string) => customerService.lookup(phone) })
}

export function useSaveCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveCustomerRequest }) =>
      id ? customerService.update(id, input) : customerService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}
