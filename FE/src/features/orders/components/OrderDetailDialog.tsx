'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Ban, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDateTime, formatVnd } from '@/lib/format'
import { useCancelOrder, useOrder } from '../hooks/use-orders'
import { iceLevelLabels, paymentMethodLabels, serviceTypeLabels } from '../types/order.types'
import { OrderStatusBadge } from './OrderStatusBadge'

type OrderDetailDialogProps = {
  orderId: string | null
  onOpenChange: (open: boolean) => void
}

/** UC-09 chi tiết, in lại; UC-08 hủy hóa đơn có lý do (quản lý, BR-13). */
export function OrderDetailDialog({ orderId, onOpenChange }: OrderDetailDialogProps) {
  const { can } = usePermissions()
  const order = useOrder(orderId)
  const cancel = useCancelOrder()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [forId, setForId] = useState(orderId)
  if (orderId !== forId) {
    setForId(orderId)
    setCancelling(false)
    setReason('')
    setError(null)
  }

  const data = order.data

  const submitCancel = () => {
    if (!data) return
    if (!reason.trim()) return setError('Nhập lý do hủy')
    setError(null)
    cancel.mutate(
      { id: data.id, input: { reason: reason.trim() } },
      {
        onSuccess: () => {
          toast.success(`Đã hủy hóa đơn ${data.code}`)
          setCancelling(false)
        },
        onError: (err) => {
          const field = getFieldErrors(err).reason
          if (field) setError(field)
          else toast.error(getErrorMessage(err))
        },
      }
    )
  }

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !cancel.isPending && onOpenChange(open)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            Hóa đơn {data?.code ?? '…'}
            {data && <OrderStatusBadge status={data.status} />}
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${formatDateTime(data.paidAt)} · ${data.cashierName} · ca ${data.shiftCode} · ${serviceTypeLabels[data.serviceType]}${data.tableTag ? ` bàn ${data.tableTag}` : ''}`
              : 'Đang tải…'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto px-6 py-4">
          {order.error ? (
            <ErrorState error={order.error} onRetry={() => void order.refetch()} />
          ) : !data ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <ul className="divide-y rounded-lg border">
                {data.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {item.quantity}× {item.itemName}{' '}
                        <span className="text-muted-foreground">({item.sizeName})</span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {[
                          ...item.toppings.map((t) => `${t.name} +${formatVnd(t.price)}`),
                          item.sugarLevel !== undefined ? `${item.sugarLevel}% đường` : null,
                          item.iceLevel ? iceLevelLabels[item.iceLevel] : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {item.note && <p className="text-info text-xs italic">“{item.note}”</p>}
                      {item.discount && (
                        <p className="text-warning text-xs">
                          Giảm dòng −{formatVnd(item.discount.amount)} ({item.discount.reason})
                        </p>
                      )}
                      {item.promotion && (
                        <p className="text-success text-xs">
                          {item.promotion.name} −{formatVnd(item.promotion.amount)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatVnd(item.lineNet)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="grid gap-1">
                <Row label="Tổng tiền hàng" value={formatVnd(data.subtotal)} />
                {data.lineDiscountTotal > 0 && (
                  <Row label="Giảm giá dòng" value={`−${formatVnd(data.lineDiscountTotal)}`} />
                )}
                {data.itemPromotionDiscount > 0 && (
                  <Row label="Khuyến mãi món" value={`−${formatVnd(data.itemPromotionDiscount)}`} />
                )}
                {data.orderDiscount && (
                  <Row
                    label={`Giảm giá hóa đơn (${data.orderDiscount.reason}${data.orderDiscount.approvedByName ? `, duyệt: ${data.orderDiscount.approvedByName}` : ''})`}
                    value={`−${formatVnd(data.orderDiscount.amount)}`}
                  />
                )}
                {data.voucher && (
                  <Row
                    label={`Voucher ${data.voucher.code}`}
                    value={`−${formatVnd(data.voucher.amount)}`}
                  />
                )}
                {data.promotion && (
                  <Row label={data.promotion.name} value={`−${formatVnd(data.promotion.amount)}`} />
                )}
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <dt>Tổng thanh toán</dt>
                  <dd className="tabular-nums">{formatVnd(data.total)}</dd>
                </div>
                {data.payment && (
                  <>
                    <Row label="Phương thức" value={paymentMethodLabels[data.payment.method]} />
                    {data.payment.method === 'TienMat' && (
                      <>
                        <Row label="Tiền khách đưa" value={formatVnd(data.payment.cashReceived)} />
                        <Row label="Tiền thối" value={formatVnd(data.payment.changeAmount)} />
                      </>
                    )}
                  </>
                )}
                {data.customer && (
                  <Row
                    label="Khách hàng"
                    value={`${data.customer.name} · ${data.customer.phone} · +${data.pointsEarned} điểm`}
                  />
                )}
              </dl>

              {data.status === 'DaHuy' && (
                <p className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border px-3 py-2">
                  Đã hủy lúc {formatDateTime(data.cancelledAt)} bởi {data.cancelledByName}. Lý do:{' '}
                  {data.cancelReason}
                </p>
              )}

              {cancelling && (
                <div className="border-destructive/30 bg-destructive/5 space-y-3 rounded-lg border p-3">
                  <p className="text-sm">
                    Hủy hóa đơn sẽ trừ khỏi doanh thu và tiền mặt lý thuyết của ca, trả lượt
                    voucher, trừ điểm khách.
                  </p>
                  <FormField label="Lý do hủy" required error={error ?? undefined}>
                    <Textarea
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={200}
                      placeholder="vd: Nhập nhầm"
                      autoFocus
                    />
                  </FormField>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCancelling(false)}
                      disabled={cancel.isPending}
                    >
                      Không hủy
                    </Button>
                    <Button variant="danger" onClick={submitCancel} disabled={cancel.isPending}>
                      {cancel.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                      Xác nhận hủy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="bg-muted/30 border-t px-6 py-3 sm:justify-between">
          {data &&
          data.status === 'DaThanhToan' &&
          can(permissions.orders.cancel) &&
          !cancelling ? (
            <Button variant="destructive" onClick={() => setCancelling(true)}>
              <Ban aria-hidden="true" />
              Hủy hóa đơn
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            {data && can(permissions.orders.reprint) && (
              <Button asChild>
                <Link href={`${routePath.posReceipt(data.id)}?reprint=1`}>
                  <Printer aria-hidden="true" />
                  In lại
                </Link>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}
