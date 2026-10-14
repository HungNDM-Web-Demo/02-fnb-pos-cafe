import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storageKey } from '@/lib/storage'
import { newId } from '@/mock/mock-helpers'
import type {
  CartLineInput,
  HeldOrderDto,
  ManualDiscount,
  ServiceType,
} from '@/features/orders/types/order.types'
import type { VoucherCheckResult } from '@/features/promotions/types/promotion.types'
import type { CartCustomer, CartState, DiscountApproval } from '../types/pos.types'

/**
 * Giỏ hàng màn bán hàng (07 §4): state Zustand lưu sessionStorage của tab, nên mất kết nối hay
 * tải lại trang vẫn còn giỏ (NFR-05). Gộp dòng giống hệt (TC-14). Mọi thay đổi giỏ đặt lại
 * clientRequestId; hộp thanh toán sinh mã mới khi mở và giữ nguyên khi bấm lại (TC-24).
 */

/** Khóa so sánh "giống hệt": cùng món, size, topping đã sắp xếp, đường, đá, ghi chú */
export function lineIdentity(line: CartLineInput): string {
  return [
    line.menuItemId,
    line.sizeName,
    [...line.toppingIds].sort().join(','),
    line.sugarLevel ?? '',
    line.iceLevel ?? '',
    (line.note ?? '').trim(),
  ].join('|')
}

type CartActions = {
  addLine: (input: CartLineInput) => void
  updateLine: (key: string, input: CartLineInput) => void
  setQuantity: (key: string, quantity: number) => void
  removeLine: (key: string) => void
  setLineDiscount: (key: string, discount: ManualDiscount | null) => void
  setServiceType: (serviceType: ServiceType) => void
  setTableTag: (tableTag: string) => void
  setOrderDiscount: (discount: ManualDiscount | null) => void
  setVoucher: (voucher: VoucherCheckResult | null) => void
  setCustomer: (customer: CartCustomer | null) => void
  setApproval: (approval: DiscountApproval | null) => void
  /** Mở lại đơn giữ: nạp dòng và thông tin đơn vào giỏ */
  loadHeld: (held: HeldOrderDto) => void
  /** Sinh mã yêu cầu khi mở hộp thanh toán (giữ nguyên nếu đã có) */
  ensureClientRequestId: () => string
  clear: () => void
}

const EMPTY: CartState = {
  lines: [],
  serviceType: 'MangDi',
  tableTag: '',
  orderDiscount: null,
  voucher: null,
  customer: null,
  heldOrderId: null,
  holdName: null,
  approval: null,
  clientRequestId: null,
}

const normalize = (input: CartLineInput): CartLineInput => ({
  menuItemId: input.menuItemId,
  sizeName: input.sizeName,
  quantity: Math.min(99, Math.max(1, Math.round(input.quantity))),
  toppingIds: [...new Set(input.toppingIds)].sort(),
  sugarLevel: input.sugarLevel,
  iceLevel: input.iceLevel,
  note: input.note?.trim() || undefined,
  discount: input.discount,
})

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      addLine: (input) => {
        const line = normalize(input)
        const identity = lineIdentity(line)
        const lines = [...get().lines]
        // TC-14: dòng giống hệt (và chưa giảm giá dòng) thì cộng số lượng
        const index = lines.findIndex(
          (l) => !l.discount && !line.discount && lineIdentity(l) === identity
        )
        if (index >= 0) {
          lines[index] = {
            ...lines[index],
            quantity: Math.min(99, lines[index].quantity + line.quantity),
          }
        } else {
          lines.push({ ...line, key: newId() })
        }
        set({ lines, clientRequestId: null })
      },

      updateLine: (key, input) => {
        const line = normalize(input)
        const identity = lineIdentity(line)
        let lines = get().lines.map((l) => (l.key === key ? { ...line, key } : l))
        // Sửa xong mà trùng dòng khác thì gộp
        const duplicate = lines.find(
          (l) => l.key !== key && !l.discount && !line.discount && lineIdentity(l) === identity
        )
        if (duplicate) {
          lines = lines
            .filter((l) => l.key !== key)
            .map((l) =>
              l.key === duplicate.key
                ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) }
                : l
            )
        }
        set({ lines, clientRequestId: null })
      },

      setQuantity: (key, quantity) => {
        if (quantity < 1) return get().removeLine(key)
        set({
          lines: get().lines.map((l) =>
            l.key === key ? { ...l, quantity: Math.min(99, Math.round(quantity)) } : l
          ),
          clientRequestId: null,
        })
      },

      removeLine: (key) =>
        set({ lines: get().lines.filter((l) => l.key !== key), clientRequestId: null }),

      setLineDiscount: (key, discount) =>
        set({
          lines: get().lines.map((l) =>
            l.key === key ? { ...l, discount: discount ?? undefined } : l
          ),
          clientRequestId: null,
        }),

      setServiceType: (serviceType) => set({ serviceType, clientRequestId: null }),
      setTableTag: (tableTag) => set({ tableTag, clientRequestId: null }),
      setOrderDiscount: (orderDiscount) => set({ orderDiscount, clientRequestId: null }),
      setVoucher: (voucher) => set({ voucher, clientRequestId: null }),
      setCustomer: (customer) => set({ customer, clientRequestId: null }),
      setApproval: (approval) => set({ approval }),

      loadHeld: (held) =>
        set({
          lines: held.items.map((i) => ({
            key: newId(),
            menuItemId: i.menuItemId,
            sizeName: i.sizeName,
            quantity: i.quantity,
            toppingIds: i.toppings.map((t) => t.toppingId).sort(),
            sugarLevel: i.sugarLevel,
            iceLevel: i.iceLevel,
            note: i.note,
            discount: i.discount
              ? { type: i.discount.type, value: i.discount.value, reason: i.discount.reason }
              : undefined,
          })),
          serviceType: held.serviceType,
          tableTag: held.tableTag ?? '',
          orderDiscount: held.orderDiscount
            ? {
                type: held.orderDiscount.type,
                value: held.orderDiscount.value,
                reason: held.orderDiscount.reason,
              }
            : null,
          voucher: null,
          customer: held.customer ?? null,
          heldOrderId: held.id,
          holdName: held.holdName,
          approval: null,
          clientRequestId: null,
        }),

      ensureClientRequestId: () => {
        const current = get().clientRequestId
        if (current) return current
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : newId()
        set({ clientRequestId: id })
        return id
      },

      clear: () => set({ ...EMPTY }),
    }),
    {
      name: storageKey('pos-cart'),
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        lines: state.lines,
        serviceType: state.serviceType,
        tableTag: state.tableTag,
        orderDiscount: state.orderDiscount,
        voucher: state.voucher,
        customer: state.customer,
        heldOrderId: state.heldOrderId,
        holdName: state.holdName,
        approval: state.approval,
        clientRequestId: state.clientRequestId,
      }),
    }
  )
)

/** Giỏ gửi lên BE (CartInput) từ state */
export function toCartInput(state: CartState) {
  return {
    serviceType: state.serviceType,
    tableTag: state.serviceType === 'TaiCho' ? state.tableTag.trim() || undefined : undefined,
    items: state.lines.map(({ key: _key, ...line }) => {
      void _key
      return line
    }),
    orderDiscount: state.orderDiscount ?? undefined,
    voucherCode: state.voucher?.code,
    customerId: state.customer?.id,
  }
}
