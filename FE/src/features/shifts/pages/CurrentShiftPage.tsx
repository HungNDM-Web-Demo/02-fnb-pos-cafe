'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Banknote,
  Clock,
  Lock,
  PauseCircle,
  Printer,
  QrCode,
  Receipt,
  ShoppingCart,
  Wallet,
  XCircle,
} from 'lucide-react'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import { formatDateTime, formatVnd } from '@/lib/format'
import { CloseShiftDialog } from '../components/CloseShiftDialog'
import { OpenShiftDialog } from '../components/OpenShiftDialog'
import { useCurrentShift, useCurrentShiftSummary } from '../hooks/use-shifts'
import type { ShiftDto } from '../types/shift.types'

/** SCR-06 Ca của tôi (UC-03 mở ca, UC-10 chốt ca). */
export function CurrentShiftPage() {
  const router = useRouter()
  const shift = useCurrentShift()
  const summary = useCurrentShiftSummary({ enabled: !!shift.data })
  const [openDialog, setOpenDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const [lastClosed, setLastClosed] = useState<ShiftDto | null>(null)

  const handleClosed = (closed: ShiftDto) => {
    setLastClosed(closed)
    router.push(`${routePath.shiftReceipt(closed.id)}?print=1`)
  }

  return (
    <PermissionGuard permission={permissions.shifts.operate} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Ca của tôi"
          icon={Wallet}
          description="Mở ca để bán hàng; cuối ca đếm tiền mặt và chốt ca để đối soát."
          actions={
            shift.data ? (
              <>
                <Button asChild variant="outline">
                  <Link href={routePath.pos}>
                    <ShoppingCart aria-hidden="true" />
                    Bán hàng
                  </Link>
                </Button>
                <Button variant="cta" onClick={() => setCloseDialog(true)} disabled={!summary.data}>
                  <Lock aria-hidden="true" />
                  Chốt ca
                </Button>
              </>
            ) : (
              shift.isSuccess && (
                <Button variant="cta" onClick={() => setOpenDialog(true)}>
                  <Wallet aria-hidden="true" />
                  Mở ca
                </Button>
              )
            )
          }
        />

        {shift.error ? (
          <Card>
            <ErrorState error={shift.error} onRetry={() => void shift.refetch()} />
          </Card>
        ) : shift.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !shift.data ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="bg-warning/12 text-warning flex size-14 items-center justify-center rounded-full">
                <Lock className="size-7" aria-hidden="true" />
              </span>
              <p className="text-lg font-semibold">Chưa mở ca</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                {lastClosed ? `Ca ${lastClosed.code} đã chốt. ` : ''}Mở ca mới và nhập tiền đầu ca
                để bắt đầu bán hàng.
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="cta" size="lg" onClick={() => setOpenDialog(true)}>
                  <Wallet aria-hidden="true" />
                  Mở ca
                </Button>
                {lastClosed && (
                  <Button asChild variant="outline" size="lg">
                    <Link href={routePath.shiftReceipt(lastClosed.id)}>
                      <Printer aria-hidden="true" />
                      Phiếu chốt ca
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    Ca {shift.data.code}
                    <StatusBadge tone="success">Đang mở</StatusBadge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden="true" />
                    Mở lúc {formatDateTime(shift.data.openedAt)} · {shift.data.cashierName}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Tiền đầu ca</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatVnd(shift.data.openingCash)}
                  </p>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Hóa đơn đã bán"
                value={summary.data?.orderCount ?? 0}
                icon={Receipt}
                isLoading={summary.isLoading}
              />
              <KpiCard
                label="Tiền mặt thu"
                value={formatVnd(summary.data?.cashSales ?? 0)}
                icon={Banknote}
                isLoading={summary.isLoading}
              />
              <KpiCard
                label="Chuyển khoản"
                value={formatVnd(summary.data?.transferSales ?? 0)}
                icon={QrCode}
                isLoading={summary.isLoading}
              />
              <KpiCard
                label="Tiền mặt lý thuyết"
                value={formatVnd(summary.data?.expectedCash ?? 0)}
                icon={Wallet}
                isLoading={summary.isLoading}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tổng hợp tạm thời</CardTitle>
                  <CardDescription>
                    Tính từ hóa đơn đã thanh toán trong ca; hóa đơn hủy không tính.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y text-sm">
                    <Row label="Doanh thu" value={formatVnd(summary.data?.revenue)} />
                    <Row
                      label="Hóa đơn hủy"
                      value={String(summary.data?.cancelledOrderCount ?? 0)}
                      icon={XCircle}
                    />
                    <Row
                      label="Tiền mặt hóa đơn hủy"
                      value={formatVnd(summary.data?.cashCancelled)}
                    />
                    <Row
                      label="Tiền đầu ca + tiền mặt thu"
                      value={formatVnd(summary.data?.expectedCash)}
                    />
                  </dl>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PauseCircle className="text-primary size-4" aria-hidden="true" />
                    Đơn giữ ({summary.data?.heldOrders.length ?? 0})
                  </CardTitle>
                  <CardDescription>
                    Phải thanh toán hoặc xóa hết đơn giữ trước khi chốt ca.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!summary.data?.heldOrders.length ? (
                    <p className="text-muted-foreground text-sm">Không còn đơn giữ.</p>
                  ) : (
                    <ul className="divide-y text-sm">
                      {summary.data.heldOrders.map((h) => (
                        <li key={h.id} className="flex items-center justify-between py-2">
                          <span>{h.holdName}</span>
                          <span className="font-medium tabular-nums">{formatVnd(h.total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <OpenShiftDialog open={openDialog} onOpenChange={setOpenDialog} />
      {summary.data && (
        <CloseShiftDialog
          open={closeDialog}
          onOpenChange={setCloseDialog}
          summary={summary.data}
          onClosed={handleClosed}
        />
      )}
    </PermissionGuard>
  )
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
