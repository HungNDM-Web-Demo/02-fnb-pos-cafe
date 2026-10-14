'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, GripVertical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import {
  useCategories,
  useDeleteCategory,
  useReorderCategories,
  useSaveCategory,
} from '../hooks/use-menu'
import { categorySchema, type CategoryFormValues } from '../schemas/menu.schema'
import type { CategoryDto } from '../types/menu.types'

const SWATCHES = [
  '#78350F',
  '#BE185D',
  '#15803D',
  '#1D4ED8',
  '#0E7490',
  '#B45309',
  '#7C3AED',
  '#B91C1C',
]

/** Tab Danh mục (UC-01 1a): thêm, đổi tên, màu, ẩn/hiện, kéo thả sắp xếp (PUT /api/categories/order). */
export function CategoriesTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.menuItems.create)
  const canUpdate = can(permissions.menuItems.update)
  const canDelete = can(permissions.menuItems.delete)
  const categories = useCategories()
  const reorder = useReorderCategories()
  const save = useSaveCategory()
  const remove = useDeleteCategory()

  const [order, setOrder] = useState<CategoryDto[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; category: CategoryDto | null }>({
    open: false,
    category: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<CategoryDto | null>(null)

  // Đồng bộ thứ tự hiển thị khi dữ liệu máy chủ đổi (đặt lại state trong lúc render, không dùng effect)
  const [synced, setSynced] = useState<CategoryDto[] | undefined>(undefined)
  if (categories.data !== synced) {
    setSynced(categories.data)
    if (categories.data) setOrder(categories.data)
  }

  const persist = (next: CategoryDto[]) => {
    setOrder(next)
    reorder.mutate(
      { ids: next.map((c) => c.id) },
      {
        onSuccess: () => toast.success('Đã lưu thứ tự danh mục'),
        onError: (e) => {
          toast.error(getErrorMessage(e))
          if (categories.data) setOrder(categories.data)
        },
      }
    )
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return
    const next = [...order]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    persist(next)
  }

  const toggleHidden = (c: CategoryDto) =>
    save.mutate(
      { id: c.id, input: { code: c.code, name: c.name, color: c.color, isHidden: !c.isHidden } },
      {
        onSuccess: () => toast.success(c.isHidden ? `Đã hiện ${c.name}` : `Đã ẩn ${c.name}`),
        onError: (e) => toast.error(getErrorMessage(e)),
      }
    )

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa danh mục ${deleteTarget.name}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  if (categories.error)
    return (
      <Card>
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      </Card>
    )

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <p className="text-muted-foreground text-sm">
          Kéo thả (hoặc dùng mũi tên) để đổi thứ tự tab trên màn bán hàng.
        </p>
        <div className="flex items-center gap-2">
          {reorder.isPending && (
            <Loader2
              className="text-muted-foreground size-4 animate-spin"
              aria-label="Đang lưu thứ tự"
            />
          )}
          {canCreate && (
            <Button onClick={() => setForm({ open: true, category: null })}>
              <Plus aria-hidden="true" /> Thêm danh mục
            </Button>
          )}
        </div>
      </div>
      {categories.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : order.length === 0 ? (
        <EmptyState title="Chưa có danh mục" />
      ) : (
        <ol className="divide-y">
          {order.map((c, index) => (
            <li
              key={c.id}
              draggable={canUpdate}
              onDragStart={() => setDragId(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = order.findIndex((x) => x.id === dragId)
                setDragId(null)
                if (from >= 0) move(from, index)
              }}
              onDragEnd={() => setDragId(null)}
              className={cn(
                'flex min-h-16 items-center gap-3 px-4 py-2 transition-colors',
                dragId === c.id && 'bg-primary/5 opacity-60'
              )}
            >
              {canUpdate && (
                <GripVertical
                  className="text-muted-foreground size-4 shrink-0 cursor-grab"
                  aria-hidden="true"
                />
              )}
              <span
                className="size-8 shrink-0 rounded-lg"
                style={{ backgroundColor: c.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.name}{' '}
                  <span className="text-muted-foreground text-xs font-normal">({c.code})</span>
                </p>
                <p className="text-muted-foreground text-xs">{c.itemCount} món</p>
              </div>
              {c.isHidden && <StatusBadge tone="neutral">Đang ẩn</StatusBadge>}
              {canUpdate && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={!c.isHidden}
                      onCheckedChange={() => toggleHidden(c)}
                      aria-label={`Hiển thị ${c.name}`}
                    />
                    <span className="hidden sm:inline">Hiển thị</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0 || reorder.isPending}
                    aria-label={`Đưa ${c.name} lên`}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => move(index, index + 1)}
                    disabled={index === order.length - 1 || reorder.isPending}
                    aria-label={`Đưa ${c.name} xuống`}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setForm({ open: true, category: c })}
                    aria-label={`Sửa ${c.name}`}
                  >
                    <Pencil />
                  </Button>
                </>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(c)}
                  aria-label={`Xóa ${c.name}`}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}

      <CategoryFormDialog
        open={form.open}
        category={form.category}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa danh mục?"
        description={
          deleteTarget && deleteTarget.itemCount > 0
            ? `Danh mục đang có ${deleteTarget.itemCount} món, chuyển món sang danh mục khác trước khi xóa.`
            : `Danh mục ${deleteTarget?.name} sẽ bị xóa.`
        }
        confirmText="Xóa"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  )
}

function CategoryFormDialog({
  open,
  category,
  onOpenChange,
}: {
  open: boolean
  category: CategoryDto | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveCategory()
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { code: '', name: '', color: SWATCHES[0], isHidden: false },
  })
  const { errors } = form.formState
  const [color, isHidden] = useWatch({ control: form.control, name: ['color', 'isHidden'] })

  useEffect(() => {
    if (open)
      form.reset(
        category
          ? {
              code: category.code,
              name: category.name,
              color: category.color,
              isHidden: category.isHidden,
            }
          : { code: '', name: '', color: SWATCHES[0], isHidden: false }
      )
  }, [open, category, form])

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { id: category?.id, input: { ...values, code: values.code.toUpperCase() } },
      {
        onSuccess: (saved) => {
          toast.success(category ? `Đã lưu ${saved.name}` : `Đã thêm danh mục ${saved.name}`)
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
          <DialogTitle>{category ? 'Sửa danh mục' : 'Thêm danh mục'}</DialogTitle>
          <DialogDescription>
            Màu dùng cho chấm nhãn và ô ảnh mặc định của món chưa có ảnh.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
            <FormField label="Mã" required error={errors.code?.message}>
              <Input className="uppercase" {...form.register('code')} />
            </FormField>
            <FormField label="Tên danh mục" required error={errors.name?.message}>
              <Input {...form.register('name')} />
            </FormField>
          </div>
          <FormField label="Màu" required error={errors.color?.message}>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    form.setValue('color', s, { shouldDirty: true, shouldValidate: true })
                  }
                  className={cn(
                    'focus-visible:ring-ring/50 size-9 rounded-lg ring-offset-2 outline-none focus-visible:ring-3',
                    color.toUpperCase() === s && 'ring-foreground ring-2'
                  )}
                  style={{ backgroundColor: s }}
                  aria-label={`Chọn màu ${s}`}
                  aria-pressed={color.toUpperCase() === s}
                />
              ))}
              <Input
                className="w-28 font-mono uppercase"
                {...form.register('color')}
                aria-label="Mã màu"
              />
            </div>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={!isHidden}
              onCheckedChange={(v) => form.setValue('isHidden', !v, { shouldDirty: true })}
            />
            Hiển thị trên màn bán hàng
          </label>
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
