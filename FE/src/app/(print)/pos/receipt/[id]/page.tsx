import type { Metadata } from 'next'
import { ReceiptPage } from '@/features/orders/pages/ReceiptPage'

export const metadata: Metadata = { title: 'Hóa đơn' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReceiptPage id={id} />
}
