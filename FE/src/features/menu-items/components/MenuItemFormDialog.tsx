'use client'

import { useEffect, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Loader2, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MenuImage } from '@/features/pos/components/MenuImage'
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSaveMenuItem } from '../hooks/use-menu'
import { menuItemSchema, type MenuItemFormValues } from '../schemas/menu.schema'
import type { CategoryDto, MenuItemDto, ToppingDto } from '../types/menu.types'

type MenuItemFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MenuItemDto | null
  categories: CategoryDto[]
  toppings: ToppingDto[]
  defaultCategoryId?: string
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function toValues(item: MenuItemDto | null, defaultCategoryId?: string): MenuItemFormValues {
  if (!item) {
    return {
      code: '',
      name: '',
      categoryId: defaultCategoryId ?? '',
      description: '',
      hasSugarOption: true,
      hasIceOption: true,
      sizes: [
        { name: 'M', price: 0, isDefault: true },
        { name: 'L', price: 0, isDefault: false },
      ],
      toppingIds: [],
    }
  }
  return {
    code: item.code,
    name: item.name,
    categoryId: item.categoryId,
    description: item.description ?? '',
    hasSugarOption: item.hasSugarOption,
    hasIceOption: item.hasIceOption,
    sizes: item.sizes.map((s) => ({ name: s.name, price: s.price, isDefault: s.isDefault })),
    toppingIds: item.toppingIds,
  }
}

/** UC-01 thêm/sửa món: size + giá, topping được phép, tùy chọn đường/đá, ảnh (POST /image). Mã trùng báo tại ô mã (TC-02). */
export function MenuItemFormDialog({
  open,
  onOpenChange,
  item,
  categories,
  toppings,
  defaultCategoryId,
}: MenuItemFormDialogProps) {
  const save = useSaveMenuItem()
  const fileRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const form = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: toValues(null),
  })
  const sizes = useFieldArray({ control: form.control, name: 'sizes' })
  const { errors } = form.formState

  useEffect(() => {
    if (open) form.reset(toValues(item, defaultCategoryId))
  }, [open, item, defaultCategoryId, form])

  // Mỗi lần mở hộp bỏ ảnh đã chọn trước đó (đặt lại state trong lúc render)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setImage(null)
      setPreview(null)
    }
  }

  // Thu hồi object URL của ảnh xem trước khi đổi ảnh hoặc đóng hộp
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const pickImage = (file: File | undefined) => {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) return toast.error('Chỉ nhận ảnh JPG, PNG hoặc WebP')
    if (file.size > 2 * 1024 * 1024) return toast.error('Ảnh tối đa 2 MB')
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const setDefaultSize = (index: number) => {
    form
      .getValues('sizes')
      .forEach((_, i) => form.setValue(`sizes.${i}.isDefault`, i === index, { shouldDirty: true }))
  }

  const onSubmit = form.handleSubmit((values) => {
    const hasDefault = values.sizes.some((s) => s.isDefault)
    save.mutate(
      {
        id: item?.id,
        input: {
          code: values.code.trim().toUpperCase(),
          name: values.name.trim(),
          categoryId: values.categoryId,
          description: values.description.trim() || undefined,
          hasSugarOption: values.hasSugarOption,
          hasIceOption: values.hasIceOption,
          sizes: values.sizes.map((s, i) => ({
            name: s.name.trim(),
            price: s.price,
            isDefault: hasDefault ? s.isDefault : i === 0,
          })),
          toppingIds: values.toppingIds,
        },
        image,
      },
      {
        onSuccess: (saved) => {
          toast.success(item ? `Đã lưu món ${saved.name}` : `Đã thêm món ${saved.name}`)
          onOpenChange(false)
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
        },
      }
    )
  })

  const [watchCategoryId, selectedToppings, watchName, watchSizes] = useWatch({
    control: form.control,
    name: ['categoryId', 'toppingIds', 'name', 'sizes'],
  })
  const color = categories.find((c) => c.id === watchCategoryId)?.color

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{item ? `Sửa món ${item.code}` : 'Thêm món'}</DialogTitle>
          <DialogDescription>Hóa đơn cũ giữ nguyên giá lúc bán khi bạn đổi giá.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="grid max-h-[calc(100dvh-14rem)] gap-5 overflow-y-auto px-6 py-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <span className="text-sm font-medium">Ảnh món</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group focus-visible:ring-ring/50 relative block w-full overflow-hidden rounded-xl border outline-none focus-visible:ring-3"
                aria-label="Chọn ảnh món"
              >
                <MenuImage
                  imageUrl={preview ?? item?.imageUrl}
                  name={watchName || 'Món'}
                  color={color}
                  className="aspect-square w-full"
                />
                <span className="bg-foreground/55 text-background absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1.5 text-xs font-medium">
                  <ImagePlus className="size-3.5" aria-hidden="true" />
                  {item?.imageUrl || preview ? 'Đổi ảnh' : 'Tải ảnh'}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
              <p className="text-muted-foreground text-xs">JPG, PNG, WebP tối đa 2 MB.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Mã món" required error={errors.code?.message} hint="vd: M041">
                <Input autoComplete="off" className="uppercase" {...form.register('code')} />
              </FormField>
              <FormField label="Danh mục" required error={errors.categoryId?.message}>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn danh mục" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField
                label="Tên món"
                required
                error={errors.name?.message}
                className="sm:col-span-2"
              >
                <Input
                  autoComplete="off"
                  placeholder="vd: Trà đào cam sả"
                  {...form.register('name')}
                />
              </FormField>
              <FormField
                label="Mô tả"
                error={errors.description?.message}
                className="sm:col-span-2"
              >
                <Textarea rows={2} {...form.register('description')} />
              </FormField>
              <div className="flex flex-wrap gap-6 sm:col-span-2">
                <Controller
                  control={form.control}
                  name="hasSugarOption"
                  render={({ field }) => (
                    <label className="flex min-h-10 items-center gap-2 text-sm">
                      <Switch checked={field.value} onCheckedChange={field.onChange} /> Có chọn mức
                      đường
                    </label>
                  )}
                />
                <Controller
                  control={form.control}
                  name="hasIceOption"
                  render={({ field }) => (
                    <label className="flex min-h-10 items-center gap-2 text-sm">
                      <Switch checked={field.value} onCheckedChange={field.onChange} /> Có chọn mức
                      đá
                    </label>
                  )}
                />
              </div>
            </div>

            <fieldset className="sm:col-span-2">
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
                <span>
                  Size và giá <span className="text-destructive">*</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    sizes.append({ name: '', price: 0, isDefault: sizes.fields.length === 0 })
                  }
                >
                  <Plus aria-hidden="true" />
                  Thêm size
                </Button>
              </legend>
              {errors.sizes?.message && (
                <p className="text-destructive mb-2 text-[0.8125rem]" role="alert">
                  {errors.sizes.message}
                </p>
              )}
              {errors.sizes?.root?.message && (
                <p className="text-destructive mb-2 text-[0.8125rem]" role="alert">
                  {errors.sizes.root.message}
                </p>
              )}
              <div className="space-y-2">
                {sizes.fields.map((field, index) => {
                  const isDefault = !!watchSizes?.[index]?.isDefault
                  const sizeErrors = errors.sizes?.[index]
                  return (
                    <div
                      key={field.id}
                      className="grid grid-cols-[6rem_minmax(0,1fr)_auto_auto] items-start gap-2"
                    >
                      <div>
                        <Input
                          placeholder="Tên size"
                          aria-label={`Tên size ${index + 1}`}
                          aria-invalid={!!sizeErrors?.name || undefined}
                          {...form.register(`sizes.${index}.name`)}
                        />
                        {sizeErrors?.name && (
                          <p className="text-destructive mt-1 text-xs">{sizeErrors.name.message}</p>
                        )}
                      </div>
                      <div>
                        <Controller
                          control={form.control}
                          name={`sizes.${index}.price`}
                          render={({ field: f }) => (
                            <MoneyInput
                              value={f.value || null}
                              onChange={(v) => f.onChange(v ?? 0)}
                              aria-label={`Giá size ${index + 1}`}
                              aria-invalid={!!sizeErrors?.price || undefined}
                            />
                          )}
                        />
                        {sizeErrors?.price && (
                          <p className="text-destructive mt-1 text-xs">
                            {sizeErrors.price.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant={isDefault ? 'secondary' : 'ghost'}
                        onClick={() => setDefaultSize(index)}
                        aria-pressed={isDefault}
                        className={cn(isDefault && 'text-primary')}
                        title="Size mặc định"
                      >
                        <Star className={cn(isDefault && 'fill-current')} aria-hidden="true" />
                        <span className="hidden sm:inline">Mặc định</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => sizes.remove(index)}
                        disabled={sizes.fields.length <= 1}
                        aria-label={`Xóa size ${index + 1}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">
                Topping được chọn{' '}
                <span className="text-muted-foreground font-normal">
                  ({selectedToppings.length})
                </span>
              </legend>
              <Controller
                control={form.control}
                name="toppingIds"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {toppings.map((t) => {
                      const checked = field.value.includes(t.id)
                      return (
                        <label
                          key={t.id}
                          className={cn(
                            'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                            checked ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/60'
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              field.onChange(
                                v ? [...field.value, t.id] : field.value.filter((x) => x !== t.id)
                              )
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">{t.name}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {formatVnd(t.price)}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              />
            </fieldset>
          </div>

          <DialogFooter className="bg-muted/30 border-t px-6 py-4">
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
              {item ? 'Lưu thay đổi' : 'Thêm món'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
