'use client'

import { useState } from 'react'
import { Percent, Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import type { DiscountType, ManualDiscount } from '@/features/orders/types/order.types'
import { formatVnd } from '@/lib/format'
import { manualDiscountAmount } from '../lib/pricing'
import { MoneyInput } from './MoneyInput'
import { OptionChip } from './OptionChip'

const REASONS = ['Khách quen', 'Món lỗi', 'Khác'] as const
type ReasonKind = (typeof REASONS)[number]

type DiscountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Giảm giá hóa đơn" hoặc "Giảm giá dòng: Trà sữa trân châu" */
  title: string
  /** Mức tiền được giảm trên đó (thành tiền dòng hoặc tiền còn lại của hóa đơn) */
  base: number
  /** Hạn mức thu ngân còn lại; vượt thì báo cần quản lý xác nhận */
  limitHint?: string
  current?: ManualDiscount | null
  onSubmit: (discount: ManualDiscount | null) => void
}

function parseReason(reason: string | undefined): { kind: ReasonKind; other: string } {
  if (!reason) return { kind: 'Khách quen', other: '' }
  if (reason === 'Khách quen' || reason === 'Món lỗi') return { kind: reason, other: '' }
  return { kind: 'Khác', other: reason.replace(/^Khác:\s*/, '') }
}

/** UC-06: giảm giá theo phần trăm hoặc số tiền, có lý do (Khách quen, Món lỗi, Khác kèm ghi chú). */
export function DiscountDialog({
  open,
  onOpenChange,
  title,
  base,
  limitHint,
  current,
  onSubmit,
}: DiscountDialogProps) {
  const [type, setType] = useState<DiscountType>('PhanTram')
  const [value, setValue] = useState<number | null>(null)
  const [reason, setReason] = useState<ReasonKind>('Khách quen')
  const [other, setOther] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setType(current?.type ?? 'PhanTram')
      setValue(current?.value ?? null)
      const parsed = parseReason(current?.reason)
      setReason(parsed.kind)
      setOther(parsed.other)
      setError(null)
    }
  }

  const amount = manualDiscountAmount(value ? { type, value, reason: '' } : null, base)
  const reasonText = reason === 'Khác' ? `Khác: ${other.trim()}` : reason

  const submit = () => {
    if (!value || value <= 0)
      return setError(type === 'PhanTram' ? 'Nhập phần trăm từ 1 đến 100' : 'Nhập số tiền giảm')
    if (type === 'PhanTram' && value > 100) return setError('Phần trăm tối đa 100')
    if (type === 'SoTien' && value % 1000 !== 0) return setError('Số tiền phải là bội số 1.000 ₫')
    if (reason === 'Khác' && !other.trim()) return setError('Nhập lý do')
    onSubmit({ type, value, reason: reasonText })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Tính trên {formatVnd(base)}. Phần trăm làm tròn xuống tới 1.000 ₫.
            {limitHint ? ` ${limitHint}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kiểu giảm">
            <OptionChip selected={type === 'PhanTram'} onClick={() => setType('PhanTram')}>
              Phần trăm (%)
            </OptionChip>
            <OptionChip selected={type === 'SoTien'} onClick={() => setType('SoTien')}>
              Số tiền (₫)
            </OptionChip>
          </div>

          <FormField
            label={type === 'PhanTram' ? 'Phần trăm giảm' : 'Số tiền giảm'}
            required
            error={error ?? undefined}
          >
            {type === 'PhanTram' ? (
              <div className="relative">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={value ?? ''}
                  onChange={(e) => setValue(e.target.value ? Number(e.target.value) : null)}
                  className="h-11 pr-9 text-right text-lg tabular-nums"
                  autoFocus
                />
                <Percent
                  className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <MoneyInput value={value} onChange={setValue} className="h-11 text-lg" autoFocus />
            )}
          </FormField>

          {type === 'PhanTram' && (
            <div className="grid grid-cols-5 gap-1.5">
              {[5, 10, 15, 20, 50].map((p) => (
                <OptionChip
                  key={p}
                  selected={value === p}
                  onClick={() => setValue(p)}
                  className="min-h-10 px-1"
                >
                  {p}%
                </OptionChip>
              ))}
            </div>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Lý do <span className="text-destructive">*</span>
            </legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Lý do">
              {REASONS.map((r) => (
                <OptionChip key={r} selected={reason === r} onClick={() => setReason(r)}>
                  {r}
                </OptionChip>
              ))}
            </div>
            {reason === 'Khác' && (
              <Input
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Nhập lý do"
                maxLength={150}
                className="mt-2 h-11"
              />
            )}
          </fieldset>

          <p className="bg-muted/60 rounded-lg px-3 py-2 text-sm">
            Giảm <span className="font-semibold tabular-nums">{formatVnd(amount)}</span>
            {amount > 0 && (
              <>
                {' '}
                → còn <span className="font-semibold tabular-nums">{formatVnd(base - amount)}</span>
              </>
            )}
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          {current ? (
            <Button variant="destructive" onClick={() => onSubmit(null)}>
              <Trash2 aria-hidden="true" />
              Bỏ giảm giá
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={submit}>Áp dụng</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
