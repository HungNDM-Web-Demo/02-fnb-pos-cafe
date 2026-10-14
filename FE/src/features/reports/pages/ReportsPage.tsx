'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ChartColumn } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { cn } from '@/lib/utils'
import {
  CancelledOrdersTab,
  CashiersTab,
  HeatmapTab,
  PaymentMethodsTab,
  RevenueTab,
  TopItemsTab,
} from '../components/ReportTabs'
import { RANGE_PRESETS, presetRange, rangeError, type RangePreset } from '../lib/date-range'

const TABS = [
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'top-items', label: 'Món bán chạy' },
  { value: 'heatmap', label: 'Khung giờ' },
  { value: 'payment-methods', label: 'Phương thức' },
  { value: 'cashiers', label: 'Thu ngân' },
  { value: 'cancelled', label: 'Hóa đơn hủy' },
] as const

/** SCR-11 Báo cáo (UC-14): khoảng ngày mặc định 30 ngày, chặn khoảng > 366 ngày (TC-30), xuất Excel từng tab. */
export function ReportsPage() {
  return (
    <PermissionGuard permission={permissions.reports.view} redirect>
      <Suspense>
        <ReportsView />
      </Suspense>
    </PermissionGuard>
  )
}

function ReportsView() {
  const params = useSearchParams()
  const initialTab = TABS.some((t) => t.value === params.get('tab'))
    ? params.get('tab')!
    : 'revenue'
  const [tab, setTab] = useState<string>(initialTab)
  const [preset, setPreset] = useState<RangePreset>('30d')
  const initial = presetRange('30d')
  const [custom, setCustom] = useState(initial)
  const [range, setRange] = useState(initial)

  const customError = useMemo(
    () => (preset === 'custom' ? rangeError(custom.from, custom.to) : null),
    [preset, custom]
  )

  const choose = (value: RangePreset) => {
    setPreset(value)
    if (value !== 'custom') {
      const next = presetRange(value)
      setRange(next)
      setCustom(next)
    }
  }

  const applyCustom = () => {
    if (!rangeError(custom.from, custom.to)) setRange(custom)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo"
        icon={ChartColumn}
        description="Doanh thu thuần chỉ tính hóa đơn đã thanh toán, theo thời điểm thanh toán."
      />

      <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-xs lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Khoảng ngày">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={preset === p.value}
              onClick={() => choose(p.value)}
              className={cn(
                'focus-visible:ring-ring/50 h-10 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
                preset === p.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex flex-col gap-1 lg:ml-auto">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                aria-label="Từ ngày"
                aria-invalid={!!customError || undefined}
                className="w-40"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="date"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                aria-label="Đến ngày"
                aria-invalid={!!customError || undefined}
                className="w-40"
              />
              <Button onClick={applyCustom} disabled={!!customError}>
                Xem
              </Button>
            </div>
            {customError && (
              <p className="text-destructive flex items-center gap-1 text-[0.8125rem]" role="alert">
                <AlertCircle className="size-3.5" aria-hidden="true" />
                {customError}
              </p>
            )}
          </div>
        )}
        {preset !== 'custom' && (
          <p className="text-muted-foreground text-sm lg:ml-auto">
            {range.from.split('-').reverse().join('/')} → {range.to.split('-').reverse().join('/')}
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="h-11 w-full justify-start overflow-x-auto sm:w-fit">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-3">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="revenue">
          <RevenueTab range={range} enabled={tab === 'revenue'} />
        </TabsContent>
        <TabsContent value="top-items">
          <TopItemsTab range={range} enabled={tab === 'top-items'} />
        </TabsContent>
        <TabsContent value="heatmap">
          <HeatmapTab range={range} enabled={tab === 'heatmap'} />
        </TabsContent>
        <TabsContent value="payment-methods">
          <PaymentMethodsTab range={range} enabled={tab === 'payment-methods'} />
        </TabsContent>
        <TabsContent value="cashiers">
          <CashiersTab range={range} enabled={tab === 'cashiers'} />
        </TabsContent>
        <TabsContent value="cancelled">
          <CancelledOrdersTab range={range} enabled={tab === 'cancelled'} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
