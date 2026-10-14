'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Minus, PauseCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { getErrorMessage, getFieldErrors, isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCloseShift } from '../hooks/use-shifts'
import { SHIFT_DIFFERENCE_LIMIT, type ShiftDto, type ShiftSummary } from '../types/shift.types'
import { DifferenceText } from './DifferenceText'

type CloseShiftDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary: ShiftSummary
  onClosed: (shift: ShiftDto) => void
}

const DENOMINATIONS = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000]

/**
 * UC-10 Chốt ca: tổng hợp ca, bảng đếm theo mệnh giá, chênh lệch (BR-11, BR-12), bắt ghi chú khi lệch
 * quá 50.000 ₫ (TC-09), liệt kê đơn giữ còn lại và chặn chốt (TC-10).
 */
export function CloseShiftDialog({ open, onOpenChange, summary, onClosed }: CloseShiftDialogProps) {
  const close = useCloseShift()
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [counted, setCounted] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [blockingHeld, setBlockingHeld] = useState<ShiftSummary['heldOrders']>(summary.heldOrders)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCounts({})
      setCounted(null)
      setNote('')
      setErrors({})
      setBlockingHeld(summary.heldOrders)
    }
  }

  const sumOfCounts = useMemo(
    () => DENOMINATIONS.reduce((s, d) => s + d * (counts[d] ?? 0), 0),
    [counts]
  )
  const hasCounts = Object.values(counts).some((n) => n > 0)
  const countedCash = hasCounts ? sumOfCounts : counted
  const difference = countedCash === null ? null : countedCash - summary.expectedCash
  const needsNote = difference !== null && Math.abs(difference) > SHIFT_DIFFERENCE_LIMIT
  const hasHeld = blockingHeld.length > 0

  const setCount = (d: number, n: number) => setCounts((c) => ({ ...c, [d]: Math.max(0, n) }))

  const submit = () => {
    const next: Record<string, string> = {}
    if (countedCash === null) next.countedCash = 'Nhập tiền mặt thực đếm'
    if (needsNote && !note.trim()) next.note = 'Chênh lệch quá 50.000 ₫, cần ghi chú'
    setErrors(next)
    if (Object.keys(next).length || countedCash === null) return
    close.mutate(
      { countedCash, note: note.trim() || undefined },
      {
        onSuccess: (shift) => {
          toast.success(`Đã chốt ca ${shift.code}`)
          onOpenChange(false)
          onClosed(shift)
        },
        onError: (error) => {
          const fields = getFieldErrors(error)
          if (Object.keys(fields).length) return setErrors(fields)
          if (isApiError(error) && Array.isArray(error.problem.heldOrders)) {
            setBlockingHeld(error.problem.heldOrders as ShiftSummary['heldOrders'])
          }
          toast.error(getErrorMessage(error))
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !close.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Chốt ca {summary.code}</DialogTitle>
          <DialogDescription>
            Đếm tiền trong két, nhập tiền mặt thực đếm; hệ thống tính chênh lệch so với tiền mặt lý
            thuyết.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(100dvh-14rem)] gap-6 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Tổng hợp ca</h3>
            <dl className="divide-y rounded-lg border text-sm">
              <Row label="Số hóa đơn" value={String(summary.orderCount)} />
              <Row label="Hóa đơn hủy" value={String(summary.cancelledOrderCount)} />
              <Row label="Tiền mặt" value={formatVnd(summary.cashSales)} />
              <Row label="Chuyển khoản" value={formatVnd(summary.transferSales)} />
              <Row label="Doanh thu" value={formatVnd(summary.revenue)} strong />
              <Row label="Tiền đầu ca" value={formatVnd(summary.openingCash)} />
              <Row label="Tiền mặt lý thuyết" value={formatVnd(summary.expectedCash)} strong />
            </dl>

            {hasHeld && (
              <div
                className="border-warning/40 bg-warning/10 rounded-lg border p-3 text-sm"
                role="alert"
              >
                <p className="text-warning flex items-center gap-2 font-semibold">
                  <PauseCircle className="size-4" aria-hidden="true" />
                  Còn {blockingHeld.length} đơn giữ, thanh toán hoặc xóa trước khi chốt ca
                </p>
                <ul className="mt-2 space-y-1">
                  {blockingHeld.map((h) => (
                    <li key={h.id} className="flex justify-between">
                      <span>{h.holdName}</span>
                      <span className="tabular-nums">{formatVnd(h.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Tiền mặt thực đếm</h3>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Đếm theo mệnh giá">
              {DENOMINATIONS.map((d) => (
                <div
                  key={d}
                  className="bg-muted/50 flex items-center justify-between gap-1 rounded-lg border px-1.5 py-1"
                >
                  <span className="w-12 text-xs font-medium tabular-nums">{d / 1000}k</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCount(d, (counts[d] ?? 0) - 1)}
                    aria-label={`Bớt tờ ${d}`}
                  >
                    <Minus />
                  </Button>
                  <input
                    type="number"
                    min={0}
                    value={counts[d] ?? ''}
                    onChange={(e) => setCount(d, Number(e.target.value) || 0)}
                    placeholder="0"
                    aria-label={`Số tờ ${formatVnd(d)}`}
                    className="bg-background focus-visible:ring-ring/50 h-8 w-10 rounded border text-center text-sm tabular-nums outline-none focus-visible:ring-3"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCount(d, (counts[d] ?? 0) + 1)}
                    aria-label={`Thêm tờ ${d}`}
                  >
                    <Plus />
                  </Button>
                </div>
              ))}
            </div>
            <FormField
              label="Tổng tiền mặt thực đếm"
              required
              error={errors.countedCash}
              hint={
                hasCounts ? 'Tự cộng từ bảng mệnh giá' : 'Nhập trực tiếp hoặc đếm theo mệnh giá'
              }
            >
              <MoneyInput
                value={countedCash}
                onChange={(v) => {
                  setCounts({})
                  setCounted(v)
                }}
                className="h-12 text-xl font-semibold"
              />
            </FormField>
            <div
              className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3',
                difference === null
                  ? 'bg-muted/40'
                  : Math.abs(difference) > SHIFT_DIFFERENCE_LIMIT
                    ? 'border-destructive/30 bg-destructive/8'
                    : 'border-success/30 bg-success/10'
              )}
              role="status"
              aria-live="polite"
            >
              <span className="font-medium">Chênh lệch</span>
              <DifferenceText value={difference} strong className="text-2xl" />
            </div>
            {needsNote && (
              <p className="text-destructive flex items-center gap-1.5 text-xs" role="alert">
                <AlertTriangle className="size-3.5" aria-hidden="true" /> Lệch quá 50.000 ₫: ca sẽ
                chuyển &ldquo;Cần kiểm tra&rdquo;, bắt buộc ghi chú.
              </p>
            )}
            <FormField label="Ghi chú" required={needsNote} error={errors.note}>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                placeholder="vd: Đếm thiếu, đã báo quản lý"
              />
            </FormField>
          </section>
        </div>

        <DialogFooter className="bg-muted/30 border-t px-6 py-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={close.isPending}
          >
            Hủy
          </Button>
          <Button
            variant="cta"
            size="lg"
            onClick={submit}
            disabled={close.isPending || hasHeld}
            className="min-w-44"
          >
            {close.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Xác nhận chốt ca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between px-3 py-2', strong && 'font-semibold')}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
