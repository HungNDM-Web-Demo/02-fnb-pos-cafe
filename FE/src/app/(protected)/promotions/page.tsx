import type { Metadata } from 'next'
import { PromotionsPage } from '@/features/promotions/pages/PromotionsPage'

export const metadata: Metadata = { title: 'Khuyến mãi' }

export default function Page() {
  return <PromotionsPage />
}
