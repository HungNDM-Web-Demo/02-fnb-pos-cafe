'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MenuBundle } from '@/features/menu-items/types/menu.types'
import type { PromotionDto } from '@/features/promotions/types/promotion.types'
import { priceCart, type PricingLineInput, type PricingResult } from '../lib/pricing'
import type { CartLine } from '../types/pos.types'
import { useCartStore } from '../stores/cart.store'

/**
 * Tính tiền giỏ tại máy (NFR-02) từ thực đơn và khuyến mãi đang chạy; xét lại khung giờ mỗi 30 giây
 * (BR-07). Dòng có món, size hoặc topping không còn bán được đánh dấu `unavailable` (BR-14, TC-05).
 */

export type CartPricing = PricingResult & {
  /** key của dòng không bán được nữa (món/topping tạm hết, ẩn, size không còn) */
  unavailableKeys: Set<string>
  /** Lý do ngắn cho từng dòng không bán được */
  unavailableReasons: Record<string, string>
}

/** Đổi dòng giỏ thành đầu vào tính tiền; null khi món/size không còn */
export function resolveLine(
  line: CartLine,
  menu: MenuBundle
): { input: PricingLineInput; unavailable?: string } | null {
  const item = menu.items.find((m) => m.id === line.menuItemId)
  if (!item) return null
  const size = item.sizes.find((s) => s.name === line.sizeName)
  if (!size) return null
  let unavailable: string | undefined
  if (item.isSoldOut) unavailable = `${item.name} đang tạm hết`
  const toppings = line.toppingIds.map((id) => {
    const t = menu.toppings.find((x) => x.id === id)
    if (!t) {
      unavailable ??= 'Topping không còn trong thực đơn'
      return { toppingId: id, name: 'Topping', price: 0 }
    }
    if (t.isSoldOut) unavailable ??= `${t.name} đang tạm hết`
    return { toppingId: t.id, name: t.name, price: t.price }
  })
  return {
    input: {
      key: line.key,
      menuItemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      categoryId: item.categoryId,
      sizeName: size.name,
      sizePrice: size.price,
      toppings,
      sugarLevel: item.hasSugarOption ? line.sugarLevel : undefined,
      iceLevel: item.hasIceOption ? line.iceLevel : undefined,
      note: line.note,
      quantity: line.quantity,
      discount: line.discount,
    },
    unavailable,
  }
}

/** Mốc thời gian làm tròn tới 30 giây để khuyến mãi khung giờ được xét lại mà không render liên tục */
function useClock(stepMs = 30_000) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / stepMs))
  useEffect(() => {
    const timer = setInterval(() => setTick(Math.floor(Date.now() / stepMs)), stepMs)
    return () => clearInterval(timer)
  }, [stepMs])
  return tick
}

export function useCartPricing(
  menu: MenuBundle | undefined,
  promotions: PromotionDto[] | undefined
): CartPricing {
  const lines = useCartStore((s) => s.lines)
  const orderDiscount = useCartStore((s) => s.orderDiscount)
  const voucher = useCartStore((s) => s.voucher)
  const tick = useClock()

  return useMemo(() => {
    const unavailableKeys = new Set<string>()
    const unavailableReasons: Record<string, string> = {}
    const inputs: PricingLineInput[] = []
    if (menu) {
      for (const line of lines) {
        const resolved = resolveLine(line, menu)
        if (!resolved) {
          unavailableKeys.add(line.key)
          unavailableReasons[line.key] = 'Món không còn trong thực đơn'
          continue
        }
        if (resolved.unavailable) {
          unavailableKeys.add(line.key)
          unavailableReasons[line.key] = resolved.unavailable
        }
        inputs.push(resolved.input)
      }
    }
    const result = priceCart({
      lines: inputs,
      orderDiscount,
      voucher,
      promotions: promotions ?? [],
      at: new Date(),
    })
    void tick
    return { ...result, unavailableKeys, unavailableReasons }
  }, [lines, orderDiscount, voucher, menu, promotions, tick])
}
