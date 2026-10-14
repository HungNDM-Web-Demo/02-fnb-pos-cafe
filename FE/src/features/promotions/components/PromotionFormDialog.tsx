'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useCategories, useMenuBundle } from '@/features/menu-items/hooks/use-menu'
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { OptionChip } from '@/features/pos/components/OptionChip'
import { localDateKey } from '@/features/pos/lib/pricing'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useSavePromotion } from '../hooks/use-promotions'
import { promotionSchema, type PromotionFormValues } from '../schemas/promotion.schema'
import {
  promotionScopeLabels,
  type PromotionDto,
  type PromotionScope,
} from '../types/promotion.types'

const DAYS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 7, label: 'CN' },
]

function toValues(p: PromotionDto | null): PromotionFormValues {
  const today = new Date()
  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  return {
    name: p?.name ?? '',
    description: p?.description ?? '',
    discountType: p?.discountType ?? 'PhanTram',
    discountValue: p?.discountValue ?? 10,
    maxDiscount: p?.maxDiscount ?? null,
    scope: p?.scope ?? 'HoaDon',
    categoryId: p?.categoryId ?? '',
    menuItemIds: p?.menuItemIds ?? [],
    minOrderAmount: p?.minOrderAmount ?? 0,
    startTime: p?.startTime ?? '',
    endTime: p?.endTime ?? '',
    daysOfWeek: p?.daysOfWeek ?? [],
    startDate: p?.startDate ?? localDateKey(today),
    endDate: p?.endDate ?? localDateKey(in30),
  }
}

/** UC-13 thêm/sửa khuyến mãi (FR-26): kiểu giảm, phạm vi, đơn tối thiểu, khung giờ, ngày trong tuần, hiệu lực. */
export function PromotionFormDialog({
  open,
  promotion,
  onOpenChange,
}: {
  open: boolean
  promotion: PromotionDto | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSavePromotion()
  const categories = useCategories({ enabled: open })
  const menu = useMenuBundle({ enabled: open })
  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: toValues(null),
  })
  const { errors } = form.formState
  const [discountType, scope] = useWatch({ control: form.control, name: ['discountType', 'scope'] })

  useEffect(() => {
    if (open) form.reset(toValues(promotion))
  }, [open, promotion, form])

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: promotion?.id,
        input: {
          name: v.name.trim(),
          description: v.description.trim() || undefined,
          discountType: v.discountType,
          discountValue: v.discountValue,
          maxDiscount: v.discountType === 'PhanTram' ? v.maxDiscount || undefined : undefined,
          scope: v.scope,
          categoryId: v.scope === 'DanhMuc' ? v.categoryId : undefined,
          menuItemIds: v.scope === 'Mon' ? v.menuItemIds : [],
          minOrderAmount: v.minOrderAmount,
          startTime: v.startTime || undefined,
          endTime: v.endTime || undefined,
          daysOfWeek: v.daysOfWeek,
          startDate: v.startDate,
          endDate: v.endDate,
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(promotion ? `Đã lưu ${saved.name}` : `Đã tạo khuyến mãi ${saved.code}`)
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {promotion ? `Sửa khuyến mãi ${promotion.code}` : 'Thêm khuyến mãi'}
          </DialogTitle>
          <DialogDescription>
            Khuyến mãi tự áp ở màn bán hàng khi đơn đủ điều kiện; khung giờ xét theo lúc thanh toán.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="grid max-h-[calc(100dvh-14rem)] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <FormField
              label="Tên khuyến mãi"
              required
              error={errors.name?.message}
              className="sm:col-span-2"
            >
              <Input placeholder="vd: Giờ vàng trà sữa −15%" {...form.register('name')} />
            </FormField>
            <FormField label="Mô tả" error={errors.description?.message} className="sm:col-span-2">
              <Textarea rows={2} {...form.register('description')} />
            </FormField>

            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Kiểu giảm</span>
              <Controller
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kiểu giảm">
                    <OptionChip
                      selected={field.value === 'PhanTram'}
                      onClick={() => field.onChange('PhanTram')}
                    >
                      Phần trăm
                    </OptionChip>
                    <OptionChip
                      selected={field.value === 'SoTien'}
                      onClick={() => field.onChange('SoTien')}
                    >
                      Số tiền
                    </OptionChip>
                  </div>
                )}
              />
            </div>
            <FormField
              label={discountType === 'PhanTram' ? 'Phần trăm giảm' : 'Số tiền giảm'}
              required
              error={errors.discountValue?.message}
            >
              <Controller
                control={form.control}
                name="discountValue"
                render={({ field }) =>
                  discountType === 'PhanTram' ? (
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  ) : (
                    <MoneyInput
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? 0)}
                    />
                  )
                }
              />
            </FormField>
            {discountType === 'PhanTram' && (
              <FormField label="Giảm tối đa mỗi hóa đơn" hint="Bỏ trống là không giới hạn">
                <Controller
                  control={form.control}
                  name="maxDiscount"
                  render={({ field }) => (
                    <MoneyInput value={field.value} onChange={field.onChange} />
                  )}
                />
              </FormField>
            )}
            <FormField
              label="Đơn tối thiểu"
              hint="0 là không xét"
              error={errors.minOrderAmount?.message}
            >
              <Controller
                control={form.control}
                name="minOrderAmount"
                render={({ field }) => (
                  <MoneyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                )}
              />
            </FormField>

            <FormField label="Phạm vi" required>
              <Controller
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as PromotionScope)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(promotionScopeLabels) as PromotionScope[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {promotionScopeLabels[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {scope === 'DanhMuc' && (
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
                        {(categories.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            )}
            {scope === 'Mon' && (
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-sm font-medium">
                  Món áp dụng <span className="text-destructive">*</span>
                </legend>
                {errors.menuItemIds?.message && (
                  <p className="text-destructive mb-2 text-[0.8125rem]">
                    {errors.menuItemIds.message}
                  </p>
                )}
                <Controller
                  control={form.control}
                  name="menuItemIds"
                  render={({ field }) => (
                    <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                      {(menu.data?.items ?? []).map((m) => (
                        <label
                          key={m.id}
                          className="hover:bg-muted/60 flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm"
                        >
                          <Checkbox
                            checked={field.value.includes(m.id)}
                            onCheckedChange={(v) =>
                              field.onChange(
                                v ? [...field.value, m.id] : field.value.filter((x) => x !== m.id)
                              )
                            }
                          />
                          <span className="truncate">
                            {m.code} · {m.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </fieldset>
            )}

            <FormField label="Hiệu lực từ" required error={errors.startDate?.message}>
              <Input type="date" {...form.register('startDate')} />
            </FormField>
            <FormField label="Đến ngày" required error={errors.endDate?.message}>
              <Input type="date" {...form.register('endDate')} />
            </FormField>
            <FormField label="Khung giờ từ" hint="Bỏ trống là cả ngày">
              <Input type="time" {...form.register('startTime')} />
            </FormField>
            <FormField label="Đến (không gồm)" error={errors.endTime?.message}>
              <Input type="time" {...form.register('endTime')} />
            </FormField>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">
                Ngày trong tuần{' '}
                <span className="text-muted-foreground font-normal">(không chọn là mọi ngày)</span>
              </legend>
              <Controller
                control={form.control}
                name="daysOfWeek"
                render={({ field }) => (
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS.map((d) => {
                      const selected = field.value.includes(d.value)
                      return (
                        <OptionChip
                          key={d.value}
                          multiple
                          selected={selected}
                          onClick={() =>
                            field.onChange(
                              selected
                                ? field.value.filter((x) => x !== d.value)
                                : [...field.value, d.value].sort()
                            )
                          }
                          className={cn('px-1')}
                        >
                          {d.label}
                        </OptionChip>
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
              {promotion ? 'Lưu thay đổi' : 'Thêm khuyến mãi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
