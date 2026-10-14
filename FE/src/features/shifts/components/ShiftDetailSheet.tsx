'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { paymentMethodLabels } from '@/features/orders/types/order.types'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDateTime, formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useReviewShift, useShift } from '../hooks/use-shifts'
import { DifferenceText } from './DifferenceText'
import { ShiftStatusBadge } from './ShiftStatusBadge'

type ShiftDetailSheetProps = {
  shiftId: string | null
  onOpenChange: (open: boolean) => void
  onOrderClick?: (orderId: string) => void
}

/** UC-11: chi tiết ca kèm hóa đơn; ca "Cần kiểm tra" có ô ghi chú xử lý và nút "Đã kiểm tra" (TC-11). */
export function ShiftDetailSheet({ shiftId, onOpenChange, onOrderClick }: ShiftDetailSheetProps) {
  const { can } = usePermissions()
  const shift = useShift(shiftId)
  const review = useReviewShift()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [forId, setForId] = useState(shiftId)
  if (shiftId !== forId) {
    setForId(shiftId)
    setNote('')
    setError(null)
  }

  const data = shift.data
  const canReview = can(permissions.shifts.review) && data?.status === 'CanKiemTra'

  const submitReview = () => {
    if (!data) return
    if (!note.trim()) return setError('Nhập ghi chú xử lý')
    setError(null)
    review.mutate(
      { id: data.id, input: { note: note.trim() } },
      {
        onSuccess: () => toast.success(`Ca ${data.code} đã kiểm tra`),
        onError: (err) => {
          setError(getFieldErrors(err).note ?? null)
          toast.error(getErrorMessage(err))
        },
      }
    )
  }

  return (
    <Sheet open={!!shiftId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            Ca {data?.code ?? '…'}
            {data && <ShiftStatusBadge status={data.status} />}
          </SheetTitle>
          <SheetDescription>
            {data
              ? `${data.cashierName} · ${formatDateTime(data.openedAt)} → ${data.closedAt ? formatTime(data.closedAt) : 'đang mở'}`
              : 'Đang tải…'}
          </SheetDescription>
        </SheetHeader>

        {shift.error ? (
          <ErrorState error={shift.error} onRetry={() => void shift.refetch()} />
        ) : !data ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <section className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Stat label="Hóa đơn" value={String(data.orderCount)} />
              <Stat label="Hóa đơn hủy" value={String(data.cancelledOrderCount)} />
              <Stat label="Doanh thu" value={formatVnd(data.revenue)} />
              <Stat label="Tiền mặt" value={formatVnd(data.cashSales)} />
              <Stat label="Chuyển khoản" value={formatVnd(data.transferSales)} />
              <Stat label="Tiền đầu ca" value={formatVnd(data.openingCash)} />
              <Stat label="Tiền mặt lý thuyết" value={formatVnd(data.expectedCash)} />
              <Stat label="Thực đếm" value={formatVnd(data.countedCash)} />
              <div>
                <p className="text-muted-foreground text-xs">Chênh lệch</p>
                <DifferenceText value={data.difference} strong className="text-base" />
              </div>
            </section>

            {data.note && (
              <p className="bg-muted/60 rounded-lg px-3 py-2 text-sm">
                <span className="text-muted-foreground">Ghi chú thu ngân: </span>
                {data.note}
              </p>
            )}

            {data.status === 'DaKiemTra' && (
              <div className="bg-info/10 border-info/25 rounded-lg border px-3 py-2.5 text-sm">
                <p className="text-info flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Đã kiểm tra bởi {data.reviewedByName} lúc {formatDateTime(data.reviewedAt)}
                </p>
                <p className="mt-1">{data.reviewNote}</p>
              </div>
            )}

            {canReview && (
              <section className="border-destructive/30 bg-destructive/5 space-y-3 rounded-lg border p-4">
                <p className="text-destructive text-sm font-semibold">
                  Ca lệch quá 50.000 ₫, cần quản lý xử lý
                </p>
                <FormField label="Ghi chú xử lý" required error={error ?? undefined}>
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    placeholder="vd: Đã đối chiếu camera, thu ngân thối nhầm; đã nhắc nhở"
                  />
                </FormField>
                <Button onClick={submitReview} disabled={review.isPending}>
                  {review.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" />
                  )}
                  Đã kiểm tra
                </Button>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Hóa đơn trong ca ({data.orders.length})</h3>
                {data.status !== 'DangMo' && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={routePath.shiftReceipt(data.id)}>
                      <Printer aria-hidden="true" />
                      Phiếu chốt ca
                    </Link>
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Mã</TableHead>
                      <TableHead>Giờ</TableHead>
                      <TableHead>PT</TableHead>
                      <TableHead className="text-right">Tổng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.map((o) => (
                      <TableRow
                        key={o.id}
                        onClick={onOrderClick ? () => onOrderClick(o.id) : undefined}
                        className={cn(
                          onOrderClick && 'cursor-pointer',
                          o.status === 'DaHuy' && 'text-muted-foreground'
                        )}
                      >
                        <TableCell className="font-medium">{o.code}</TableCell>
                        <TableCell>{formatTime(o.paidAt)}</TableCell>
                        <TableCell>{paymentMethodLabels[o.paymentMethod]}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatVnd(o.total)}
                        </TableCell>
                        <TableCell>
                          {o.status === 'DaHuy' ? (
                            <StatusBadge tone="danger">Đã hủy</StatusBadge>
                          ) : (
                            <StatusBadge tone="success">Đã thanh toán</StatusBadge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.orders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                          Chưa có hóa đơn
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  )
}
