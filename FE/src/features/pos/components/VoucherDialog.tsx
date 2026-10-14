'use client'

import { useState } from 'react'
import { Loader2, TicketPercent, Trash2 } from 'lucide-react'
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
import { useCheckVoucher } from '@/features/promotions/hooks/use-promotions'
import type { VoucherCheckResult } from '@/features/promotions/types/promotion.types'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'

type VoucherDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtotal: number
  current: VoucherCheckResult | null
  onApply: (voucher: VoucherCheckResult | null) => void
}

/** UC-06 1b: nhập mã voucher, kiểm tra BR-06 qua POST /api/vouchers/check; lỗi hiện đúng câu tại ô mã (TC-20). */
export function VoucherDialog({
  open,
  onOpenChange,
  subtotal,
  current,
  onApply,
}: VoucherDialogProps) {
  const check = useCheckVoucher()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCode(current?.code ?? '')
      setError(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return setError('Nhập mã voucher')
    setError(null)
    check.mutate(
      { code: trimmed, subtotal },
      {
        onSuccess: (result) => {
          onApply(result)
          onOpenChange(false)
        },
        onError: (err) => setError(getFieldErrors(err).code ?? getErrorMessage(err)),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !check.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="sm:flex-row sm:items-start sm:gap-4">
          <span
            className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <TicketPercent className="size-5" />
          </span>
          <div className="space-y-1.5">
            <DialogTitle>Voucher</DialogTitle>
            <DialogDescription>
              Nhập mã khách đưa. Tổng tiền hàng hiện tại {formatVnd(subtotal)}.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label="Mã voucher" required error={error ?? undefined}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              placeholder="vd: GIAM20K"
              className="h-12 text-center font-mono text-lg tracking-widest uppercase"
              autoFocus
            />
          </FormField>
          {current && (
            <p className="text-muted-foreground text-sm">
              Đang áp <span className="text-foreground font-medium">{current.code}</span>, giảm
              khoảng {formatVnd(current.estimatedDiscount)}.
            </p>
          )}
          <DialogFooter className="sm:justify-between">
            {current ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onApply(null)
                  onOpenChange(false)
                }}
              >
                <Trash2 aria-hidden="true" />
                Bỏ voucher
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={check.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={check.isPending}>
                {check.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                Áp dụng
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
