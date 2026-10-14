'use client'

import { useMemo, useState } from 'react'
import { Lock, Search, SearchX, X } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { matchesSearch } from '@/lib/normalize'
import { cn } from '@/lib/utils'
import type { MenuBundle, MenuItemDto } from '@/features/menu-items/types/menu.types'
import { MenuCard } from './MenuCard'

type MenuGridProps = {
  menu: MenuBundle | undefined
  isLoading?: boolean
  /** Chưa mở ca: lưới khóa, chỉ còn nút Mở ca (TC-07) */
  locked?: boolean
  onOpenShift?: () => void
  onSelect: (item: MenuItemDto) => void
  onLongPress?: (item: MenuItemDto) => void
}

/** Lưới món có ảnh, lọc danh mục, tìm theo tên hoặc mã không dấu (FR-07). */
export function MenuGrid({
  menu,
  isLoading,
  locked,
  onOpenShift,
  onSelect,
  onLongPress,
}: MenuGridProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')

  const colorOf = useMemo(
    () => new Map((menu?.categories ?? []).map((c) => [c.id, c.color])),
    [menu]
  )

  const items = useMemo(() => {
    if (!menu) return []
    const query = keyword.trim()
    return menu.items.filter((m) =>
      query
        ? matchesSearch(`${m.code} ${m.name}`, query)
        : !categoryId || m.categoryId === categoryId
    )
  }, [menu, categoryId, keyword])

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-64 shrink-0">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm tên hoặc mã món"
            aria-label="Tìm món theo tên hoặc mã"
            className="bg-card h-11 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
            disabled={locked}
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
              aria-label="Xóa từ khóa"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div
          className="flex min-w-0 flex-1 [scrollbar-width:thin] gap-1.5 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Danh mục"
        >
          <CategoryChip
            active={categoryId === null}
            onClick={() => setCategoryId(null)}
            disabled={locked}
          >
            Tất cả
          </CategoryChip>
          {(menu?.categories ?? []).map((c) => (
            <CategoryChip
              key={c.id}
              active={categoryId === c.id}
              color={c.color}
              onClick={() => setCategoryId(c.id)}
              disabled={locked}
            >
              {c.name}
            </CategoryChip>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto rounded-xl" aria-busy={isLoading}>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={keyword ? 'Không tìm thấy món' : 'Danh mục chưa có món'}
            description={
              keyword ? `Không có món nào khớp "${keyword}".` : 'Thêm món ở trang Thực đơn.'
            }
          />
        ) : (
          <div
            className={cn(
              'grid grid-cols-3 gap-3 pb-2 lg:grid-cols-4 2xl:grid-cols-5',
              locked && 'pointer-events-none'
            )}
            aria-hidden={locked || undefined}
          >
            {items.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                color={colorOf.get(item.categoryId)}
                disabled={locked}
                onSelect={onSelect}
                onLongPress={locked ? undefined : onLongPress}
              />
            ))}
          </div>
        )}

        {locked && (
          <div
            className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px]"
            role="status"
          >
            <div className="bg-card flex max-w-sm flex-col items-center gap-3 rounded-2xl border p-6 text-center shadow-lg">
              <span className="bg-warning/12 text-warning flex size-12 items-center justify-center rounded-full">
                <Lock className="size-6" aria-hidden="true" />
              </span>
              <p className="font-semibold">Chưa mở ca</p>
              <p className="text-muted-foreground text-sm">
                Mở ca và nhập tiền đầu ca để bắt đầu bán hàng.
              </p>
              <Button size="lg" variant="cta" onClick={onOpenShift} className="mt-1 min-w-40">
                Mở ca
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryChip({
  active,
  color,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  color?: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none',
        'focus-visible:ring-ring/50 focus-visible:ring-3 disabled:opacity-50',
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted'
      )}
    >
      {color && (
        <span
          className={cn('size-2.5 rounded-full', active && 'ring-primary-foreground/60 ring-2')}
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
