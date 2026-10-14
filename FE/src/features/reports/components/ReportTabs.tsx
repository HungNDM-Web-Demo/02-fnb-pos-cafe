'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Ban, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/shared/DataTablePagination'
import { useCategories } from '@/features/menu-items/hooks/use-menu'
import { paymentMethodLabels } from '@/features/orders/types/order.types'
import { DifferenceText } from '@/features/shifts/components/DifferenceText'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  useCancelledOrdersReport,
  useCashierReport,
  useHeatmapReport,
  usePaymentMethodReport,
  useRevenueReport,
  useTopItemsReport,
} from '../hooks/use-reports'
import { exportExcel, type ExcelColumn } from '../lib/export-excel'
import type { DateRangeQuery } from '../types/report.types'

type TabProps = { range: DateRangeQuery; enabled: boolean }

const compactVnd = (v: number) =>
  v >= 1_000_000
    ? `${formatNumber(v / 1_000_000, 1)}tr`
    : v >= 1000
      ? `${formatNumber(v / 1000, 0)}k`
      : String(v)
const shortDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`

function ExportButton<T>({
  fileName,
  title,
  columns,
  rows,
}: {
  fileName: string
  title: string
  columns: ExcelColumn<T>[]
  rows: T[] | undefined
}) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="outline"
      disabled={!rows?.length || pending}
      onClick={async () => {
        if (!rows) return
        setPending(true)
        try {
          await exportExcel(fileName, title, columns, rows)
          toast.success('Đã xuất file Excel')
        } catch (error) {
          toast.error(getErrorMessage(error, 'Không xuất được file Excel'))
        } finally {
          setPending(false)
        }
      }}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <FileSpreadsheet aria-hidden="true" />
      )}
      Xuất Excel
    </Button>
  )
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-xs">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
    </div>
  )
}

function Change({ value }: { value?: number }) {
  if (value === undefined || value === null) return <span>Kỳ trước chưa có doanh thu</span>
  const up = value >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-semibold',
        up ? 'text-success' : 'text-destructive'
      )}
    >
      {up ? (
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      ) : (
        <ArrowDownRight className="size-3.5" aria-hidden="true" />
      )}
      {up ? '+' : ''}
      {formatNumber(value, 1)}% so với kỳ trước
    </span>
  )
}

// ───────────────────────── Doanh thu (FR-28, TC-28) ─────────────────────────

const revenueConfig = {
  revenue: { label: 'Kỳ này', color: 'var(--chart-1)' },
  previousRevenue: { label: 'Kỳ trước', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

export function RevenueTab({ range, enabled }: TabProps) {
  const report = useRevenueReport(range, { enabled })
  const data = report.data
  if (report.error) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <Loading />
  const sumDaily = data.daily.reduce((s, d) => s + d.revenue, 0)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Doanh thu thuần"
          value={formatVnd(data.totals.revenue)}
          sub={<Change value={data.revenueChangePercent} />}
        />
        <Stat
          label="Số hóa đơn"
          value={formatNumber(data.totals.orderCount)}
          sub={`Kỳ trước ${formatNumber(data.previous.orderCount)}`}
        />
        <Stat label="Giá trị trung bình" value={formatVnd(data.totals.avgOrderValue)} />
        <Stat
          label="Tổng giảm giá"
          value={formatVnd(data.totals.discount)}
          sub={`Kỳ trước ${formatVnd(data.previous.discount)}`}
        />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Doanh thu theo ngày</CardTitle>
            <CardDescription>
              {data.daily.length} ngày; đường mờ là kỳ trước cùng độ dài (
              {formatDate(`${data.previous.from}T00:00:00`)} →{' '}
              {formatDate(`${data.previous.to}T00:00:00`)})
            </CardDescription>
          </div>
          <ExportButton
            fileName={`doanh-thu-${data.from}-${data.to}`}
            title={`Doanh thu theo ngày ${data.from} → ${data.to}`}
            rows={data.daily}
            columns={[
              { header: 'Ngày', value: (d) => d.date, width: 12 },
              { header: 'Doanh thu', value: (d) => d.revenue },
              { header: 'Số hóa đơn', value: (d) => d.orderCount, width: 12 },
              { header: 'Giảm giá', value: (d) => d.discount },
              { header: 'Kỳ trước', value: (d) => d.previousRevenue },
            ]}
          />
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={revenueConfig}
            className="aspect-auto h-80 w-full"
            aria-label="Biểu đồ doanh thu theo ngày"
          >
            <ComposedChart data={data.daily} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDay}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis tickFormatter={compactVnd} tickLine={false} axisLine={false} width={48} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => formatDate(`${v}T00:00:00`)}
                    formatter={(value, name) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">
                          {revenueConfig[name as keyof typeof revenueConfig]?.label}
                        </span>
                        <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="revenue"
                type="monotone"
                fill="var(--color-revenue)"
                fillOpacity={0.12}
                stroke="var(--color-revenue)"
                strokeWidth={2}
                dot={data.daily.length <= 31}
              />
              <Line
                dataKey="previousRevenue"
                type="monotone"
                stroke="var(--color-previousRevenue)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Số hóa đơn</TableHead>
                <TableHead className="text-right">Giảm giá</TableHead>
                <TableHead className="text-right">Kỳ trước</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.daily].reverse().map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{formatDate(`${d.date}T00:00:00`)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatVnd(d.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.orderCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(d.discount)}</TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {formatVnd(d.previousRevenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot className="bg-muted/50 sticky bottom-0 border-t">
              <TableRow>
                <TableCell className="font-semibold">Tổng</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatVnd(sumDaily)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {data.totals.orderCount}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatVnd(data.totals.discount)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatVnd(data.previous.revenue)}
                </TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </Card>
    </div>
  )
}

// ───────────────────────── Món bán chạy (FR-29) ─────────────────────────

const topConfig = { quantity: { label: 'Số lượng', color: 'var(--chart-1)' } } satisfies ChartConfig

export function TopItemsTab({ range, enabled }: TabProps) {
  const [categoryId, setCategoryId] = useState<string>('all')
  const categories = useCategories({ enabled })
  const report = useTopItemsReport(
    { ...range, categoryId: categoryId === 'all' ? undefined : categoryId, limit: 20 },
    { enabled }
  )
  const data = report.data
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Món bán chạy</CardTitle>
          <CardDescription>
            Doanh thu món tính sau giảm giá dòng và khuyến mãi món; tỉ trọng theo doanh thu.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-48" aria-label="Lọc danh mục">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi danh mục</SelectItem>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportButton
            fileName={`mon-ban-chay-${range.from}-${range.to}`}
            title={`Món bán chạy ${range.from} → ${range.to}`}
            rows={data?.items}
            columns={[
              { header: 'Mã', value: (i) => i.code, width: 8 },
              { header: 'Món', value: (i) => i.name, width: 28 },
              { header: 'Danh mục', value: (i) => i.categoryName, width: 18 },
              { header: 'Số lượng', value: (i) => i.quantity, width: 10 },
              { header: 'Doanh thu', value: (i) => i.revenue },
              { header: 'Tỉ trọng %', value: (i) => i.share, format: '0.0', width: 10 },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent>
        {report.error ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : !data ? (
          <Skeleton className="h-80" />
        ) : data.items.length === 0 ? (
          <EmptyState title="Không có dữ liệu" description="Khoảng ngày này chưa bán món nào." />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartContainer config={topConfig} className="aspect-auto h-[26rem] w-full">
              <BarChart
                data={data.items.slice(0, 10)}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} />
              </BarChart>
            </ChartContainer>
            <div className="max-h-[26rem] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Món</TableHead>
                    <TableHead className="text-right">SL</TableHead>
                    <TableHead className="text-right">Doanh thu</TableHead>
                    <TableHead className="text-right">Tỉ trọng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((i, index) => (
                    <TableRow key={i.menuItemId}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <p className="font-medium">{i.name}</p>
                        <p className="text-muted-foreground text-xs">{i.categoryName}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(i.quantity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatVnd(i.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(i.share, 1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ───────────────────────── Khung giờ (FR-30) ─────────────────────────

const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6)

export function HeatmapTab({ range, enabled }: TabProps) {
  const report = useHeatmapReport(range, { enabled })
  const data = report.data
  const grid = useMemo(() => {
    const map = new Map<string, { revenue: number; orderCount: number }>()
    for (const c of data?.cells ?? []) map.set(`${c.dayOfWeek}-${c.hour}`, c)
    return map
  }, [data])
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Doanh thu theo giờ và thứ</CardTitle>
          <CardDescription>
            Ô càng đậm doanh thu càng cao; rê chuột hoặc chạm để xem số.
          </CardDescription>
        </div>
        <ExportButton
          fileName={`khung-gio-${range.from}-${range.to}`}
          title={`Doanh thu theo giờ × thứ ${range.from} → ${range.to}`}
          rows={data?.cells}
          columns={[
            { header: 'Thứ', value: (c) => DAY_NAMES[c.dayOfWeek - 1], width: 12 },
            { header: 'Giờ', value: (c) => c.hour, width: 8 },
            { header: 'Doanh thu', value: (c) => c.revenue },
            { header: 'Số hóa đơn', value: (c) => c.orderCount, width: 12 },
          ]}
        />
      </CardHeader>
      <CardContent>
        {report.error ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : !data ? (
          <Skeleton className="h-72" />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[720px] border-separate border-spacing-1 text-xs"
              aria-label="Bảng nhiệt doanh thu"
            >
              <thead>
                <tr>
                  <th className="w-20" />
                  {HOURS.map((h) => (
                    <th key={h} className="text-muted-foreground font-medium">
                      {h}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_NAMES.map((name, i) => (
                  <tr key={name}>
                    <th className="text-muted-foreground pr-2 text-left font-medium whitespace-nowrap">
                      {name}
                    </th>
                    {HOURS.map((h) => {
                      const cell = grid.get(`${i + 1}-${h}`)
                      const ratio = data.maxRevenue ? (cell?.revenue ?? 0) / data.maxRevenue : 0
                      return (
                        <td
                          key={h}
                          title={`${name} ${h}h: ${formatVnd(cell?.revenue ?? 0)} · ${cell?.orderCount ?? 0} hóa đơn`}
                          className="h-9 rounded text-center tabular-nums"
                          style={{
                            backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(ratio * 90) + (ratio > 0 ? 6 : 0)}%, var(--muted))`,
                            color: ratio > 0.55 ? 'var(--primary-foreground)' : 'var(--foreground)',
                          }}
                        >
                          {cell && cell.revenue > 0 ? compactVnd(cell.revenue) : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ───────────────────────── Phương thức + Thu ngân (FR-31) ─────────────────────────

const methodConfig = {
  TienMat: { label: 'Tiền mặt', color: 'var(--chart-1)' },
  ChuyenKhoan: { label: 'Chuyển khoản', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function PaymentMethodsTab({ range, enabled }: TabProps) {
  const report = usePaymentMethodReport(range, { enabled })
  const data = report.data
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Theo phương thức thanh toán</CardTitle>
          <CardDescription>
            Số tiền, số hóa đơn và tỉ trọng của tiền mặt, chuyển khoản.
          </CardDescription>
        </div>
        <ExportButton
          fileName={`phuong-thuc-${range.from}-${range.to}`}
          title={`Theo phương thức thanh toán ${range.from} → ${range.to}`}
          rows={data?.items}
          columns={[
            { header: 'Phương thức', value: (i) => paymentMethodLabels[i.method], width: 16 },
            { header: 'Số tiền', value: (i) => i.amount },
            { header: 'Số hóa đơn', value: (i) => i.orderCount, width: 12 },
            { header: 'Tỉ trọng %', value: (i) => i.share, format: '0.0', width: 10 },
          ]}
        />
      </CardHeader>
      <CardContent>
        {report.error ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : !data ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid items-center gap-6 md:grid-cols-2">
            <ChartContainer config={methodConfig} className="mx-auto aspect-square h-64">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="method" hideLabel />} />
                <Pie
                  data={data.items}
                  dataKey="amount"
                  nameKey="method"
                  innerRadius={60}
                  strokeWidth={2}
                >
                  {data.items.map((i) => (
                    <Cell key={i.method} fill={`var(--color-${i.method})`} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="method" />} />
              </PieChart>
            </ChartContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phương thức</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead className="text-right">Hóa đơn</TableHead>
                  <TableHead className="text-right">Tỉ trọng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((i) => (
                  <TableRow key={i.method}>
                    <TableCell className="font-medium">{paymentMethodLabels[i.method]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatVnd(i.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(i.orderCount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(i.share, 1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CashiersTab({ range, enabled }: TabProps) {
  const report = useCashierReport(range, { enabled })
  const data = report.data
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Theo thu ngân</CardTitle>
          <CardDescription>
            Số ca, hóa đơn, doanh thu và tổng chênh lệch tiền mặt của từng thu ngân.
          </CardDescription>
        </div>
        <ExportButton
          fileName={`thu-ngan-${range.from}-${range.to}`}
          title={`Theo thu ngân ${range.from} → ${range.to}`}
          rows={data?.items}
          columns={[
            { header: 'Thu ngân', value: (i) => i.cashierName, width: 24 },
            { header: 'Số ca', value: (i) => i.shiftCount, width: 8 },
            { header: 'Số hóa đơn', value: (i) => i.orderCount, width: 12 },
            { header: 'Doanh thu', value: (i) => i.revenue },
            { header: 'Tổng chênh lệch', value: (i) => i.totalDifference },
            { header: 'Ca cần kiểm tra', value: (i) => i.shiftsNeedingReview, width: 14 },
          ]}
        />
      </CardHeader>
      <CardContent>
        {report.error ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : !data ? (
          <Skeleton className="h-40" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thu ngân</TableHead>
                <TableHead className="text-right">Số ca</TableHead>
                <TableHead className="text-right">Hóa đơn</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Tổng chênh lệch</TableHead>
                <TableHead className="text-right">Ca cần kiểm tra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((i) => (
                <TableRow key={i.cashierId}>
                  <TableCell className="font-medium">{i.cashierName}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.shiftCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(i.orderCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(i.revenue)}</TableCell>
                  <TableCell className="text-right">
                    <DifferenceText value={i.totalDifference} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      i.shiftsNeedingReview > 0 && 'text-destructive font-semibold'
                    )}
                  >
                    {i.shiftsNeedingReview}
                  </TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ───────────────────────── Hóa đơn hủy (SRS §6, TC-29) ─────────────────────────

export function CancelledOrdersTab({ range, enabled }: TabProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const report = useCancelledOrdersReport({ ...range, page, pageSize }, { enabled })
  const all = useCancelledOrdersReport({ ...range, page: 1, pageSize: 100 }, { enabled })
  const data = report.data
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ban className="text-destructive size-4" aria-hidden="true" />
            Hóa đơn hủy
          </CardTitle>
          <CardDescription>Không tính vào doanh thu; có người hủy và lý do.</CardDescription>
        </div>
        <ExportButton
          fileName={`hoa-don-huy-${range.from}-${range.to}`}
          title={`Hóa đơn hủy ${range.from} → ${range.to}`}
          rows={all.data?.items}
          columns={[
            { header: 'Mã', value: (o) => o.code, width: 16 },
            { header: 'Thanh toán lúc', value: (o) => formatDateTime(o.paidAt), width: 18 },
            { header: 'Hủy lúc', value: (o) => formatDateTime(o.cancelledAt), width: 18 },
            { header: 'Thu ngân', value: (o) => o.cashierName, width: 22 },
            { header: 'Người hủy', value: (o) => o.cancelledByName, width: 12 },
            { header: 'Lý do', value: (o) => o.cancelReason, width: 24 },
            {
              header: 'Phương thức',
              value: (o) => paymentMethodLabels[o.paymentMethod],
              width: 14,
            },
            { header: 'Tổng', value: (o) => o.total },
          ]}
        />
      </CardHeader>
      {report.error ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : !data ? (
        <Skeleton className="m-6 h-40" />
      ) : (
        <>
          <div className="overflow-x-auto border-t">
            <Table className="min-w-[860px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead>Hủy lúc</TableHead>
                  <TableHead>Thu ngân</TableHead>
                  <TableHead>Người hủy</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.code}</TableCell>
                    <TableCell className="tabular-nums">{formatDateTime(o.paidAt)}</TableCell>
                    <TableCell className="tabular-nums">{formatDateTime(o.cancelledAt)}</TableCell>
                    <TableCell>{o.cashierName}</TableCell>
                    <TableCell>{o.cancelledByName}</TableCell>
                    <TableCell>{o.cancelReason}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatVnd(o.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.items.length === 0 && (
              <EmptyState
                compact
                title="Không có hóa đơn hủy"
                description="Khoảng ngày này không có hóa đơn nào bị hủy."
              />
            )}
          </div>
          {data.totalCount > 0 && (
            <div className="border-t">
              <DataTablePagination
                {...data}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s)
                  setPage(1)
                }}
              />
            </div>
          )}
        </>
      )}
    </Card>
  )
}
