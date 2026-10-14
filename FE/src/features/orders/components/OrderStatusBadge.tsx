import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { orderStatusLabels, type OrderStatus } from '../types/order.types'

const TONES: Record<OrderStatus, StatusTone> = {
  DangGiu: 'info',
  DaThanhToan: 'success',
  DaHuy: 'danger',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusBadge tone={TONES[status]}>{orderStatusLabels[status]}</StatusBadge>
}
