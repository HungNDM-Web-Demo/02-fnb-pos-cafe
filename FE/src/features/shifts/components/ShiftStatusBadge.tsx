import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { shiftStatusLabels, type ShiftStatus } from '../types/shift.types'

const TONES: Record<ShiftStatus, StatusTone> = {
  DangMo: 'success',
  DaChot: 'neutral',
  CanKiemTra: 'danger',
  DaKiemTra: 'info',
}

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  return <StatusBadge tone={TONES[status]}>{shiftStatusLabels[status]}</StatusBadge>
}
