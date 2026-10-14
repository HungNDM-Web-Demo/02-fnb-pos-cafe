'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { useMenuBundle } from '@/features/menu-items/hooks/use-menu'
import type { MenuItemDto } from '@/features/menu-items/types/menu.types'
import { useHeldOrders, useHoldOrder } from '@/features/orders/hooks/use-orders'
import type {
  CartLineInput,
  DiscountApprovalDto,
  HeldOrderDto,
  ManualDiscount,
  OrderDto,
} from '@/features/orders/types/order.types'
import { useActivePromotions, useCheckVoucher } from '@/features/promotions/hooks/use-promotions'
import { OpenShiftDialog } from '@/features/shifts/components/OpenShiftDialog'
import { useCurrentShift } from '@/features/shifts/hooks/use-shifts'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { AvailabilityDialog } from '../components/AvailabilityDialog'
import { CartPanel } from '../components/CartPanel'
import { CheckoutDialog } from '../components/CheckoutDialog'
import { CustomerDialog } from '../components/CustomerDialog'
import { DiscountDialog } from '../components/DiscountDialog'
import { HeldOrdersSheet } from '../components/HeldOrdersSheet'
import { HoldOrderDialog } from '../components/HoldOrderDialog'
import { ItemOptionsDialog } from '../components/ItemOptionsDialog'
import { ManagerApprovalDialog } from '../components/ManagerApprovalDialog'
import { MenuGrid } from '../components/MenuGrid'
import { PosShell } from '../components/PosShell'
import { VoucherDialog } from '../components/VoucherDialog'
import { resolveLine, useCartPricing } from '../hooks/use-cart-pricing'
import { priceCart, type PricingLineInput } from '../lib/pricing'
import { toCartInput, useCartStore } from '../stores/cart.store'
import type { CartLine } from '../types/pos.types'

type OptionsTarget = { item: MenuItemDto; line: CartLine | null }
type DiscountTarget = { kind: 'order' } | { kind: 'line'; line: CartLine }
type ApprovalPending = { requested: number; limit: number; apply: () => void }

/**
 * SCR-02 Bán hàng (UC-02, UC-04, UC-05, UC-06, UC-07): lưới món + giỏ hàng, tối ưu tablet ngang
 * 1280×800. Tính tiền tại máy bằng pricing.ts; khóa khi chưa mở ca (TC-06, TC-07).
 */
export function PosPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const canDiscount = can(permissions.orders.discount)

  const menu = useMenuBundle()
  const promotions = useActivePromotions()
  const shift = useCurrentShift()
  const hasShift = !!shift.data
  const held = useHeldOrders({ enabled: hasShift })
  const holdOrder = useHoldOrder()
  const checkVoucher = useCheckVoucher()
  const pricing = useCartPricing(menu.data, promotions.data)

  const lines = useCartStore((s) => s.lines)
  const addLine = useCartStore((s) => s.addLine)
  const updateLine = useCartStore((s) => s.updateLine)
  const setLineDiscount = useCartStore((s) => s.setLineDiscount)
  const setOrderDiscount = useCartStore((s) => s.setOrderDiscount)
  const setVoucher = useCartStore((s) => s.setVoucher)
  const setCustomer = useCartStore((s) => s.setCustomer)
  const setApproval = useCartStore((s) => s.setApproval)
  const loadHeld = useCartStore((s) => s.loadHeld)
  const clearCart = useCartStore((s) => s.clear)

  const [openShift, setOpenShift] = useState(false)
  const [options, setOptions] = useState<OptionsTarget | null>(null)
  const [availabilityItem, setAvailabilityItem] = useState<MenuItemDto | null>(null)
  const [discountTarget, setDiscountTarget] = useState<DiscountTarget | null>(null)
  const [approvalPending, setApprovalPending] = useState<ApprovalPending | null>(null)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  // Vào màn bán hàng khi chưa có ca: hiện hộp Mở ca một lần (UC-03 bước 1)
  const promptedShift = useRef(false)
  useEffect(() => {
    if (shift.isSuccess && shift.data === null && !promptedShift.current) {
      promptedShift.current = true
      setOpenShift(true)
    }
    if (shift.data) promptedShift.current = false
  }, [shift.isSuccess, shift.data])

  const locked = shift.isSuccess && !shift.data

  // ───────── Thêm, sửa dòng ─────────
  const handleSelectItem = (item: MenuItemDto) => {
    const noOptions =
      item.sizes.length === 1 &&
      item.toppingIds.length === 0 &&
      !item.hasSugarOption &&
      !item.hasIceOption
    if (noOptions) {
      // UC-04 2a: món không có tùy chọn thì chạm một lần là vào giỏ
      addLine({ menuItemId: item.id, sizeName: item.sizes[0].name, quantity: 1, toppingIds: [] })
      return
    }
    setOptions({ item, line: null })
  }

  const handleEditLine = (line: CartLine) => {
    const item = menu.data?.items.find((m) => m.id === line.menuItemId)
    if (!item) return toast.error('Món không còn trong thực đơn, hãy xóa dòng này.')
    setOptions({ item, line })
  }

  const handleOptionsSubmit = (input: CartLineInput) => {
    if (options?.line) updateLine(options.line.key, input)
    else addLine(input)
  }

  // ───────── Giảm giá và duyệt vượt hạn mức (BR-04, FR-15) ─────────
  const currentInputs = useCallback((): PricingLineInput[] => {
    if (!menu.data) return []
    return lines
      .map((l) => resolveLine(l, menu.data!)?.input)
      .filter((x): x is PricingLineInput => !!x)
  }, [lines, menu.data])

  const approvalValid = () => {
    const approval = useCartStore.getState().approval
    return !!approval && new Date(approval.expiresAt).getTime() > Date.now()
  }

  /** Thử áp giảm giá: trong hạn mức áp ngay, vượt thì mở hộp quản lý xác nhận rồi mới áp */
  const tryApplyDiscount = (target: DiscountTarget, discount: ManualDiscount | null) => {
    const state = useCartStore.getState()
    const inputs = currentInputs().map((input) =>
      target.kind === 'line' && input.key === target.line.key
        ? { ...input, discount: discount ?? undefined }
        : input
    )
    const preview = priceCart({
      lines: inputs,
      orderDiscount: target.kind === 'order' ? discount : state.orderDiscount,
      voucher: state.voucher,
      promotions: promotions.data ?? [],
      at: new Date(),
    })
    const apply = () => {
      if (target.kind === 'order') setOrderDiscount(discount)
      else setLineDiscount(target.line.key, discount)
      setDiscountTarget(null)
      toast.success(
        discount
          ? `Đã giảm ${formatVnd(target.kind === 'order' ? (preview.orderDiscount?.amount ?? 0) : (preview.lines.find((l) => l.key === target.line.key)?.discount?.amount ?? 0))}`
          : 'Đã bỏ giảm giá'
      )
    }
    if (preview.needsApproval && !approvalValid()) {
      setApprovalPending({ requested: preview.manualDiscount, limit: preview.discountLimit, apply })
      return
    }
    apply()
  }

  const handleApproved = (approval: DiscountApprovalDto) => {
    setApproval({
      token: approval.token,
      approvedByName: approval.approvedByName,
      expiresAt: approval.expiresAt,
    })
    toast.success(`Quản lý ${approval.approvedByName} đã xác nhận`)
    approvalPending?.apply()
    setApprovalPending(null)
  }

  // ───────── Giữ đơn, mở lại ─────────
  const heldCount = held.data?.length ?? 0

  const confirmHold = (holdName: string) => {
    const state = useCartStore.getState()
    holdOrder.mutate(
      { id: state.heldOrderId, request: { ...toCartInput(state), holdName } },
      {
        onSuccess: (saved) => {
          toast.success(`Đã giữ ${saved.holdName}`)
          clearCart()
          setHoldOpen(false)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const reopenHeld = (order: HeldOrderDto) => {
    loadHeld(order)
    if (order.voucher) {
      checkVoucher.mutate(
        { code: order.voucher.code, subtotal: order.subtotal },
        {
          onSuccess: (v) => setVoucher(v),
          onError: (error) =>
            toast.warning(
              `Voucher ${order.voucher?.code} không còn áp được: ${getErrorMessage(error)}`
            ),
        }
      )
    }
    if (order.hasUnavailableItems) {
      toast.warning('Đơn có món vừa tạm hết', {
        description: 'Xóa dòng được đánh dấu hoặc bán lại món trước khi thanh toán.',
      })
    } else {
      toast.success(`Đã mở lại ${order.holdName}`)
    }
  }

  // ───────── Thanh toán ─────────
  const openCheckout = () => {
    if (pricing.needsApproval && !approvalValid()) {
      setApprovalPending({
        requested: pricing.manualDiscount,
        limit: pricing.discountLimit,
        apply: () => setCheckoutOpen(true),
      })
      return
    }
    setCheckoutOpen(true)
  }

  const handlePaid = (order: OrderDto) => {
    clearCart()
    const change = order.payment?.changeAmount
    toast.success(`Đã thanh toán ${order.code}`, {
      description: change ? `Tiền thối ${formatVnd(change)}` : undefined,
    })
    router.push(`${routePath.posReceipt(order.id)}?print=1`)
  }

  const discountBase = useMemo(() => {
    if (!discountTarget) return 0
    if (discountTarget.kind === 'order')
      return pricing.subtotal - pricing.lineDiscountTotal - pricing.itemPromotionDiscount
    return pricing.lines.find((l) => l.key === discountTarget.line.key)?.lineTotal ?? 0
  }, [discountTarget, pricing])

  const discountTitle =
    discountTarget?.kind === 'line'
      ? `Giảm giá dòng: ${menu.data?.items.find((m) => m.id === discountTarget.line.menuItemId)?.name ?? ''}`
      : 'Giảm giá hóa đơn'

  return (
    <PermissionGuard permission={permissions.orders.create} redirect>
      <PosShell shift={shift.data} heldCount={heldCount} onOpenHeld={() => setHeldOpen(true)}>
        {menu.error ? (
          <ErrorState error={menu.error} onRetry={() => void menu.refetch()} />
        ) : (
          <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_25rem] gap-3">
            <MenuGrid
              menu={menu.data}
              isLoading={menu.isLoading}
              locked={locked}
              onOpenShift={() => setOpenShift(true)}
              onSelect={handleSelectItem}
              onLongPress={
                can(permissions.menuItems.availability) ? setAvailabilityItem : undefined
              }
            />
            <CartPanel
              menu={menu.data}
              pricing={pricing}
              locked={locked}
              canDiscount={canDiscount}
              onEditLine={handleEditLine}
              onLineDiscount={(line) => setDiscountTarget({ kind: 'line', line })}
              onOrderDiscount={() => setDiscountTarget({ kind: 'order' })}
              onVoucher={() => setVoucherOpen(true)}
              onCustomer={() => setCustomerOpen(true)}
              onHold={() => setHoldOpen(true)}
              onClear={() => setClearOpen(true)}
              onCheckout={openCheckout}
            />
          </div>
        )}
      </PosShell>

      <OpenShiftDialog open={openShift} onOpenChange={setOpenShift} />

      {menu.data && (
        <ItemOptionsDialog
          open={!!options}
          onOpenChange={(open) => !open && setOptions(null)}
          item={options?.item ?? null}
          line={options?.line}
          menu={menu.data}
          onSubmit={handleOptionsSubmit}
        />
      )}

      <AvailabilityDialog
        item={availabilityItem}
        onOpenChange={(open) => !open && setAvailabilityItem(null)}
      />

      <DiscountDialog
        open={!!discountTarget}
        onOpenChange={(open) => !open && setDiscountTarget(null)}
        title={discountTitle}
        base={discountBase}
        limitHint={`Thu ngân tự giảm tối đa ${formatVnd(pricing.discountLimit)}, vượt mức cần quản lý xác nhận.`}
        current={
          discountTarget?.kind === 'line'
            ? discountTarget.line.discount
            : discountTarget
              ? useCartStore.getState().orderDiscount
              : null
        }
        onSubmit={(discount) => discountTarget && tryApplyDiscount(discountTarget, discount)}
      />

      <ManagerApprovalDialog
        open={!!approvalPending}
        onOpenChange={(open) => !open && setApprovalPending(null)}
        requested={approvalPending?.requested ?? 0}
        limit={approvalPending?.limit ?? 0}
        onApproved={handleApproved}
      />

      <VoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        subtotal={pricing.subtotal}
        current={useCartStore.getState().voucher}
        onApply={(v) => {
          setVoucher(v)
          if (v) toast.success(`Đã áp voucher ${v.code}`)
        }}
      />

      <CustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        current={useCartStore.getState().customer}
        onSelect={setCustomer}
      />

      <HeldOrdersSheet open={heldOpen} onOpenChange={setHeldOpen} onReopen={reopenHeld} />

      <HoldOrderDialog
        open={holdOpen}
        onOpenChange={setHoldOpen}
        defaultName={useCartStore.getState().holdName ?? `Đơn ${heldCount + 1}`}
        pending={holdOrder.isPending}
        onConfirm={confirmHold}
      />

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        pricing={pricing}
        onSuccess={handlePaid}
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        variant="destructive"
        icon={Trash2}
        title="Xóa cả đơn?"
        description="Mọi món trong giỏ, giảm giá và voucher đang áp sẽ bị bỏ."
        confirmText="Xóa đơn"
        onConfirm={() => {
          clearCart()
          toast.success('Đã xóa đơn')
        }}
      />
    </PermissionGuard>
  )
}
