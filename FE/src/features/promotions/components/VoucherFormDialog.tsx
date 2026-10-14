'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
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
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { OptionChip } from '@/features/pos/components/OptionChip'
import { localDateKey } from '@/features/pos/lib/pricing'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { useSaveVoucher } from '../hooks/use-promotions'
import {
  voucherSchema,
  type VoucherFormInput,
  type VoucherFormValues,
} from '../schemas/promotion.schema'
import type { VoucherDto } from '../types/promotion.types'

function toValues(v: VoucherDto | null): VoucherFormInput {
  return {
    code: v?.code ?? '',
    description: v?.description ?? '',
    discountType: v?.discountType ?? 'SoTien',
    discountValue: v?.discountValue ?? 10000,
    maxDiscount: v?.maxDiscount ?? null,
    minOrderAmount: v?.minOrderAmount ?? 0,
    maxUses: v?.maxUses ?? null,
    expiresDate: v?.expiresAt ? localDateKey(new Date(v.expiresAt)) : '',
  }
}

/** UC-13 thêm/sửa voucher (FR-27): mã, kiểu, giá trị, giảm tối đa, đơn tối thiểu, số lượt, hạn dùng. */
export function VoucherFormDialog({
  open,
  voucher,
  onOpenChange,
}: {
  open: boolean
  voucher: VoucherDto | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveVoucher()
  const form = useForm<VoucherFormInput, unknown, VoucherFormValues>({
    resolver: zodResolver(voucherSchema),
    defaultValues: toValues(null),
  })
  const { errors } = form.formState
  const discountType = useWatch({ control: form.control, name: 'discountType' })

  useEffect(() => {
    if (open) form.reset(toValues(voucher))
  }, [open, voucher, form])

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: voucher?.id,
        input: {
          code: v.code,
          description: v.description.trim() || undefined,
          discountType: v.discountType,
          discountValue: v.discountValue,
          maxDiscount: v.discountType === 'PhanTram' ? v.maxDiscount || undefined : undefined,
          minOrderAmount: v.minOrderAmount,
          maxUses: v.maxUses || undefined,
          // Hạn dùng tính hết 23:59:59 ngày chọn (giờ máy)
          expiresAt: v.expiresDate
            ? new Date(`${v.expiresDate}T23:59:59`).toISOString()
            : undefined,
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(voucher ? `Đã lưu voucher ${saved.code}` : `Đã tạo voucher ${saved.code}`)
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{voucher ? `Sửa voucher ${voucher.code}` : 'Thêm voucher'}</DialogTitle>
          <DialogDescription>
            Một hóa đơn dùng tối đa một voucher; số lượt chỉ tăng khi thanh toán thành công.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Mã voucher"
            required
            error={errors.code?.message}
            hint={
              voucher ? 'Không đổi được mã, tạo voucher mới nếu cần' : '4–12 ký tự chữ in hoa và số'
            }
          >
            <Input
              className="font-mono uppercase"
              maxLength={12}
              readOnly={!!voucher}
              aria-readonly={!!voucher || undefined}
              {...form.register('code')}
            />
          </FormField>
          <FormField label="Hạn dùng" hint="Bỏ trống là không hạn">
            <Input type="date" {...form.register('expiresDate')} />
          </FormField>
          <FormField label="Mô tả" error={errors.description?.message} className="sm:col-span-2">
            <Input {...form.register('description')} />
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Kiểu giảm</span>
            <Controller
              control={form.control}
              name="discountType"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kiểu giảm">
                  <OptionChip
                    selected={field.value === 'SoTien'}
                    onClick={() => field.onChange('SoTien')}
                  >
                    Số tiền
                  </OptionChip>
                  <OptionChip
                    selected={field.value === 'PhanTram'}
                    onClick={() => field.onChange('PhanTram')}
                  >
                    Phần trăm
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
            <FormField label="Giảm tối đa" hint="Bỏ trống là không giới hạn">
              <Controller
                control={form.control}
                name="maxDiscount"
                render={({ field }) => (
                  <MoneyInput value={field.value ?? null} onChange={field.onChange} />
                )}
              />
            </FormField>
          )}
          <FormField label="Đơn tối thiểu" error={errors.minOrderAmount?.message}>
            <Controller
              control={form.control}
              name="minOrderAmount"
              render={({ field }) => (
                <MoneyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
              )}
            />
          </FormField>
          <FormField
            label="Số lượt tối đa"
            hint="Bỏ trống là không giới hạn"
            error={errors.maxUses?.message}
          >
            <Controller
              control={form.control}
              name="maxUses"
              render={({ field }) => (
                <Input
                  type="number"
                  min={1}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                />
              )}
            />
          </FormField>
          <DialogFooter className="sm:col-span-2">
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
              {voucher ? 'Lưu thay đổi' : 'Thêm voucher'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
