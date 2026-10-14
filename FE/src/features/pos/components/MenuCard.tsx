'use client'

import { useRef } from 'react'
import { Ban } from 'lucide-react'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MenuItemDto } from '@/features/menu-items/types/menu.types'
import { MenuImage } from './MenuImage'

type MenuCardProps = {
  item: MenuItemDto
  color?: string
  disabled?: boolean
  onSelect: (item: MenuItemDto) => void
  /** Nhấn giữ 500 ms hoặc chuột phải: menu Tạm hết / Bán lại (UC-02) */
  onLongPress?: (item: MenuItemDto) => void
}

const LONG_PRESS_MS = 500

/** Thẻ món trên lưới bán hàng: ảnh, tên, giá thấp nhất; mờ và không chọn được khi tạm hết (FR-06). */
export function MenuCard({ item, color, disabled, onSelect, onLongPress }: MenuCardProps) {
  const timer = useRef<number | null>(null)
  const longPressed = useRef(false)

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }
  const start = () => {
    if (!onLongPress) return
    longPressed.current = false
    cancel()
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      onLongPress(item)
    }, LONG_PRESS_MS)
  }
  const handleClick = () => {
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    if (!item.isSoldOut && !disabled) onSelect(item)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        if (!onLongPress) return
        e.preventDefault()
        cancel()
        onLongPress(item)
      }}
      aria-disabled={item.isSoldOut || disabled || undefined}
      aria-label={`${item.name}, từ ${formatVnd(item.minPrice)}${item.isSoldOut ? ', tạm hết' : ''}`}
      className={cn(
        'group bg-card relative flex min-h-[11rem] flex-col overflow-hidden rounded-xl border text-left shadow-xs transition-[transform,box-shadow,border-color] duration-150 outline-none select-none',
        'hover:border-primary/50 focus-visible:ring-ring/50 hover:shadow-md focus-visible:ring-3 active:scale-[0.98]',
        (item.isSoldOut || disabled) &&
          'hover:border-border cursor-not-allowed opacity-55 hover:shadow-xs active:scale-100'
      )}
      style={{ WebkitTouchCallout: 'none' }}
    >
      <MenuImage
        imageUrl={item.imageUrl}
        name={item.name}
        color={color}
        className="aspect-[4/3] w-full"
      />
      <span className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        <span className="line-clamp-2 text-sm leading-snug font-semibold">{item.name}</span>
        <span className="text-primary mt-auto text-sm font-semibold tabular-nums">
          {item.sizes.length > 1 && (
            <span className="text-muted-foreground text-xs font-normal">từ </span>
          )}
          {formatVnd(item.minPrice)}
        </span>
      </span>
      {item.isSoldOut && (
        <span className="bg-foreground/80 text-background absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
          <Ban className="size-3" aria-hidden="true" />
          Tạm hết
        </span>
      )}
    </button>
  )
}
