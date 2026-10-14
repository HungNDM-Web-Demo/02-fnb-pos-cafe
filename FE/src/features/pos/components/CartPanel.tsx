'use client'

import {
  AlertTriangle,
  BadgePercent,
  Minus,
  PauseCircle,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  Trash2,
  UserRound,
  Utensils,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MenuBundle } from '@/features/menu-items/types/menu.types'
import { iceLevelLabels, type ServiceType } from '@/features/orders/types/order.types'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CartPricing } from '../hooks/use-cart-pricing'
import { useCartStore } from '../stores/cart.store'
import type { CartLine } from '../types/pos.types'

type CartPanelProps = {
  menu: MenuBundle | undefined
  pricing: CartPricing
  locked?: boolean
  canDiscount: boolean
  onEditLine: (line: CartLine) => void
  onLineDiscount: (line: CartLine) => void
  onOrderDiscount: () => void
  onVoucher: () => void
  onCustomer: () => void
  onHold: () => void
  onClear: () => void
  onCheckout: () => void
}

/**
 * Giỏ hàng (FR-09, FR-10): sửa, xóa dòng; hình thức phục vụ + số thẻ bàn (TC-15); giảm giá, voucher,
 * khuyến mãi tự áp; nút Thanh toán luôn thấy không cần cuộn (NFR-01).
 */
export function CartPanel({
  menu,
  pricing,
  locked,
  canDiscount,
  onEditLine,
  onLineDiscount,
  onOrderDiscount,
  onVoucher,
  onCustomer,
  onHold,
  onClear,
  onCheckout,
}: CartPanelProps) {
  const lines = useCartStore((s) => s.lines)
  const serviceType = useCartStore((s) => s.serviceType)
  const tableTag = useCartStore((s) => s.tableTag)
  const customer = useCartStore((s) => s.customer)
  const voucher = useCartStore((s) => s.voucher)
  const holdName = useCartStore((s) => s.holdName)
  const approval = useCartStore((s) => s.approval)
  const setServiceType = useCartStore((s) => s.setServiceType)
  const setTableTag = useCartStore((s) => s.setTableTag)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const removeLine = useCartStore((s) => s.removeLine)
  const setVoucher = useCartStore((s) => s.setVoucher)
  const setOrderDiscount = useCartStore((s) => s.setOrderDiscount)

  const tableMissing = serviceType === 'TaiCho' && !tableTag.trim()
  const hasUnavailable = pricing.unavailableKeys.size > 0
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0)
  const canCheckout =
    !locked && lines.length > 0 && !tableMissing && !hasUnavailable && pricing.total >= 0
  const pricedByKey = new Map(pricing.lines.map((l) => [l.key, l]))

  return (
    <aside
      className="bg-card flex h-full min-h-0 flex-col rounded-xl border shadow-xs"
      aria-label="Giỏ hàng"
    >
      {/* Hình thức phục vụ */}
      <div className="grid gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <div
            className="bg-muted grid flex-1 grid-cols-2 gap-1 rounded-lg p-1"
            role="radiogroup"
            aria-label="Hình thức phục vụ"
          >
            <ServiceButton
              active={serviceType === 'MangDi'}
              onClick={() => setServiceType('MangDi')}
              icon={ShoppingBag}
              label="Mang đi"
            />
            <ServiceButton
              active={serviceType === 'TaiCho'}
              onClick={() => setServiceType('TaiCho')}
              icon={Utensils}
              label="Tại chỗ"
            />
          </div>
          {serviceType === 'TaiCho' && (
            <div className="w-28">
              <Input
                value={tableTag}
                onChange={(e) => setTableTag(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="Số thẻ bàn"
                aria-label="Số thẻ bàn"
                aria-invalid={tableMissing || undefined}
                className={cn(
                  'h-11 text-center font-semibold uppercase placeholder:text-xs placeholder:font-normal placeholder:normal-case',
                  tableMissing && 'border-destructive ring-destructive/20 ring-3'
                )}
              />
            </div>
          )}
        </div>
        {tableMissing && (
          <p className="text-destructive flex items-center gap-1 text-xs" role="alert">
            <AlertTriangle className="size-3.5" aria-hidden="true" /> Nhập số thẻ bàn để thanh toán
          </p>
        )}
        <div className="flex items-center justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={onCustomer}
            className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left outline-none focus-visible:ring-3"
          >
            <UserRound className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            {customer ? (
              <span className="truncate">
                <span className="font-medium">{customer.name}</span>{' '}
                <span className="text-muted-foreground">· {customer.phone}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Khách lẻ · chạm để tích điểm</span>
            )}
          </button>
          {holdName && (
            <span className="bg-info/10 text-info inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium">
              <PauseCircle className="size-3.5" aria-hidden="true" />
              {holdName}
            </span>
          )}
        </div>
      </div>

      {/* Dòng món */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm">
            <ShoppingBag className="size-8 opacity-40" aria-hidden="true" />
            Chạm vào món để thêm vào đơn
          </div>
        ) : (
          <ul className="divide-y">
            {lines.map((line) => {
              const priced = pricedByKey.get(line.key)
              const item = menu?.items.find((m) => m.id === line.menuItemId)
              const unavailable = pricing.unavailableReasons[line.key]
              const toppingNames = line.toppingIds
                .map((id) => menu?.toppings.find((t) => t.id === id)?.name)
                .filter(Boolean)
              const options = [
                line.sugarLevel !== undefined && item?.hasSugarOption
                  ? `${line.sugarLevel}% đường`
                  : null,
                line.iceLevel && item?.hasIceOption ? iceLevelLabels[line.iceLevel] : null,
                ...toppingNames,
              ].filter(Boolean)
              return (
                <li key={line.key} className={cn('px-3 py-2.5', unavailable && 'bg-destructive/6')}>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onEditLine(line)}
                      className="focus-visible:ring-ring/50 min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3"
                      aria-label={`Sửa ${item?.name ?? 'món'}`}
                    >
                      <p className="flex items-baseline gap-1.5 text-sm leading-snug font-semibold">
                        <span className="truncate">
                          {item?.name ?? 'Món không còn trong thực đơn'}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs font-normal">
                          {line.sizeName}
                        </span>
                      </p>
                      {options.length > 0 && (
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {options.join(' · ')}
                        </p>
                      )}
                      {line.note && (
                        <p className="text-info line-clamp-1 text-xs italic">“{line.note}”</p>
                      )}
                      {priced?.discount && (
                        <p className="text-warning text-xs">
                          Giảm dòng −{formatVnd(priced.discount.amount)} · {priced.discount.reason}
                        </p>
                      )}
                      {priced?.promotion && (
                        <p className="text-success text-xs">
                          <Sparkles className="inline size-3 -translate-y-px" aria-hidden="true" />{' '}
                          {priced.promotion.name} −{formatVnd(priced.promotion.amount)}
                        </p>
                      )}
                      {unavailable && (
                        <p
                          className="text-destructive flex items-center gap-1 text-xs font-medium"
                          role="alert"
                        >
                          <AlertTriangle className="size-3.5" aria-hidden="true" /> {unavailable}
                        </p>
                      )}
                    </button>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatVnd(priced?.lineNet ?? 0)}
                      </p>
                      {priced && priced.lineNet !== priced.lineTotal && (
                        <p className="text-muted-foreground text-xs tabular-nums line-through">
                          {formatVnd(priced.lineTotal)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="size-9"
                      onClick={() => setQuantity(line.key, line.quantity - 1)}
                      aria-label="Giảm số lượng"
                    >
                      <Minus />
                    </Button>
                    <span
                      className="w-8 text-center text-sm font-semibold tabular-nums"
                      aria-live="polite"
                    >
                      {line.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="size-9"
                      onClick={() => setQuantity(line.key, line.quantity + 1)}
                      disabled={line.quantity >= 99}
                      aria-label="Tăng số lượng"
                    >
                      <Plus />
                    </Button>
                    <span className="flex-1" />
                    {canDiscount && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-9"
                        onClick={() => onLineDiscount(line)}
                        aria-label="Giảm giá dòng"
                        title="Giảm giá dòng"
                      >
                        <BadgePercent />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-9"
                      onClick={() => onEditLine(line)}
                      aria-label="Sửa tùy chọn"
                      title="Sửa tùy chọn"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive size-9"
                      onClick={() => removeLine(line.key)}
                      aria-label="Xóa dòng"
                      title="Xóa dòng"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Tổng tiền */}
      <div className="border-t p-3">
        <dl className="grid gap-1 text-sm">
          <Row label={`Tiền hàng (${itemCount} món)`} value={formatVnd(pricing.subtotal)} />
          {pricing.lineDiscountTotal > 0 && (
            <Row
              label="Giảm giá dòng"
              value={`−${formatVnd(pricing.lineDiscountTotal)}`}
              tone="warning"
            />
          )}
          {pricing.itemPromotionDiscount > 0 && (
            <Row
              label="Khuyến mãi món"
              value={`−${formatVnd(pricing.itemPromotionDiscount)}`}
              tone="success"
            />
          )}
          {pricing.orderDiscount && (
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  Giảm giá hóa đơn
                  <span className="text-muted-foreground">
                    (
                    {pricing.orderDiscount.type === 'PhanTram'
                      ? `${pricing.orderDiscount.value}%`
                      : ''}{' '}
                    {pricing.orderDiscount.reason})
                  </span>
                  <button
                    type="button"
                    onClick={() => setOrderDiscount(null)}
                    className="text-muted-foreground hover:text-destructive ml-0.5 rounded p-0.5"
                    aria-label="Bỏ giảm giá hóa đơn"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              }
              value={`−${formatVnd(pricing.orderDiscount.amount)}`}
              tone="warning"
            />
          )}
          {pricing.voucher && (
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <TicketPercent className="size-3.5" aria-hidden="true" /> Voucher{' '}
                  {pricing.voucher.code}
                  <button
                    type="button"
                    onClick={() => setVoucher(null)}
                    className="text-muted-foreground hover:text-destructive ml-0.5 rounded p-0.5"
                    aria-label="Bỏ voucher"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              }
              value={`−${formatVnd(pricing.voucher.amount)}`}
              tone="success"
            />
          )}
          {pricing.promotion && (
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-3.5" aria-hidden="true" /> {pricing.promotion.name}
                </span>
              }
              value={`−${formatVnd(pricing.promotion.amount)}`}
              tone="success"
            />
          )}
          {voucher && pricing.voucherBelowMinimum && (
            <p className="text-warning text-xs">
              Voucher {voucher.code} chưa áp: đơn tối thiểu {formatVnd(voucher.minOrderAmount)}.
            </p>
          )}
          {pricing.skipped && (
            <p className="text-muted-foreground text-xs" role="status">
              {pricing.skipped.kind === 'promotion'
                ? `Khuyến mãi ${pricing.skipped.name} không áp vì voucher giảm nhiều hơn`
                : `Voucher ${pricing.skipped.name} không áp vì khuyến mãi giảm nhiều hơn`}
            </p>
          )}
          {approval && pricing.needsApproval && (
            <p className="text-success flex items-center gap-1 text-xs">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Quản lý{' '}
              {approval.approvedByName} đã duyệt giảm giá vượt hạn mức
            </p>
          )}
        </dl>
        <div className="mt-2 flex items-baseline justify-between border-t pt-2">
          <span className="font-semibold">Tổng thanh toán</span>
          <span
            className="text-primary text-2xl font-bold tracking-tight tabular-nums"
            aria-live="polite"
          >
            {formatVnd(pricing.total)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <ToolButton
            icon={BadgePercent}
            label="Giảm giá"
            onClick={onOrderDiscount}
            disabled={locked || lines.length === 0 || !canDiscount}
          />
          <ToolButton
            icon={TicketPercent}
            label="Voucher"
            onClick={onVoucher}
            disabled={locked || lines.length === 0 || !canDiscount}
            active={!!voucher}
          />
          <ToolButton
            icon={PauseCircle}
            label="Giữ đơn"
            onClick={onHold}
            disabled={locked || lines.length === 0}
          />
          <ToolButton
            icon={Trash2}
            label="Xóa đơn"
            onClick={onClear}
            disabled={lines.length === 0}
            destructive
          />
        </div>
        <Button
          variant="cta"
          size="lg"
          className="mt-2 h-14 w-full text-base font-bold"
          onClick={onCheckout}
          disabled={!canCheckout}
        >
          Thanh toán {lines.length > 0 && `· ${formatVnd(pricing.total)}`}
        </Button>
      </div>
    </aside>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: React.ReactNode
  value: string
  tone?: 'warning' | 'success'
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt
        className={cn(
          'text-muted-foreground',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning'
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning'
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function ServiceButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-colors outline-none focus-visible:ring-3',
        active ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-medium transition-colors outline-none',
        'focus-visible:ring-ring/50 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-45',
        active ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-muted',
        destructive && 'text-destructive hover:bg-destructive/10'
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}

export type { ServiceType }
