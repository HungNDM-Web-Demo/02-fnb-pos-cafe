'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus, Star, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/shared/DataTable'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { SearchInput } from '@/components/shared/SearchInput'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { OrderDetailDialog } from '@/features/orders/components/OrderDetailDialog'
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPhone,
  formatRelativeTime,
  formatVnd,
} from '@/lib/format'
import { useCustomer, useCustomers, useSaveCustomer } from '../hooks/use-customers'
import type { CustomerDto } from '../types/customer.types'

/** SCR-12 Khách hàng (UC-15, P3): danh sách, điểm, lịch sử mua; thêm, sửa tên và ghi chú. */
export function CustomersPage() {
  const { can } = usePermissions()
  const table = useTableQuery({ pageSize: 20 })
  const customers = useCustomers(table.query)
  const [selected, setSelected] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; customer: CustomerDto | null }>({
    open: false,
    customer: null,
  })

  const columns = useMemo<ColumnDef<CustomerDto>[]>(
    () => [
      {
        id: 'name',
        header: 'Khách hàng',
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {formatPhone(row.original.phone)}
            </p>
          </div>
        ),
      },
      {
        id: 'points',
        header: 'Điểm',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
            <Star className="text-warning size-3.5" aria-hidden="true" />
            {formatNumber(row.original.points)}
          </span>
        ),
      },
      {
        id: 'orderCount',
        header: 'Số đơn',
        enableSorting: true,
        cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span>,
      },
      {
        id: 'totalSpent',
        header: 'Tổng chi',
        enableSorting: true,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatVnd(row.original.totalSpent)}</span>
        ),
      },
      {
        id: 'lastOrderAt',
        header: 'Mua gần nhất',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm">
            {formatRelativeTime(row.original.lastOrderAt, 'Chưa mua')}
          </span>
        ),
      },
      {
        id: 'note',
        header: 'Ghi chú',
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-1 text-sm">
            {row.original.note ?? ''}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <PermissionGuard permission={permissions.customers.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Khách hàng"
          icon={UsersRound}
          description="Khách tích điểm: 1 điểm cho mỗi 10.000 ₫ thanh toán, hủy hóa đơn thì trừ lại."
          actions={
            can(permissions.customers.create) && (
              <Button onClick={() => setForm({ open: true, customer: null })}>
                <Plus aria-hidden="true" /> Thêm khách
              </Button>
            )
          }
        />
        <DataTable
          columns={columns}
          data={customers.data?.items}
          getRowId={(c) => c.id}
          isLoading={customers.isLoading}
          isFetching={customers.isFetching}
          error={customers.error}
          onRetry={() => void customers.refetch()}
          onRowClick={(c) => setSelected(c.id)}
          minWidth={820}
          sorting={{
            sortBy: table.state.sortBy,
            sortDir: table.state.sortDir,
            onSortChange: table.setSort,
          }}
          pagination={
            customers.data && {
              page: customers.data.page,
              pageSize: customers.data.pageSize,
              totalCount: customers.data.totalCount,
              totalPages: customers.data.totalPages,
              onPageChange: table.setPage,
              onPageSizeChange: table.setPageSize,
            }
          }
          toolbar={
            <SearchInput
              value={table.state.search}
              onSearch={table.setSearch}
              placeholder="Tìm số điện thoại, tên"
            />
          }
        />
      </div>
      <CustomerDetailSheet
        customerId={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onEdit={
          can(permissions.customers.create)
            ? (c) => setForm({ open: true, customer: c })
            : undefined
        }
      />
      <CustomerFormDialog
        open={form.open}
        customer={form.customer}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
      />
    </PermissionGuard>
  )
}

function CustomerDetailSheet({
  customerId,
  onOpenChange,
  onEdit,
}: {
  customerId: string | null
  onOpenChange: (open: boolean) => void
  onEdit?: (customer: CustomerDto) => void
}) {
  const customer = useCustomer(customerId)
  const [orderId, setOrderId] = useState<string | null>(null)
  const data = customer.data
  return (
    <>
      <Sheet open={!!customerId} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{data?.name ?? '…'}</SheetTitle>
            <SheetDescription>
              {data
                ? `${formatPhone(data.phone)} · khách từ ${formatDate(data.createdAt)}`
                : 'Đang tải…'}
            </SheetDescription>
          </SheetHeader>
          {customer.error ? (
            <ErrorState error={customer.error} onRetry={() => void customer.refetch()} />
          ) : !data ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Điểm</p>
                  <p className="text-lg font-semibold tabular-nums">{formatNumber(data.points)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Số đơn</p>
                  <p className="text-lg font-semibold tabular-nums">{data.orderCount}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Tổng chi</p>
                  <p className="text-lg font-semibold tabular-nums">{formatVnd(data.totalSpent)}</p>
                </div>
              </div>
              {data.note && <p className="bg-muted/60 rounded-lg px-3 py-2 text-sm">{data.note}</p>}
              {onEdit && (
                <Button variant="outline" onClick={() => onEdit(data)}>
                  Sửa thông tin
                </Button>
              )}
              <section>
                <h3 className="mb-2 text-sm font-semibold">20 hóa đơn gần nhất</h3>
                {data.recentOrders.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Chưa có hóa đơn.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {data.recentOrders.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => setOrderId(o.id)}
                          className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
                        >
                          <span>
                            <span className="font-medium">{o.code}</span>
                            <span className="text-muted-foreground block text-xs">
                              {formatDateTime(o.paidAt)}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="tabular-nums">{formatVnd(o.total)}</span>
                            <OrderStatusBadge status={o.status} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <OrderDetailDialog orderId={orderId} onOpenChange={(open) => !open && setOrderId(null)} />
    </>
  )
}

type CustomerForm = { phone: string; name: string; note: string }

function CustomerFormDialog({
  open,
  customer,
  onOpenChange,
}: {
  open: boolean
  customer: CustomerDto | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveCustomer()
  const form = useForm<CustomerForm>({ defaultValues: { phone: '', name: '', note: '' } })
  const { errors } = form.formState

  useEffect(() => {
    if (open)
      form.reset({
        phone: customer?.phone ?? '',
        name: customer?.name ?? '',
        note: customer?.note ?? '',
      })
  }, [open, customer, form])

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        id: customer?.id,
        input: { phone: values.phone, name: values.name, note: values.note || undefined },
      },
      {
        onSuccess: (saved) => {
          toast.success(customer ? `Đã lưu ${saved.name}` : `Đã thêm khách ${saved.name}`)
          onOpenChange(false)
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
        },
      }
    )
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}</DialogTitle>
          <DialogDescription>Số điện thoại là mã tra cứu ở màn bán hàng.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField label="Số điện thoại" required error={errors.phone?.message}>
            <Input
              type="tel"
              inputMode="tel"
              {...form.register('phone', { required: 'Nhập số điện thoại' })}
            />
          </FormField>
          <FormField label="Tên khách" required error={errors.name?.message}>
            <Input {...form.register('name', { required: 'Nhập tên khách' })} />
          </FormField>
          <FormField label="Ghi chú">
            <Textarea rows={2} {...form.register('note')} />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
