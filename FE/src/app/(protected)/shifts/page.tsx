import type { Metadata } from 'next'
import { ShiftsPage } from '@/features/shifts/pages/ShiftsPage'

export const metadata: Metadata = { title: 'Ca làm' }

export default function Page() {
  return <ShiftsPage />
}
