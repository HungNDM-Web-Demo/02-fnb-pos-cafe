'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Clock, SearchX, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { permissions } from '@/config/permissions'
import { OrderDetailDialog } from '@/features/orders/components/OrderDetailDialog'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDateTime, formatTime, formatVnd, toDateInputValue } from '@/lib/format'
import { DifferenceText } from '../components/DifferenceText'
import { ShiftDetailSheet } from '../components/ShiftDetailSheet'
import { ShiftStatusBadge } from '../components/ShiftStatusBadge'
import { useShifts } from '../hooks/use-shifts'
import { shiftStatusLabels, type ShiftListItem, type ShiftStatus } from '../types/shift.types'

type Filters = { from: string; to: string; status: ShiftStatus }

const defaultFrom = () => {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return toDateInputValue(d)
}

/** SCR-07 Danh sách ca (UC-11): mặc định 7 ngày, lọc "Cần kiểm tra", chi tiết ca kèm hóa đơn. */
export function ShiftsPage() {
  const table = useTableQuery<Filters>({
    pageSize: 20,
    from: defaultFrom(),
    to: toDateInputValue(new Date()),
  })
  const shifts = useShifts(table.query)
  const [selected, setSelected] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [searchKey, setSearchKey] = useState(0)

  const hasFilters = !!table.state.search || !!table.state.status
  const clearFilters = () => {
    table.resetFilters()
    table.setFilter('from', defaultFrom())
    table.setFilter('to', toDateInputValue(new Date()))
    setSearchKey((k) => k + 1)
  }

  const columns = useMemo<ColumnDef<ShiftListItem>[]>(
    () => [
      {
        id: 'code',
        header: 'Ca',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.code}</p>
            <p className="text-muted-foreground text-xs">{row.original.cashierName}</p>
          </div>
        ),
      },
      {
        id: 'openedAt',
        header: 'Thời gian',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatDateTime(row.original.openedAt)} →{' '}
            {row.original.closedAt ? formatTime(row.original.closedAt) : 'đang mở'}
          </span>
        ),
      },
      {
        id: 'orderCount',
        header: 'HĐ',
        enableSorting: true,
        cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span>,
      },
      {
        id: 'revenue',
        header: 'Doanh thu',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatVnd(row.original.revenue)}</span>
        ),
      },
      {
        id: 'expectedCash',
        header: 'Lý thuyết',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatVnd(row.original.expectedCash)}</span>
        ),
      },
      {
        id: 'countedCash',
        header: 'Thực đếm',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatVnd(row.original.countedCash)}</span>
        ),
      },
      {
        id: 'difference',
        header: 'Chênh lệch',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <DifferenceText value={row.original.difference} strong />,
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => <ShiftStatusBadge status={row.original.status} />,
      },
    ],
    []
  )

  return (
    <PermissionGuard permission={permissions.shifts.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Ca làm"
          icon={Clock}
          description="Theo dõi ca bán hàng, phát hiện và xử lý ca lệch tiền mặt."
        />
        <DataTable
          columns={columns}
          data={shifts.data?.items}
          getRowId={(s) => s.id}
          isLoading={shifts.isLoading}
          isFetching={shifts.isFetching}
          error={shifts.error}
          onRetry={() => void shifts.refetch()}
          onRowClick={(s) => setSelected(s.id)}
          minWidth={1000}
          sorting={{
            sortBy: table.state.sortBy,
            sortDir: table.state.sortDir,
            onSortChange: table.setSort,
          }}
          pagination={
            shifts.data && {
              page: shifts.data.page,
              pageSize: shifts.data.pageSize,
              totalCount: shifts.data.totalCount,
              totalPages: shifts.data.totalPages,
              onPageChange: table.setPage,
              onPageSizeChange: table.setPageSize,
            }
          }
          toolbar={
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchInput
                key={searchKey}
                value={table.state.search}
                onSearch={table.setSearch}
                placeholder="Tìm mã ca, thu ngân"
                className="sm:max-w-xs"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={table.state.from ?? ''}
                  onChange={(e) => table.setFilter('from', e.target.value || undefined)}
                  aria-label="Từ ngày"
                  className="w-40"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="date"
                  value={table.state.to ?? ''}
                  onChange={(e) => table.setFilter('to', e.target.value || undefined)}
                  aria-label="Đến ngày"
                  className="w-40"
                />
              </div>
              <Select
                value={table.state.status ?? 'all'}
                onValueChange={(v) =>
                  table.setFilter('status', v === 'all' ? undefined : (v as ShiftStatus))
                }
              >
                <SelectTrigger className="sm:w-44" aria-label="Lọc theo trạng thái">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi trạng thái</SelectItem>
                  {(Object.keys(shiftStatusLabels) as ShiftStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {shiftStatusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="text-muted-foreground sm:ml-auto"
                >
                  <X aria-hidden="true" />
                  Xóa lọc
                </Button>
              )}
            </div>
          }
          emptyState={
            <EmptyState
              icon={SearchX}
              title="Không có ca trong khoảng này"
              description="Đổi khoảng ngày hoặc bỏ bộ lọc."
            />
          }
        />
      </div>
      <ShiftDetailSheet
        shiftId={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onOrderClick={setOrderId}
      />
      <OrderDetailDialog orderId={orderId} onOpenChange={(open) => !open && setOrderId(null)} />
    </PermissionGuard>
  )
}
