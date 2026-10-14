'use client'

import { useQuery } from '@tanstack/react-query'
import { storeProfileService } from '../services/store-profile.service'

export const storeProfileKeys = { profile: ['store-profile'] as const }

/** Thông tin quán in trên bill, QR (chỉ cần đăng nhập) */
export function useStoreProfile() {
  return useQuery({
    queryKey: storeProfileKeys.profile,
    queryFn: () => storeProfileService.get(),
    staleTime: 5 * 60_000,
  })
}
