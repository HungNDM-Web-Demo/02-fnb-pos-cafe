import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import { storeProfileMock } from '../mock/store-profile.mock'
import type { StoreProfile } from '../types/pos.types'

/** GET /api/store-profile (07 §2.10) */
export const storeProfileService = {
  get: (): Promise<StoreProfile> =>
    isMockMode() ? storeProfileMock.get() : apiCall.get<StoreProfile>(apiRoutes.storeProfile),
}
