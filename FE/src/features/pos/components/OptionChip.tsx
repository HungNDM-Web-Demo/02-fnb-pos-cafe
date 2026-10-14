'use client'

import { cn } from '@/lib/utils'

type OptionChipProps = {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
  /** Dòng phụ (giá, nhãn tạm hết) */
  hint?: React.ReactNode
  className?: string
  /** Nhiều lựa chọn (checkbox) hay một lựa chọn (radio) */
  multiple?: boolean
}

/** Ô chọn lớn cho tablet (≥ 44 px): size, topping, mức đường, mức đá. */
export function OptionChip({
  selected,
  disabled,
  onClick,
  children,
  hint,
  className,
  multiple,
}: OptionChipProps) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-11 flex-col items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 outline-none',
        'focus-visible:ring-ring/50 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-muted',
        className
      )}
    >
      <span className="leading-tight">{children}</span>
      {hint && (
        <span
          className={cn(
            'text-xs leading-tight',
            selected ? 'text-primary/80' : 'text-muted-foreground'
          )}
        >
          {hint}
        </span>
      )}
    </button>
  )
}
