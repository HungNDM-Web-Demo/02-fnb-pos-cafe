'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Receipt, SearchX, X } from 'lucide-react'
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
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDateTime, formatVnd } from '@/lib/format'
import { OrderDetailDialog } from '../components/OrderDetailDialog'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { useOrders } from '../hooks/use-orders'
import {
  paymentMethodLabels,
  serviceTypeLabels,
  type OrderListItem,
  type OrderStatus,
  type PaymentMethod,
} from '../types/order.types'

type Filters = { from: string; to: string; status: OrderStatus; paymentMethod: PaymentMethod }

/** SCR-08 Danh sách hóa đơn (UC-08, UC-09): thu ngân chỉ thấy hóa đơn của mình (orders.view-all). */
export function OrdersPage() {
  const { can } = usePermissions()
  const viewAll = can(permissions.orders.viewAll)
  const table = useTableQuery<Filters>({ pageSize: 20 })
  const orders = useOrders(table.query)
  const [selected, setSelected] = useState<string | null>(null)
  const [searchKey, setSearchKey] = useState(0)

  const hasFilters = !!(
    table.state.search ||
    table.state.from ||
    table.state.to ||
    table.state.status ||
    table.state.paymentMethod
  )
  const clearFilters = () => {
    table.resetFilters()
    setSearchKey((k) => k + 1)
  }

  const columns = useMemo<ColumnDef<OrderListItem>[]>(
    () => [
      {
        id: 'code',
        header: 'Mã hóa đơn',
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
      },
      {
        id: 'paidAt',
        header: 'Thời gian',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{formatDateTime(row.original.paidAt)}</span>
        ),
      },
      { id: 'cashierName', header: 'Thu ngân', cell: ({ row }) => row.original.cashierName },
      {
        id: 'serviceType',
        header: 'Hình thức',
        cell: ({ row }) => (
          <span className="text-sm">
            {serviceTypeLabels[row.original.serviceType]}
            {row.original.tableTag ? ` · ${row.original.tableTag}` : ''}
          </span>
        ),
      },
      {
        id: 'itemCount',
        header: 'SL',
        cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span>,
      },
      {
        id: 'paymentMethod',
        header: 'Thanh toán',
        cell: ({ row }) => paymentMethodLabels[row.original.paymentMethod],
      },
      {
        id: 'total',
        header: 'Tổng',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatVnd(row.original.total)}</p>
            {row.original.discountTotal > 0 && (
              <p className="text-muted-foreground text-xs tabular-nums">
                giảm {formatVnd(row.original.discountTotal)}
                {row.original.voucherCode ? ` · ${row.original.voucherCode}` : ''}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
    ],
    []
  )

  return (
    <PermissionGuard permission={permissions.orders.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Hóa đơn"
          icon={Receipt}
          description={
            viewAll
              ? 'Tra cứu hóa đơn của mọi thu ngân, xem chi tiết, in lại, hủy.'
              : 'Tra cứu hóa đơn bạn đã bán, xem chi tiết và in lại.'
          }
        />
        <DataTable
          columns={columns}
          data={orders.data?.items}
          getRowId={(o) => o.id}
          isLoading={orders.isLoading}
          isFetching={orders.isFetching}
          error={orders.error}
          onRetry={() => void orders.refetch()}
          onRowClick={(o) => setSelected(o.id)}
          minWidth={980}
          sorting={{
            sortBy: table.state.sortBy,
            sortDir: table.state.sortDir,
            onSortChange: table.setSort,
          }}
          pagination={
            orders.data && {
              page: orders.data.page,
              pageSize: orders.data.pageSize,
              totalCount: orders.data.totalCount,
              totalPages: orders.data.totalPages,
              onPageChange: table.setPage,
              onPageSizeChange: table.setPageSize,
            }
          }
          toolbar={
            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
              <SearchInput
                key={searchKey}
                value={table.state.search}
                onSearch={table.setSearch}
                placeholder="Tìm mã hóa đơn"
                className="lg:max-w-xs"
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
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select
                  value={table.state.paymentMethod ?? 'all'}
                  onValueChange={(v) =>
                    table.setFilter('paymentMethod', v === 'all' ? undefined : (v as PaymentMethod))
                  }
                >
                  <SelectTrigger className="sm:w-40" aria-label="Lọc phương thức">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mọi phương thức</SelectItem>
                    <SelectItem value="TienMat">Tiền mặt</SelectItem>
                    <SelectItem value="ChuyenKhoan">Chuyển khoản</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={table.state.status ?? 'all'}
                  onValueChange={(v) =>
                    table.setFilter('status', v === 'all' ? undefined : (v as OrderStatus))
                  }
                >
                  <SelectTrigger className="sm:w-40" aria-label="Lọc trạng thái">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mọi trạng thái</SelectItem>
                    <SelectItem value="DaThanhToan">Đã thanh toán</SelectItem>
                    <SelectItem value="DaHuy">Đã hủy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="text-muted-foreground lg:ml-auto"
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
              title={hasFilters ? 'Không tìm thấy hóa đơn' : 'Chưa có hóa đơn'}
              description={
                hasFilters
                  ? 'Thử mã khác hoặc bỏ bớt bộ lọc.'
                  : 'Hóa đơn sẽ hiện ở đây sau khi thanh toán.'
              }
            />
          }
        />
      </div>
      <OrderDetailDialog orderId={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </PermissionGuard>
  )
}
