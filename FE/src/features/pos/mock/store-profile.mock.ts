import { mockDelay } from '@/lib/data-source'
import { requireSession } from '@/mock/mock-auth'
import { getSettingsMap, syncSeedEntries } from '@/mock/system-data'
import type { StoreProfile } from '../types/pos.types'

/** GET /api/store-profile (07 §2.10): khóa Store.* trong cài đặt, chỉ cần đăng nhập. */
export const storeProfileMock = {
  async get(): Promise<StoreProfile> {
    await mockDelay(50, 150)
    requireSession()
    syncSeedEntries()
    const s = getSettingsMap()
    return {
      name: s['Store.Name'] ?? '',
      address: s['Store.Address'] ?? '',
      phone: s['Store.Phone'] ?? '',
      receiptFooter: s['Store.ReceiptFooter'] ?? '',
      bankBin: s['Store.BankBin'] ?? '',
      bankAccount: s['Store.BankAccount'] ?? '',
      bankAccountName: s['Store.BankAccountName'] ?? '',
    }
  },
}
