import type { Metadata } from 'next'
import { ShiftReceiptPage } from '@/features/shifts/pages/ShiftReceiptPage'

export const metadata: Metadata = { title: 'Phiếu chốt ca' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ShiftReceiptPage id={id} />
}
