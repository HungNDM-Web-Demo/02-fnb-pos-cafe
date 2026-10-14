'use client'

import { useMemo, useState } from 'react'
import { Ban, Loader2, Minus, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { useSetToppingAvailability } from '@/features/menu-items/hooks/use-menu'
import type { MenuBundle, MenuItemDto } from '@/features/menu-items/types/menu.types'
import {
  ICE_LEVELS,
  SUGAR_LEVELS,
  iceLevelLabels,
  type CartLineInput,
  type IceLevel,
  type SugarLevel,
} from '@/features/orders/types/order.types'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CartLine } from '../types/pos.types'
import { MenuImage } from './MenuImage'
import { OptionChip } from './OptionChip'

type ItemOptionsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MenuItemDto | null
  menu: MenuBundle
  /** Có dòng là sửa dòng trong giỏ (UC-04 6a) */
  line?: CartLine | null
  onSubmit: (input: CartLineInput) => void
}

type Draft = {
  sizeName: string
  toppingIds: string[]
  sugarLevel: SugarLevel
  iceLevel: IceLevel
  note: string
  quantity: number
}

function draftOf(item: MenuItemDto, line?: CartLine | null): Draft {
  const defaultSize = item.sizes.find((s) => s.isDefault) ?? item.sizes[0]
  return {
    sizeName: line?.sizeName ?? defaultSize?.name ?? '',
    toppingIds: line?.toppingIds ?? [],
    sugarLevel: line?.sugarLevel ?? 100,
    iceLevel: line?.iceLevel ?? 'Vua',
    note: line?.note ?? '',
    quantity: line?.quantity ?? 1,
  }
}

/**
 * SCR-03 Hộp tùy chọn món (FR-08): size, topping nhiều, mức đường, mức đá, ghi chú, số lượng,
 * thành tiền tạm tính theo BR-01. Topping tạm hết hiện mờ, không chọn được (TC-04); người có
 * quyền báo tạm hết bấm biểu tượng cạnh topping để đổi trạng thái (UC-02 1b).
 */
export function ItemOptionsDialog({
  open,
  onOpenChange,
  item,
  menu,
  line,
  onSubmit,
}: ItemOptionsDialogProps) {
  const { can } = usePermissions()
  const canAvailability = can(permissions.menuItems.availability)
  const toppingAvailability = useSetToppingAvailability()
  const [draft, setDraft] = useState<Draft | null>(null)

  // Khởi tạo nháp mỗi lần mở hộp hoặc đổi món/dòng (đặt lại state trong lúc render)
  const draftKey = open && item ? `${item.id}:${line?.key ?? 'new'}` : null
  const [forKey, setForKey] = useState<string | null>(null)
  if (draftKey !== forKey) {
    setForKey(draftKey)
    setDraft(draftKey && item ? draftOf(item, line) : null)
  }

  const toppings = useMemo(
    () => (item ? menu.toppings.filter((t) => item.toppingIds.includes(t.id)) : []),
    [item, menu.toppings]
  )
  const color = menu.categories.find((c) => c.id === item?.categoryId)?.color

  if (!item || !draft) return <Dialog open={open} onOpenChange={onOpenChange} />

  const size = item.sizes.find((s) => s.name === draft.sizeName) ?? item.sizes[0]
  const toppingTotal = draft.toppingIds.reduce(
    (s, id) => s + (toppings.find((t) => t.id === id)?.price ?? 0),
    0
  )
  const unitPrice = (size?.price ?? 0) + toppingTotal
  const lineTotal = unitPrice * draft.quantity
  const hasSoldOutTopping = draft.toppingIds.some(
    (id) => toppings.find((t) => t.id === id)?.isSoldOut
  )

  const toggleTopping = (id: string) =>
    setDraft(
      (d) =>
        d && {
          ...d,
          toppingIds: d.toppingIds.includes(id)
            ? d.toppingIds.filter((x) => x !== id)
            : [...d.toppingIds, id],
        }
    )

  const toggleToppingAvailability = (id: string, isSoldOut: boolean) => {
    toppingAvailability.mutate(
      { id, isSoldOut },
      {
        onSuccess: () => {
          const name = toppings.find((t) => t.id === id)?.name
          toast.success(isSoldOut ? `Đã báo ${name} tạm hết` : `${name} bán lại`)
          if (isSoldOut)
            setDraft((d) => d && { ...d, toppingIds: d.toppingIds.filter((x) => x !== id) })
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const submit = () => {
    if (!size) return
    onSubmit({
      menuItemId: item.id,
      sizeName: size.name,
      quantity: draft.quantity,
      toppingIds: draft.toppingIds,
      sugarLevel: item.hasSugarOption ? draft.sugarLevel : undefined,
      iceLevel: item.hasIceOption ? draft.iceLevel : undefined,
      note: draft.note.trim() || undefined,
      discount: line?.discount,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="flex-row items-center gap-4 border-b px-5 py-4 text-left">
          <MenuImage
            imageUrl={item.imageUrl}
            name={item.name}
            color={color}
            className="size-16 shrink-0 rounded-lg"
            textClassName="text-lg"
          />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">{item.name}</DialogTitle>
            <DialogDescription className="truncate">
              {item.code}
              {item.description ? ` · ${item.description}` : ''}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-15rem)] space-y-5 overflow-y-auto px-5 py-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Size</legend>
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
              role="radiogroup"
              aria-label="Size"
            >
              {item.sizes.map((s) => (
                <OptionChip
                  key={s.id}
                  selected={draft.sizeName === s.name}
                  onClick={() => setDraft({ ...draft, sizeName: s.name })}
                  hint={formatVnd(s.price)}
                >
                  {s.name}
                </OptionChip>
              ))}
            </div>
          </fieldset>

          {toppings.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">
                Topping <span className="text-muted-foreground font-normal">(chọn nhiều)</span>
              </legend>
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                role="group"
                aria-label="Topping"
              >
                {toppings.map((t) => {
                  const selected = draft.toppingIds.includes(t.id)
                  const pending =
                    toppingAvailability.isPending && toppingAvailability.variables?.id === t.id
                  return (
                    <div key={t.id} className="relative">
                      <OptionChip
                        multiple
                        selected={selected}
                        disabled={t.isSoldOut}
                        onClick={() => toggleTopping(t.id)}
                        hint={t.isSoldOut ? 'Tạm hết' : `+${formatVnd(t.price)}`}
                        className={cn('w-full', canAvailability && 'pr-11')}
                      >
                        {t.name}
                      </OptionChip>
                      {canAvailability && (
                        <button
                          type="button"
                          onClick={() => toggleToppingAvailability(t.id, !t.isSoldOut)}
                          disabled={toppingAvailability.isPending}
                          aria-label={t.isSoldOut ? `Bán lại ${t.name}` : `Báo ${t.name} tạm hết`}
                          title={t.isSoldOut ? 'Bán lại' : 'Báo tạm hết'}
                          className={cn(
                            'absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none',
                            'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-3',
                            t.isSoldOut && 'text-success'
                          )}
                        >
                          {pending ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : t.isSoldOut ? (
                            <RotateCcw className="size-4" aria-hidden="true" />
                          ) : (
                            <Ban className="size-4" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </fieldset>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {item.hasSugarOption && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Mức đường</legend>
                <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Mức đường">
                  {SUGAR_LEVELS.map((level) => (
                    <OptionChip
                      key={level}
                      selected={draft.sugarLevel === level}
                      onClick={() => setDraft({ ...draft, sugarLevel: level })}
                      className="px-1"
                    >
                      {level}%
                    </OptionChip>
                  ))}
                </div>
              </fieldset>
            )}
            {item.hasIceOption && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Mức đá</legend>
                <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Mức đá">
                  {ICE_LEVELS.map((level) => (
                    <OptionChip
                      key={level}
                      selected={draft.iceLevel === level}
                      onClick={() => setDraft({ ...draft, iceLevel: level })}
                      className="px-1"
                    >
                      {iceLevelLabels[level]}
                    </OptionChip>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">Ghi chú</span>
              <Textarea
                rows={2}
                maxLength={200}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="vd: Ít ngọt, để riêng đá"
                className="min-h-11 resize-none"
              />
            </label>
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold">Số lượng</span>
              <div className="flex items-center gap-1" role="group" aria-label="Số lượng">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setDraft({ ...draft, quantity: Math.max(1, draft.quantity - 1) })}
                  disabled={draft.quantity <= 1}
                  aria-label="Giảm số lượng"
                >
                  <Minus />
                </Button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={draft.quantity}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      quantity: Math.min(99, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                  aria-label="Số lượng"
                  className="border-input focus-visible:ring-ring/50 h-11 w-16 rounded-md border text-center text-lg font-semibold tabular-nums outline-none focus-visible:ring-3"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setDraft({ ...draft, quantity: Math.min(99, draft.quantity + 1) })}
                  disabled={draft.quantity >= 99}
                  aria-label="Tăng số lượng"
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 flex-row items-center justify-between gap-3 border-t px-5 py-3 sm:justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Thành tiền </span>
            <span className="text-lg font-semibold tabular-nums">{formatVnd(lineTotal)}</span>
            {draft.quantity > 1 && (
              <span className="text-muted-foreground">
                {' '}
                ({formatVnd(unitPrice)} × {draft.quantity})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              variant="cta"
              size="lg"
              onClick={submit}
              disabled={!size || hasSoldOutTopping}
              className="min-w-36"
            >
              {line ? 'Lưu dòng' : 'Thêm vào đơn'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
