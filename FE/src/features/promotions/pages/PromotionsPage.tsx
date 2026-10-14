'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { BadgePercent, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatNumber, formatVnd } from '@/lib/format'
import { PromotionFormDialog } from '../components/PromotionFormDialog'
import { VoucherFormDialog } from '../components/VoucherFormDialog'
import {
  useDeletePromotion,
  useDeleteVoucher,
  usePausePromotion,
  usePauseVoucher,
  usePromotions,
  useVouchers,
} from '../hooks/use-promotions'
import {
  promotionScopeLabels,
  promotionStatusLabels,
  voucherStatusLabels,
  type PromotionDto,
  type PromotionStatus,
  type VoucherDto,
  type VoucherStatus,
} from '../types/promotion.types'

const PROMO_TONES: Record<PromotionStatus, StatusTone> = {
  SapChay: 'info',
  DangChay: 'success',
  DaHet: 'neutral',
  TamDung: 'warning',
}
const VOUCHER_TONES: Record<VoucherStatus, StatusTone> = {
  HoatDong: 'success',
  HetLuot: 'neutral',
  HetHan: 'neutral',
  TamDung: 'warning',
}
const DAY_LABELS = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const discountText = (x: { discountType: string; discountValue: number; maxDiscount?: number }) =>
  x.discountType === 'PhanTram'
    ? `${x.discountValue}%${x.maxDiscount ? `, tối đa ${formatVnd(x.maxDiscount)}` : ''}`
    : formatVnd(x.discountValue)

/** SCR-10 Khuyến mãi và voucher (UC-13): tạo, sửa, tạm dừng; số lượt voucher đã dùng. */
export function PromotionsPage() {
  return (
    <PermissionGuard permission={permissions.promotions.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Khuyến mãi"
          icon={BadgePercent}
          description="Khuyến mãi tự áp theo điều kiện và voucher thu ngân nhập tay."
        />
        <Tabs defaultValue="promotions" className="gap-4">
          <TabsList className="h-11">
            <TabsTrigger value="promotions" className="px-4">
              Khuyến mãi
            </TabsTrigger>
            <TabsTrigger value="vouchers" className="px-4">
              Voucher
            </TabsTrigger>
          </TabsList>
          <TabsContent value="promotions">
            <PromotionsTab />
          </TabsContent>
          <TabsContent value="vouchers">
            <VouchersTab />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}

function PromotionsTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.promotions.create)
  const canUpdate = can(permissions.promotions.update)
  const canDelete = can(permissions.promotions.delete)
  const table = useTableQuery<{ status: PromotionStatus }>({ pageSize: 10 })
  const promotions = usePromotions(table.query)
  const pause = usePausePromotion()
  const remove = useDeletePromotion()
  const [form, setForm] = useState<{ open: boolean; item: PromotionDto | null }>({
    open: false,
    item: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<PromotionDto | null>(null)

  const columns = useMemo<ColumnDef<PromotionDto>[]>(() => {
    const list: ColumnDef<PromotionDto>[] = [
      {
        id: 'name',
        header: 'Khuyến mãi',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground text-xs">
              {row.original.code} · {promotionScopeLabels[row.original.scope]}
              {row.original.categoryName ? `: ${row.original.categoryName}` : ''}
              {row.original.scope === 'Mon' ? `: ${row.original.menuItemIds.length} món` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'discount',
        header: 'Mức giảm',
        cell: ({ row }) => <span className="text-sm">{discountText(row.original)}</span>,
      },
      {
        id: 'condition',
        header: 'Điều kiện',
        cell: ({ row }) => {
          const p = row.original
          const parts = [
            p.minOrderAmount ? `Đơn từ ${formatVnd(p.minOrderAmount)}` : null,
            p.startTime ? `${p.startTime}–${p.endTime}` : null,
            p.daysOfWeek.length ? p.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ') : null,
          ].filter(Boolean)
          return (
            <span className="text-muted-foreground text-sm">{parts.join(' · ') || 'Mọi đơn'}</span>
          )
        },
      },
      {
        id: 'startDate',
        header: 'Hiệu lực',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatDate(`${row.original.startDate}T00:00:00`)} →{' '}
            {formatDate(`${row.original.endDate}T00:00:00`)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge tone={PROMO_TONES[row.original.status]}>
            {promotionStatusLabels[row.original.status]}
          </StatusBadge>
        ),
      },
    ]
    if (canUpdate || canDelete) {
      list.push({
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
        cell: ({ row }) => {
          const p = row.original
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Thao tác với ${p.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canUpdate && (
                  <>
                    <DropdownMenuItem
                      className="h-9"
                      onSelect={() => setForm({ open: true, item: p })}
                    >
                      <Pencil aria-hidden="true" /> Sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-9"
                      onSelect={() =>
                        pause.mutate(
                          { id: p.id, isPaused: !p.isPaused },
                          {
                            onSuccess: () =>
                              toast.success(
                                p.isPaused ? `Đã chạy lại ${p.name}` : `Đã tạm dừng ${p.name}`
                              ),
                            onError: (e) => toast.error(getErrorMessage(e)),
                          }
                        )
                      }
                    >
                      {p.isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                      {p.isPaused ? 'Chạy lại' : 'Tạm dừng'}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="h-9"
                      onSelect={() => setDeleteTarget(p)}
                    >
                      <Trash2 aria-hidden="true" /> Xóa
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation object đổi mỗi render
  }, [canUpdate, canDelete])

  return (
    <>
      <DataTable
        columns={columns}
        data={promotions.data?.items}
        getRowId={(p) => p.id}
        isLoading={promotions.isLoading}
        isFetching={promotions.isFetching}
        error={promotions.error}
        onRetry={() => void promotions.refetch()}
        minWidth={980}
        sorting={{
          sortBy: table.state.sortBy,
          sortDir: table.state.sortDir,
          onSortChange: table.setSort,
        }}
        pagination={
          promotions.data && {
            page: promotions.data.page,
            pageSize: promotions.data.pageSize,
            totalCount: promotions.data.totalCount,
            totalPages: promotions.data.totalPages,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }
        }
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={table.state.search}
              onSearch={table.setSearch}
              placeholder="Tìm mã, tên khuyến mãi"
            />
            <Select
              value={table.state.status ?? 'all'}
              onValueChange={(v) =>
                table.setFilter('status', v === 'all' ? undefined : (v as PromotionStatus))
              }
            >
              <SelectTrigger className="sm:w-44" aria-label="Lọc trạng thái">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi trạng thái</SelectItem>
                {(Object.keys(promotionStatusLabels) as PromotionStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {promotionStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canCreate && (
              <Button className="sm:ml-auto" onClick={() => setForm({ open: true, item: null })}>
                <Plus aria-hidden="true" /> Thêm khuyến mãi
              </Button>
            )}
          </div>
        }
      />
      <PromotionFormDialog
        open={form.open}
        promotion={form.item}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa khuyến mãi?"
        description={`${deleteTarget?.name} sẽ không còn áp nữa; hóa đơn cũ giữ tên đã ghi.`}
        confirmText="Xóa"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await remove.mutateAsync(deleteTarget.id)
            toast.success(`Đã xóa ${deleteTarget.name}`)
          } catch (error) {
            toast.error(getErrorMessage(error))
            throw error
          }
        }}
      />
    </>
  )
}

function VouchersTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.promotions.create)
  const canUpdate = can(permissions.promotions.update)
  const canDelete = can(permissions.promotions.delete)
  const table = useTableQuery<{ status: VoucherStatus }>({ pageSize: 10 })
  const vouchers = useVouchers(table.query)
  const pause = usePauseVoucher()
  const remove = useDeleteVoucher()
  const [form, setForm] = useState<{ open: boolean; item: VoucherDto | null }>({
    open: false,
    item: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<VoucherDto | null>(null)

  const columns = useMemo<ColumnDef<VoucherDto>[]>(() => {
    const list: ColumnDef<VoucherDto>[] = [
      {
        id: 'code',
        header: 'Mã',
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <p className="font-mono font-semibold">{row.original.code}</p>
            {row.original.description && (
              <p className="text-muted-foreground text-xs">{row.original.description}</p>
            )}
          </div>
        ),
      },
      {
        id: 'discount',
        header: 'Mức giảm',
        cell: ({ row }) => <span className="text-sm">{discountText(row.original)}</span>,
      },
      {
        id: 'minOrderAmount',
        header: 'Đơn tối thiểu',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{formatVnd(row.original.minOrderAmount)}</span>
        ),
      },
      {
        id: 'usedCount',
        header: 'Đã dùng',
        enableSorting: true,
        cell: ({ row }) => {
          const v = row.original
          return (
            <div className="w-32 space-y-1">
              <p className="text-sm tabular-nums">
                {formatNumber(v.usedCount)}
                {v.maxUses ? ` / ${formatNumber(v.maxUses)}` : ' lượt'}
              </p>
              {v.maxUses ? (
                <Progress
                  value={Math.min(100, (v.usedCount / v.maxUses) * 100)}
                  className="h-1.5"
                  aria-label="Tỉ lệ lượt đã dùng"
                />
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'expiresAt',
        header: 'Hạn dùng',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatDate(row.original.expiresAt, 'Không hạn')}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge tone={VOUCHER_TONES[row.original.status]}>
            {voucherStatusLabels[row.original.status]}
          </StatusBadge>
        ),
      },
    ]
    if (canUpdate || canDelete) {
      list.push({
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
        cell: ({ row }) => {
          const v = row.original
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Thao tác với ${v.code}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canUpdate && (
                  <>
                    <DropdownMenuItem
                      className="h-9"
                      onSelect={() => setForm({ open: true, item: v })}
                    >
                      <Pencil aria-hidden="true" /> Sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-9"
                      onSelect={() =>
                        pause.mutate(
                          { id: v.id, isPaused: !v.isPaused },
                          {
                            onSuccess: () =>
                              toast.success(
                                v.isPaused ? `Đã mở lại ${v.code}` : `Đã tạm dừng ${v.code}`
                              ),
                            onError: (e) => toast.error(getErrorMessage(e)),
                          }
                        )
                      }
                    >
                      {v.isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                      {v.isPaused ? 'Mở lại' : 'Tạm dừng'}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="h-9"
                      onSelect={() => setDeleteTarget(v)}
                    >
                      <Trash2 aria-hidden="true" /> Xóa
                    </DropdownMenuItem>
                    {v.usedCount > 0 && (
                      <p className="bg-muted/60 text-muted-foreground mt-1 rounded-sm px-2 py-1.5 text-xs">
                        Voucher đã được dùng, chỉ có thể tạm dừng.
                      </p>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation object đổi mỗi render
  }, [canUpdate, canDelete])

  return (
    <>
      <DataTable
        columns={columns}
        data={vouchers.data?.items}
        getRowId={(v) => v.id}
        isLoading={vouchers.isLoading}
        isFetching={vouchers.isFetching}
        error={vouchers.error}
        onRetry={() => void vouchers.refetch()}
        minWidth={900}
        sorting={{
          sortBy: table.state.sortBy,
          sortDir: table.state.sortDir,
          onSortChange: table.setSort,
        }}
        pagination={
          vouchers.data && {
            page: vouchers.data.page,
            pageSize: vouchers.data.pageSize,
            totalCount: vouchers.data.totalCount,
            totalPages: vouchers.data.totalPages,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }
        }
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={table.state.search}
              onSearch={table.setSearch}
              placeholder="Tìm mã voucher"
            />
            <Select
              value={table.state.status ?? 'all'}
              onValueChange={(v) =>
                table.setFilter('status', v === 'all' ? undefined : (v as VoucherStatus))
              }
            >
              <SelectTrigger className="sm:w-44" aria-label="Lọc trạng thái">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi trạng thái</SelectItem>
                {(Object.keys(voucherStatusLabels) as VoucherStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {voucherStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canCreate && (
              <Button className="sm:ml-auto" onClick={() => setForm({ open: true, item: null })}>
                <Plus aria-hidden="true" /> Thêm voucher
              </Button>
            )}
          </div>
        }
      />
      <VoucherFormDialog
        open={form.open}
        voucher={form.item}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa voucher?"
        description={
          deleteTarget?.usedCount
            ? `${deleteTarget.code} đã được dùng nên chỉ có thể tạm dừng.`
            : `Voucher ${deleteTarget?.code} sẽ bị xóa.`
        }
        confirmText="Xóa"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await remove.mutateAsync(deleteTarget.id)
            toast.success(`Đã xóa ${deleteTarget.code}`)
          } catch (error) {
            toast.error(getErrorMessage(error))
            throw error
          }
        }}
      />
    </>
  )
}
