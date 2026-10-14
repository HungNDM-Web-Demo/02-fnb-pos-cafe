'use client'

import { useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
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
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { OptionChip } from '@/features/pos/components/OptionChip'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { useOpenShift } from '../hooks/use-shifts'
import type { ShiftDto } from '../types/shift.types'

type OpenShiftDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpened?: (shift: ShiftDto) => void
}

const DEFAULT_OPENING_CASH = 1_000_000
const PRESETS = [500_000, 1_000_000, 1_500_000, 2_000_000]

/** UC-03 Mở ca: nhập tiền đầu ca (mặc định 1.000.000 ₫), tạo ca CA{yyMMdd}{nn} (TC-06). */
export function OpenShiftDialog({ open, onOpenChange, onOpened }: OpenShiftDialogProps) {
  const openShift = useOpenShift()
  const [openingCash, setOpeningCash] = useState<number | null>(DEFAULT_OPENING_CASH)
  const [error, setError] = useState<string | null>(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setOpeningCash(DEFAULT_OPENING_CASH)
      setError(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (openingCash === null || openingCash < 0) return setError('Nhập tiền đầu ca')
    setError(null)
    openShift.mutate(
      { openingCash },
      {
        onSuccess: (shift) => {
          toast.success(`Đã mở ca ${shift.code}`)
          onOpened?.(shift)
          onOpenChange(false)
        },
        onError: (err) => setError(getFieldErrors(err).openingCash ?? getErrorMessage(err)),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !openShift.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sm:flex-row sm:items-start sm:gap-4">
          <span
            className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <Wallet className="size-5" />
          </span>
          <div className="space-y-1.5">
            <DialogTitle>Mở ca bán hàng</DialogTitle>
            <DialogDescription>
              Đếm tiền mặt có sẵn trong két và nhập tiền đầu ca để cuối ca đối soát.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label="Tiền đầu ca" required error={error ?? undefined}>
            <MoneyInput
              value={openingCash}
              onChange={setOpeningCash}
              className="h-12 text-xl"
              autoFocus
            />
          </FormField>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <OptionChip
                key={p}
                selected={openingCash === p}
                onClick={() => setOpeningCash(p)}
                className="px-1 text-xs"
              >
                {new Intl.NumberFormat('vi-VN').format(p / 1000)}k
              </OptionChip>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={openShift.isPending}
            >
              Để sau
            </Button>
            <Button
              type="submit"
              variant="cta"
              size="lg"
              disabled={openShift.isPending}
              className="min-w-32"
            >
              {openShift.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Mở ca
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
