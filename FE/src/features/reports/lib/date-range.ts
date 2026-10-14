import { localDateKey } from '@/features/pos/lib/pricing'

/** Bộ chọn nhanh khoảng ngày của báo cáo (07 §4): Hôm nay, 7 ngày, 30 ngày, Tháng này, Tháng trước, Tùy chọn. */
export type RangePreset = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom'

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'custom', label: 'Tùy chọn' },
]

export const MAX_RANGE_DAYS = 366

export function presetRange(
  preset: Exclude<RangePreset, 'custom'>,
  now = new Date()
): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const back = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return d
  }
  switch (preset) {
    case 'today':
      return { from: localDateKey(today), to: localDateKey(today) }
    case '7d':
      return { from: localDateKey(back(6)), to: localDateKey(today) }
    case '30d':
      return { from: localDateKey(back(29)), to: localDateKey(today) }
    case 'thisMonth':
      return {
        from: localDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: localDateKey(today),
      }
    case 'lastMonth':
      return {
        from: localDateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: localDateKey(new Date(today.getFullYear(), today.getMonth(), 0)),
      }
  }
}

/** Số ngày tính cả hai đầu; null khi sai định dạng */
export function rangeDays(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${to}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000) + 1
}

/** Lỗi khoảng ngày chặn trước khi gọi API (TC-30); null là hợp lệ */
export function rangeError(from: string, to: string): string | null {
  const days = rangeDays(from, to)
  if (days === null) return 'Chọn đủ ngày bắt đầu và kết thúc'
  if (days < 1) return 'Ngày kết thúc phải sau ngày bắt đầu'
  if (days > MAX_RANGE_DAYS) return 'Khoảng ngày tối đa 366 ngày'
  return null
}
