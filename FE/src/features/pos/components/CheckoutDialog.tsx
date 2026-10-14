'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Banknote, CheckCircle2, Loader2, QrCode, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCheckout, useNextOrderCode } from '@/features/orders/hooks/use-orders'
import type { OrderDto, PaymentMethod } from '@/features/orders/types/order.types'
import { getErrorMessage, isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStoreProfile } from '../hooks/use-store-profile'
import { QUICK_CASH } from '../lib/pricing'
import { buildVietQr } from '../lib/vietqr'
import { toCartInput, useCartStore } from '../stores/cart.store'
import type { CartPricing } from '../hooks/use-cart-pricing'
import { MoneyInput } from './MoneyInput'
import { QrImage } from './QrImage'

type CheckoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pricing: CartPricing
  onSuccess: (order: OrderDto) => void
}

/**
 * SCR-04 Hộp thanh toán (UC-07): tiền mặt với nút mệnh giá nhanh và tiền thối (BR-08, TC-21, TC-22),
 * chuyển khoản hiện QR VietQR có số tiền và nội dung là mã hóa đơn dự kiến (TC-23). Nút Hoàn tất khóa
 * khi đang gửi; clientRequestId giữ nguyên khi bấm lại để không tạo trùng (TC-24, NFR-05).
 */
export function CheckoutDialog({ open, onOpenChange, pricing, onSuccess }: CheckoutDialogProps) {
  const checkout = useCheckout()
  const queryClient = useQueryClient()
  const store = useStoreProfile()
  const [method, setMethod] = useState<PaymentMethod>('TienMat')
  const [cash, setCash] = useState<number | null>(null)
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null)
  const nextCode = useNextOrderCode(open && method === 'ChuyenKhoan')

  const total = pricing.total

  // Sinh clientRequestId khi mở hộp (store ngoài React nên để trong effect, TC-24)
  useEffect(() => {
    if (open) useCartStore.getState().ensureClientRequestId()
  }, [open])

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMethod('TienMat')
      setCash(pricing.total) // mặc định "đủ tiền" để một đơn 3 món đủ 12 lần chạm (NFR-03)
      setError(null)
    }
  }

  const cashReceived = cash ?? 0
  const missing = total - cashReceived
  const change = cashReceived - total

  const qrContent = useMemo(() => {
    if (method !== 'ChuyenKhoan' || !store.data || !nextCode.data) return null
    return buildVietQr({
      bankBin: store.data.bankBin,
      bankAccount: store.data.bankAccount,
      amount: total,
      content: nextCode.data.code,
    })
  }, [method, store.data, nextCode.data, total])

  const canComplete = method === 'ChuyenKhoan' ? !!qrContent : missing <= 0
  const pending = checkout.isPending

  const complete = () => {
    if (pending || !canComplete) return
    setError(null)
    const state = useCartStore.getState()
    const clientRequestId = state.ensureClientRequestId()
    checkout.mutate(
      {
        ...toCartInput(state),
        clientRequestId,
        heldOrderId: state.heldOrderId ?? undefined,
        payment:
          method === 'TienMat'
            ? { method, cashReceived }
            : { method, qrContent: qrContent ?? undefined },
        discountApprovalToken: pricing.needsApproval ? state.approval?.token : undefined,
        expectedTotal: total,
      },
      {
        onSuccess: (order) => {
          onOpenChange(false)
          onSuccess(order)
        },
        onError: (err) => {
          if (isApiError(err) && err.status === 0) {
            setError({
              message: 'Chưa lưu được hóa đơn, thử lại. Giỏ hàng vẫn được giữ nguyên.',
              retry: true,
            })
            return
          }
          if (isApiError(err) && err.status === 409) {
            // Tổng máy chủ khác tổng tại máy: tải lại thực đơn, khuyến mãi để giỏ tính lại rồi cho bấm lại
            void queryClient.invalidateQueries({ queryKey: ['menu'] })
            void queryClient.invalidateQueries({ queryKey: ['promotions', 'active'] })
            const serverTotal = err.problem.serverTotal
            setError({
              message: `${getErrorMessage(err)}${typeof serverTotal === 'number' ? ` Tổng mới: ${formatVnd(serverTotal)}.` : ''}`,
              retry: false,
            })
            return
          }
          setError({ message: getErrorMessage(err), retry: false })
          toast.error(getErrorMessage(err))
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Thanh toán</DialogTitle>
          <DialogDescription>
            {pricing.lines.reduce((s, l) => s + l.quantity, 0)} món · tổng tiền hàng{' '}
            {formatVnd(pricing.subtotal)}
            {pricing.discountTotal > 0 ? ` · giảm ${formatVnd(pricing.discountTotal)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 sm:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="bg-muted/40 flex flex-col gap-4 border-b p-5 sm:border-r sm:border-b-0">
            <div>
              <p className="text-muted-foreground text-sm">Cần thu</p>
              <p className="text-primary text-3xl font-bold tracking-tight tabular-nums">
                {formatVnd(total)}
              </p>
            </div>
            <div className="grid gap-2" role="radiogroup" aria-label="Phương thức thanh toán">
              <MethodButton
                active={method === 'TienMat'}
                onClick={() => setMethod('TienMat')}
                icon={Banknote}
                label="Tiền mặt"
              />
              <MethodButton
                active={method === 'ChuyenKhoan'}
                onClick={() => setMethod('ChuyenKhoan')}
                icon={QrCode}
                label="Chuyển khoản"
              />
            </div>
          </aside>

          <div className="min-h-[18rem] p-5">
            {method === 'TienMat' ? (
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Tiền khách đưa</span>
                  <MoneyInput
                    value={cash}
                    onChange={setCash}
                    className="h-14 text-2xl font-semibold"
                    aria-label="Tiền khách đưa"
                  />
                </label>
                <div className="grid grid-cols-5 gap-2" role="group" aria-label="Mệnh giá nhanh">
                  <QuickCash
                    active={cash === total}
                    onClick={() => setCash(total)}
                    label="Đủ tiền"
                  />
                  {QUICK_CASH.map((amount) => (
                    <QuickCash
                      key={amount}
                      active={cash === amount}
                      disabled={amount < total}
                      onClick={() => setCash(amount)}
                      label={`${amount / 1000}.000`}
                    />
                  ))}
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-4 py-3',
                    missing > 0
                      ? 'border-destructive/30 bg-destructive/8 text-destructive'
                      : 'border-success/30 bg-success/10 text-success'
                  )}
                  role="status"
                  aria-live="polite"
                >
                  <span className="font-medium">{missing > 0 ? 'Còn thiếu' : 'Tiền thối'}</span>
                  <span className="text-2xl font-bold tabular-nums">
                    {formatVnd(missing > 0 ? missing : change)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex justify-center">
                  {qrContent ? (
                    <QrImage value={qrContent} size={200} />
                  ) : (
                    <div className="bg-muted size-[200px] animate-pulse rounded-md" />
                  )}
                </div>
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Số tiền</dt>
                    <dd className="text-xl font-bold tabular-nums">{formatVnd(total)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Nội dung chuyển khoản</dt>
                    <dd className="font-mono text-lg font-semibold">
                      {nextCode.data?.code ?? '…'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tài khoản nhận</dt>
                    <dd className="font-medium">
                      {store.data?.bankAccountName ?? '—'} · {store.data?.bankAccount ?? '—'}
                      <span className="text-muted-foreground">
                        {' '}
                        (BIN {store.data?.bankBin ?? '—'})
                      </span>
                    </dd>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Khách quét mã bằng app ngân hàng; thu ngân xác nhận khi thấy tiền về.
                  </p>
                </dl>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/8 text-destructive mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
              >
                {error.retry ? (
                  <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                )}
                <span>{error.message}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="bg-muted/30 flex-row justify-end gap-2 border-t px-6 py-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Quay lại
          </Button>
          <Button
            variant="cta"
            size="lg"
            onClick={complete}
            disabled={!canComplete || pending}
            aria-busy={pending}
            className="min-w-44"
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
            {pending ? 'Đang lưu…' : method === 'ChuyenKhoan' ? 'Đã nhận tiền' : 'Hoàn tất'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MethodButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex h-14 items-center gap-3 rounded-xl border px-4 text-left font-semibold transition-colors outline-none',
        'focus-visible:ring-ring/50 focus-visible:ring-3',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </button>
  )
}

function QuickCash({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-12 rounded-lg border text-sm font-semibold tabular-nums transition-colors outline-none',
        'focus-visible:ring-ring/50 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-muted'
      )}
    >
      {label}
    </button>
  )
}
