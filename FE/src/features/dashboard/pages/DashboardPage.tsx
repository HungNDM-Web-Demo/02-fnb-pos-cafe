'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ArrowRight,
  ChartNoAxesColumn,
  Clock,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { useDashboardReport } from '@/features/reports/hooks/use-reports'
import { usePermissions } from '@/hooks/use-permissions'
import { formatNumber, formatTime, formatVnd } from '@/lib/format'
import { KpiCard } from '../components/KpiCard'

const hourlyConfig = {
  revenue: { label: 'Doanh thu', color: 'var(--chart-1)' },
} satisfies ChartConfig
const compactVnd = (v: number) =>
  v >= 1_000_000
    ? `${formatNumber(v / 1_000_000, 1)}tr`
    : v >= 1000
      ? `${formatNumber(v / 1000, 0)}k`
      : String(v)
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** SCR-01 Tổng quan (UC-12, FR-01, FR-02): doanh thu hôm nay, so với cùng giờ hôm qua, theo giờ, top 5 món. */
export function DashboardPage() {
  const { can } = usePermissions()
  const canReports = can(permissions.reports.view)
  const report = useDashboardReport({ enabled: canReports })
  const data = report.data
  const now = new Date()

  return (
    <PermissionGuard permission={permissions.dashboard.view} redirect>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-muted-foreground text-sm">
              {capitalize(format(now, "EEEE, 'ngày' dd/MM/yyyy", { locale: vi }))}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Tổng quan hôm nay</h1>
            {data && (
              <p className="text-muted-foreground text-sm">
                Cập nhật lúc {formatTime(data.asOf)}, tự làm mới mỗi phút.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {can(permissions.orders.create) && (
              <Button asChild variant="cta">
                <Link href={routePath.pos}>
                  <ShoppingCart aria-hidden="true" /> Bán hàng
                </Link>
              </Button>
            )}
            {canReports && (
              <Button asChild variant="outline">
                <Link href={routePath.reports}>
                  <ChartNoAxesColumn aria-hidden="true" /> Báo cáo
                </Link>
              </Button>
            )}
          </div>
        </div>

        {!canReports ? (
          <Card>
            <EmptyState
              title="Bạn chưa có quyền xem doanh thu"
              description="Liên hệ quản trị viên để được cấp quyền Xem báo cáo."
            />
          </Card>
        ) : report.error ? (
          <Card>
            <ErrorState error={report.error} onRetry={() => void report.refetch()} />
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Doanh thu thuần"
                value={formatVnd(data?.revenue ?? 0)}
                icon={Wallet}
                isLoading={!data}
                change={data?.revenueChangePercent ?? undefined}
                changeLabel="so với cùng giờ hôm qua"
              />
              <KpiCard
                label="Số hóa đơn"
                value={formatNumber(data?.orderCount ?? 0)}
                icon={Receipt}
                isLoading={!data}
              />
              <KpiCard
                label="Giá trị trung bình"
                value={formatVnd(data?.avgOrderValue ?? 0)}
                icon={TrendingUp}
                isLoading={!data}
              />
              <KpiCard
                label="Hôm qua tới giờ này"
                value={formatVnd(data?.yesterdaySameTime.revenue ?? 0)}
                icon={Clock}
                isLoading={!data}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Doanh thu theo giờ</CardTitle>
                  <CardDescription>
                    Hóa đơn đã thanh toán hôm nay, không tính hóa đơn hủy.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!data ? (
                    <Skeleton className="h-72" />
                  ) : data.orderCount === 0 ? (
                    <EmptyState
                      title="Hôm nay chưa có hóa đơn"
                      description="Biểu đồ sẽ hiện khi thu ngân bán đơn đầu tiên."
                    />
                  ) : (
                    <ChartContainer
                      config={hourlyConfig}
                      className="aspect-auto h-72 w-full"
                      aria-label="Biểu đồ doanh thu theo giờ"
                    >
                      <BarChart data={data.hourly.filter((h) => h.hour >= 6 && h.hour <= 22)}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tickFormatter={(h) => `${h}h`}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={compactVnd}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(_, payload) =>
                                `${payload?.[0]?.payload?.hour}h – ${payload?.[0]?.payload?.orderCount} hóa đơn`
                              }
                              formatter={(value) => (
                                <span className="font-medium tabular-nums">
                                  {formatVnd(Number(value))}
                                </span>
                              )}
                            />
                          }
                        />
                        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top 5 món hôm nay</CardTitle>
                  <CardDescription>Theo số lượng bán.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!data ? (
                    <Skeleton className="h-60" />
                  ) : data.topItems.length === 0 ? (
                    <EmptyState compact title="Chưa có món nào được bán" />
                  ) : (
                    <ol className="space-y-1">
                      {data.topItems.map((item, index) => (
                        <li key={item.menuItemId}>
                          <Link
                            href={`${routePath.reports}?tab=top-items`}
                            className="hover:bg-muted/60 focus-visible:ring-ring/50 flex min-h-12 items-center gap-3 rounded-lg px-2 outline-none focus-visible:ring-3"
                          >
                            <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {item.name}
                              </span>
                              <span className="text-muted-foreground text-xs tabular-nums">
                                {formatVnd(item.revenue)}
                              </span>
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {item.quantity} ly
                            </span>
                            <ArrowRight
                              className="text-muted-foreground size-4"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Ca đang mở</CardTitle>
                  <CardDescription>Thu ngân đang bán hàng lúc này.</CardDescription>
                </div>
                {can(permissions.shifts.view) && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={routePath.shifts}>Danh sách ca</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!data ? (
                  <Skeleton className="h-12" />
                ) : data.openShifts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Chưa có ca nào đang mở.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {data.openShifts.map((s) => (
                      <li
                        key={s.id}
                        className="bg-success/10 text-success inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
                      >
                        <span className="bg-success size-2 rounded-full" aria-hidden="true" />
                        {s.code} · {s.cashierName} · từ {formatTime(s.openedAt)}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PermissionGuard>
  )
}
