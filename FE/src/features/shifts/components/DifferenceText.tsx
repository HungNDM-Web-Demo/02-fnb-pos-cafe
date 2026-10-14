import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SHIFT_DIFFERENCE_LIMIT } from '../types/shift.types'

/** Chênh lệch ca: âm hiện "−70.000 ₫", đỏ khi vượt 50.000 ₫, xanh khi trong mức (07 §4, TC-09). */
export function DifferenceText({
  value,
  className,
  strong,
}: {
  value: number | null | undefined
  className?: string
  strong?: boolean
}) {
  if (value === null || value === undefined)
    return <span className={cn('text-muted-foreground', className)}>—</span>
  const over = Math.abs(value) > SHIFT_DIFFERENCE_LIMIT
  const sign = value < 0 ? '−' : value > 0 ? '+' : ''
  return (
    <span
      className={cn(
        'tabular-nums',
        over ? 'text-destructive' : 'text-success',
        strong && 'font-semibold',
        className
      )}
    >
      {sign}
      {formatVnd(Math.abs(value))}
    </span>
  )
}
