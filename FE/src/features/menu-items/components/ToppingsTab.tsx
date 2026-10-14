'use client'

import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { EyeOff, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { usePermissions } from '@/hooks/use-permissions'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import {
  useDeleteTopping,
  useSaveTopping,
  useSetToppingAvailability,
  useSetToppingHidden,
  useToppings,
} from '../hooks/use-menu'
import { toppingSchema, type ToppingFormValues } from '../schemas/menu.schema'
import { menuItemStatusLabels, type MenuItemStatus, type ToppingDto } from '../types/menu.types'

const TONES: Record<MenuItemStatus, StatusTone> = {
  DangBan: 'success',
  TamHet: 'warning',
  An: 'neutral',
}

/** Tab Topping (UC-01 1b, UC-02): tên, giá, tạm hết/bán lại, ẩn, xóa topping chưa bán. */
export function ToppingsTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.menuItems.create)
  const canUpdate = can(permissions.menuItems.update)
  const canDelete = can(permissions.menuItems.delete)
  const canAvailability = can(permissions.menuItems.availability)
  const toppings = useToppings()
  const availability = useSetToppingAvailability()
  const hidden = useSetToppingHidden()
  const remove = useDeleteTopping()
  const [form, setForm] = useState<{ open: boolean; topping: ToppingDto | null }>({
    open: false,
    topping: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<ToppingDto | null>(null)

  const columns = useMemo<ColumnDef<ToppingDto>[]>(() => {
    const list: ColumnDef<ToppingDto>[] = [
      {
        id: 'code',
        header: 'Mã',
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span>,
      },
      {
        id: 'name',
        header: 'Topping',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'price',
        header: 'Giá',
        cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.price)}</span>,
      },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge tone={TONES[row.original.status]}>
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
            disabled={!canAvailability}
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
          const t = row.original
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Thao tác với ${t.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canUpdate && (
                  <>
                    <DropdownMenuItem
                      className="h-9"
                      onSelect={() => setForm({ open: true, topping: t })}
                    >
                      <Pencil aria-hidden="true" /> Sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-9"
                      onSelect={() =>
                        hidden.mutate(
                          { id: t.id, isHidden: !t.isHidden },
                          {
                            onSuccess: () =>
                              toast.success(t.isHidden ? `Đã hiện ${t.name}` : `Đã ẩn ${t.name}`),
                            onError: (e) => toast.error(getErrorMessage(e)),
                          }
                        )
                      }
                    >
                      <EyeOff aria-hidden="true" /> {t.isHidden ? 'Hiện lại' : 'Ẩn'}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="h-9"
                      onSelect={() => setDeleteTarget(t)}
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
  }, [canUpdate, canDelete, canAvailability])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa topping ${deleteTarget.name}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={toppings.data}
        getRowId={(t) => t.id}
        isLoading={toppings.isLoading}
        isFetching={toppings.isFetching}
        error={toppings.error}
        onRetry={() => void toppings.refetch()}
        minWidth={720}
        toolbar={
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Topping tạm hết sẽ mờ ở mọi món trên màn bán hàng.
            </p>
            {canCreate && (
              <Button onClick={() => setForm({ open: true, topping: null })}>
                <Plus aria-hidden="true" /> Thêm topping
              </Button>
            )}
          </div>
        }
      />
      <ToppingFormDialog
        open={form.open}
        topping={form.topping}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa topping?"
        description={
          deleteTarget?.everSold
            ? `${deleteTarget.name} đã có trong hóa đơn nên chỉ có thể ẩn.`
            : `${deleteTarget?.name} sẽ bị xóa khỏi mọi món.`
        }
        confirmText="Xóa"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function ToppingFormDialog({
  open,
  topping,
  onOpenChange,
}: {
  open: boolean
  topping: ToppingDto | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveTopping()
  const form = useForm<ToppingFormValues>({
    resolver: zodResolver(toppingSchema),
    defaultValues: { code: '', name: '', price: 0 },
  })
  const { errors } = form.formState

  useEffect(() => {
    if (open)
      form.reset(
        topping
          ? { code: topping.code, name: topping.name, price: topping.price }
          : { code: '', name: '', price: 0 }
      )
  }, [open, topping, form])

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        id: topping?.id,
        input: { code: values.code.toUpperCase(), name: values.name, price: values.price },
      },
      {
        onSuccess: (saved) => {
          toast.success(topping ? `Đã lưu ${saved.name}` : `Đã thêm topping ${saved.name}`)
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
          <DialogTitle>{topping ? 'Sửa topping' : 'Thêm topping'}</DialogTitle>
          <DialogDescription>
            Giá là bội số 1.000 ₫. Đổi giá không làm thay đổi hóa đơn cũ.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
            <FormField
              label="Mã"
              error={errors.code?.message}
              hint={topping ? undefined : 'Bỏ trống để tự sinh'}
            >
              <Input className="uppercase" {...form.register('code')} />
            </FormField>
            <FormField label="Tên topping" required error={errors.name?.message}>
              <Input {...form.register('name')} />
            </FormField>
          </div>
          <FormField label="Giá" required error={errors.price?.message}>
            <Controller
              control={form.control}
              name="price"
              render={({ field }) => (
                <MoneyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
              )}
            />
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
