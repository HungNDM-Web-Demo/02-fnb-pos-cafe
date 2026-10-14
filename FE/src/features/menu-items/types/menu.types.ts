import type { PaginationQuery } from '@/types/api'

/** DTO thực đơn, khớp từng trường docs/07-DANH-SACH-API.md §2.1 → §2.4. */

/** An > TamHet > DangBan (06 §4) */
export type MenuItemStatus = 'DangBan' | 'TamHet' | 'An'

export type CategoryDto = {
  id: string
  code: string
  name: string
  color: string
  sortOrder: number
  isHidden: boolean
  /** Món chưa xóa, kể cả ẩn */
  itemCount: number
}

export type SaveCategoryRequest = { code: string; name: string; color: string; isHidden: boolean }

export type ReorderCategoriesRequest = { ids: string[] }

export type MenuItemSizeDto = {
  id: string
  name: string
  price: number
  isDefault: boolean
  sortOrder: number
}

export type MenuItemDto = {
  id: string
  code: string
  name: string
  categoryId: string
  categoryName: string
  imageUrl?: string
  description?: string
  hasSugarOption: boolean
  hasIceOption: boolean
  isSoldOut: boolean
  isHidden: boolean
  status: MenuItemStatus
  sortOrder: number
  /** Theo sortOrder, đúng 1 isDefault */
  sizes: MenuItemSizeDto[]
  /** Giá size thấp nhất, hiện trên thẻ món */
  minPrice: number
  /** Topping được phép, kể cả topping đang tạm hết */
  toppingIds: string[]
  /** Đã có trong hóa đơn (BR-18) → vô hiệu nút Xóa, gợi ý Ẩn */
  everSold: boolean
  updatedAt: string
}

export type SaveMenuItemRequest = {
  code: string
  name: string
  categoryId: string
  description?: string
  hasSugarOption: boolean
  hasIceOption: boolean
  /** ≥ 1; price > 0 bội số 1.000 */
  sizes: { name: string; price: number; isDefault: boolean }[]
  toppingIds: string[]
  /** Bỏ trống khi tạo → cuối danh mục */
  sortOrder?: number
}

export type MenuItemQuery = PaginationQuery & {
  categoryId?: string
  status?: MenuItemStatus
}

export type SetAvailabilityRequest = { isSoldOut: boolean }
export type SetHiddenRequest = { isHidden: boolean }
export type UploadImageResult = { imageUrl: string }

export type ToppingDto = {
  id: string
  code: string
  name: string
  price: number
  isSoldOut: boolean
  isHidden: boolean
  status: MenuItemStatus
  sortOrder: number
  everSold: boolean
}

export type SaveToppingRequest = { code: string; name: string; price: number; sortOrder?: number }

/** GET /api/menu: toàn bộ danh mục, món, topping chưa ẩn cho màn bán hàng */
export type MenuBundle = {
  categories: CategoryDto[]
  items: MenuItemDto[]
  toppings: ToppingDto[]
}

export const menuItemStatusLabels: Record<MenuItemStatus, string> = {
  DangBan: 'Đang bán',
  TamHet: 'Tạm hết',
  An: 'Đã ẩn',
}
