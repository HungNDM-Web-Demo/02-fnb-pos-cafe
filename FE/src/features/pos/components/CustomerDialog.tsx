'use client'

import { useState } from 'react'
import { Loader2, Search, Star, UserPlus, UserRound, X } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { permissions } from '@/config/permissions'
import { useLookupCustomer, useSaveCustomer } from '@/features/customers/hooks/use-customers'
import type { CustomerDto } from '@/features/customers/types/customer.types'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors, isApiError } from '@/lib/api-error'
import { formatNumber, formatPhone, formatVnd } from '@/lib/format'
import { PHONE_MESSAGE, cleanPhone, isValidPhone } from '@/lib/validators'
import type { CartCustomer } from '../types/pos.types'

type CustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: CartCustomer | null
  onSelect: (customer: CartCustomer | null) => void
}

/** FR-33: tra khách theo SĐT, thêm nhanh khách mới, gắn vào đơn (P3). */
export function CustomerDialog({ open, onOpenChange, current, onSelect }: CustomerDialogProps) {
  const { can } = usePermissions()
  const lookup = useLookupCustomer()
  const save = useSaveCustomer()
  const [phone, setPhone] = useState('')
  const [found, setFound] = useState<CustomerDto | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setPhone(current?.phone ?? '')
      setFound(null)
      setNotFound(false)
      setName('')
      setError(null)
    }
  }

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = cleanPhone(phone) ?? ''
    if (!isValidPhone(normalized)) return setError(PHONE_MESSAGE)
    setError(null)
    setFound(null)
    setNotFound(false)
    lookup.mutate(normalized, {
      onSuccess: (customer) => setFound(customer),
      onError: (err) => {
        if (isApiError(err) && err.status === 404) setNotFound(true)
        else setError(getErrorMessage(err))
      },
    })
  }

  const quickAdd = () => {
    if (!name.trim()) return setError('Nhập tên khách')
    save.mutate(
      { input: { phone: cleanPhone(phone) ?? '', name: name.trim() } },
      {
        onSuccess: (customer) => {
          toast.success(`Đã thêm khách ${customer.name}`)
          onSelect({ id: customer.id, phone: customer.phone, name: customer.name })
          onOpenChange(false)
        },
        onError: (err) =>
          setError(getFieldErrors(err).phone ?? getFieldErrors(err).name ?? getErrorMessage(err)),
      }
    )
  }

  const pending = lookup.isPending || save.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Khách hàng tích điểm</DialogTitle>
          <DialogDescription>
            Tra theo số điện thoại; 1 điểm cho mỗi 10.000 ₫ thanh toán.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={search} noValidate className="grid gap-4">
          <FormField label="Số điện thoại" required error={error ?? undefined}>
            <div className="flex gap-2">
              <Input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="vd: 0905 111 222"
                className="h-11"
                autoFocus
              />
              <Button
                type="submit"
                variant="secondary"
                className="h-11 shrink-0"
                disabled={pending}
              >
                {lookup.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Search aria-hidden="true" />
                )}
                Tra
              </Button>
            </div>
          </FormField>

          {found && (
            <div className="bg-muted/60 flex items-center gap-3 rounded-lg p-3">
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{found.name}</p>
                <p className="text-muted-foreground tabular-nums">
                  {formatPhone(found.phone)} ·{' '}
                  <Star className="inline size-3.5 -translate-y-px" aria-hidden="true" />{' '}
                  {formatNumber(found.points)} điểm · {found.orderCount} đơn ·{' '}
                  {formatVnd(found.totalSpent)}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  onSelect({ id: found.id, phone: found.phone, name: found.name })
                  onOpenChange(false)
                }}
              >
                Gắn vào đơn
              </Button>
            </div>
          )}

          {notFound && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm">
                Chưa có khách với số này.{' '}
                {can(permissions.customers.create)
                  ? 'Thêm nhanh để tích điểm:'
                  : 'Bạn không có quyền thêm khách.'}
              </p>
              {can(permissions.customers.create) && (
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên khách"
                    className="h-11"
                  />
                  <Button
                    type="button"
                    onClick={quickAdd}
                    disabled={pending}
                    className="h-11 shrink-0"
                  >
                    {save.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <UserPlus aria-hidden="true" />
                    )}
                    Thêm
                  </Button>
                </div>
              )}
            </div>
          )}
        </form>

        <DialogFooter className="sm:justify-between">
          {current ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onSelect(null)
                onOpenChange(false)
              }}
            >
              <X aria-hidden="true" />
              Bỏ khách khỏi đơn
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
