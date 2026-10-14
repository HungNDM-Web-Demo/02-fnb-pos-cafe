'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { EyeOff, MoreHorizontal, Pencil, Plus, SearchX, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import { MenuImage } from '@/features/pos/components/MenuImage'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import {
  useCategories,
  useDeleteMenuItem,
  useMenuItems,
  useSetMenuItemAvailability,
  useSetMenuItemHidden,
  useToppings,
} from '../hooks/use-menu'
import { menuItemStatusLabels, type MenuItemDto, type MenuItemStatus } from '../types/menu.types'
import { MenuItemFormDialog } from './MenuItemFormDialog'

const STATUS_TONES: Record<MenuItemStatus, StatusTone> = {
  DangBan: 'success',
  TamHet: 'warning',
  An: 'neutral',
}

type Filters = { categoryId: string; status: MenuItemStatus }

/** Tab Món (UC-01, UC-02 1c): danh sách theo danh mục, công tắc "Còn bán", ẩn/hiện, xóa món chưa bán (BR-18). */
export function MenuItemsTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.menuItems.create)
  const canUpdate = can(permissions.menuItems.update)
  const canDelete = can(permissions.menuItems.delete)
  const canAvailability = can(permissions.menuItems.availability)

  const table = useTableQuery<Filters>({ pageSize: 20 })
  const items = useMenuItems(table.query)
  const categories = useCategories()
  const toppings = useToppings()
  const availability = useSetMenuItemAvailability()
  const hidden = useSetMenuItemHidden()
  const remove = useDeleteMenuItem()

  const [form, setForm] = useState<{ open: boolean; item: MenuItemDto | null }>({
    open: false,
    item: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<MenuItemDto | null>(null)
  const [searchKey, setSearchKey] = useState(0)
  const colorOf = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.color])),
    [categories.data]
  )

  const hasFilters = !!(table.state.search || table.state.categoryId || table.state.status)

  const toggleHidden = (item: MenuItemDto) =>
    hidden.mutate(
      { id: item.id, isHidden: !item.isHidden },
      {
        onSuccess: () =>
          toast.success(item.isHidden ? `Đã hiện ${item.name}` : `Đã ẩn ${item.name}`),
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )

  const columns = useMemo<ColumnDef<MenuItemDto>[]>(() => {
    const list: ColumnDef<MenuItemDto>[] = [
      {
        id: 'name',
        header: 'Món',
        enableSorting: true,
        cell: ({ row }) => {
          const m = row.original
          return (
            <div className="flex min-w-0 items-center gap-3">
              <MenuImage
                imageUrl={m.imageUrl}
                name={m.name}
                color={colorOf.get(m.categoryId)}
                className="size-11 shrink-0 rounded-lg"
                textClassName="text-sm"
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name}</p>
                <p className="text-muted-foreground text-xs">
                  {m.code} · {m.categoryName}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        id: 'sizes',
        header: 'Size, giá',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.sizes.map((s) => `${s.name} ${formatVnd(s.price)}`).join(' · ')}
          </span>
        ),
      },
      {
        id: 'toppingIds',
        header: 'Topping',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.toppingIds.length || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge tone={STATUS_TONES[row.original.status]}>
            {menuItemStatusLabels[row.original.status]}
          </StatusBadge>
        ),
      },
      {
        id: 'available',
        header: 'Còn bán',
        cell: ({ row }) => (
          <Switch
            checked={!row.original.isSoldOut}
            disabled={
              !canAvailability ||
              (availability.isPending && availability.variables?.id === row.original.id)
            }
            onCheckedChange={(v) =>
              availability.mutate(
                { id: row.original.id, isSoldOut: !v },
                {
                  onSuccess: () =>
                    toast.success(
                      v ? `${row.original.name} bán lại` : `Đã báo ${row.original.name} tạm hết`
                    ),
                  onError: (e) => toast.error(getErrorMessage(e)),
                }
              )
            }
            onClick={(e) => e.stopPropagation()}
            aria-label={`Còn bán ${row.original.name}`}
          />
        ),
      },
    ]
    if (canUpdate || canDelete) {
      list.push({
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
        cell: ({ row }) => {
          const m = row.original
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Thao tác với ${m.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {canUpdate && (
                  <>
                    <DropdownMenuItem
                      className="h-9"
                      onSelect={() => setForm({ open: true, item: m })}
                    >
                      <Pencil aria-hidden="true" /> Sửa món
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-9" onSelect={() => toggleHidden(m)}>
                      <EyeOff aria-hidden="true" /> {m.isHidden ? 'Hiện lại' : 'Ẩn khỏi bán hàng'}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="h-9"
                      onSelect={() => setDeleteTarget(m)}
                    >
                      <Trash2 aria-hidden="true" /> Xóa món
                    </DropdownMenuItem>
                    {m.everSold && (
                      <p className="bg-muted/60 text-muted-foreground mt-1 rounded-sm px-2 py-1.5 text-xs leading-snug">
                        Món đã có trong hóa đơn nên chỉ có thể ẩn.
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
  }, [
    canUpdate,
    canDelete,
    canAvailability,
    colorOf,
    availability.isPending,
    availability.variables,
  ])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa món ${deleteTarget.name}`)
    } catch (error) {
      toast.error(getErrorMessage(error), { description: 'Dùng "Ẩn khỏi bán hàng" thay cho xóa.' })
      throw error
    }
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={items.data?.items}
        getRowId={(m) => m.id}
        isLoading={items.isLoading}
        isFetching={items.isFetching}
        error={items.error}
        onRetry={() => void items.refetch()}
        onRowClick={canUpdate ? (m) => setForm({ open: true, item: m }) : undefined}
        minWidth={900}
        sorting={{
          sortBy: table.state.sortBy,
          sortDir: table.state.sortDir,
          onSortChange: table.setSort,
        }}
        pagination={
          items.data && {
            page: items.data.page,
            pageSize: items.data.pageSize,
            totalCount: items.data.totalCount,
            totalPages: items.data.totalPages,
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
              placeholder="Tìm mã, tên món"
            />
            <Select
              value={table.state.categoryId ?? 'all'}
              onValueChange={(v) => table.setFilter('categoryId', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="sm:w-48" aria-label="Lọc danh mục">
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
            <Select
              value={table.state.status ?? 'all'}
              onValueChange={(v) =>
                table.setFilter('status', v === 'all' ? undefined : (v as MenuItemStatus))
              }
            >
              <SelectTrigger className="sm:w-40" aria-label="Lọc trạng thái">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi trạng thái</SelectItem>
                {(Object.keys(menuItemStatusLabels) as MenuItemStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {menuItemStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  table.resetFilters()
                  setSearchKey((k) => k + 1)
                }}
              >
                <X aria-hidden="true" /> Xóa lọc
              </Button>
            )}
            {canCreate && (
              <Button className="sm:ml-auto" onClick={() => setForm({ open: true, item: null })}>
                <Plus aria-hidden="true" /> Thêm món
              </Button>
            )}
          </div>
        }
        emptyState={
          <EmptyState
            icon={SearchX}
            title="Không có món phù hợp"
            description="Đổi từ khóa hoặc bộ lọc."
          />
        }
      />

      <MenuItemFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
        item={form.item}
        categories={categories.data ?? []}
        toppings={(toppings.data ?? []).filter((t) => !t.isHidden)}
        defaultCategoryId={table.state.categoryId}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa món này?"
        description={
          deleteTarget?.everSold
            ? `${deleteTarget.name} đã có trong hóa đơn nên hệ thống sẽ từ chối xóa; hãy dùng "Ẩn khỏi bán hàng".`
            : `${deleteTarget?.name} (${deleteTarget?.code}) sẽ bị xóa khỏi thực đơn.`
        }
        confirmText="Xóa món"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
