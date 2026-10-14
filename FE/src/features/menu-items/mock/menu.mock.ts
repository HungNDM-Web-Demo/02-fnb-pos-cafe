import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { mockBlobs } from '@/mock/mock-blobs'
import { mockDb } from '@/mock/mock-db'
import { conflict, domain, notFound, validation } from '@/mock/mock-errors'
import { listQuery, newId, nextCode } from '@/mock/mock-helpers'
import {
  categoriesDb,
  menuItemsDb,
  ordersDb,
  toppingsDb,
  type CategoryRecord,
  type MenuItemRecord,
  type ToppingRecord,
} from '@/features/pos/mock/pos.db'
import type { PaginatedResult } from '@/types/api'
import type {
  CategoryDto,
  MenuBundle,
  MenuItemDto,
  MenuItemQuery,
  MenuItemStatus,
  ReorderCategoriesRequest,
  SaveCategoryRequest,
  SaveMenuItemRequest,
  SaveToppingRequest,
  SetAvailabilityRequest,
  SetHiddenRequest,
  ToppingDto,
  UploadImageResult,
} from '../types/menu.types'

/** Handler /api/menu, /api/categories, /api/menu-items, /api/toppings ở chế độ mock (07 §2.1 → §2.4). */

const nowIso = () => new Date().toISOString()
const HEX = /^#[0-9A-Fa-f]{6}$/
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const statusOf = (x: { isHidden: boolean; isSoldOut: boolean }): MenuItemStatus =>
  x.isHidden ? 'An' : x.isSoldOut ? 'TamHet' : 'DangBan'

/** Món, topping đã có trong hóa đơn (BR-18); tính từ hóa đơn đã thanh toán hoặc đã hủy */
function soldSets() {
  const items = new Set<string>()
  const toppings = new Set<string>()
  for (const o of ordersDb.all()) {
    if (o.status === 'DangGiu') continue
    for (const line of o.items) {
      items.add(line.menuItemId)
      for (const t of line.toppings) toppings.add(t.toppingId)
    }
  }
  return { items, toppings }
}

export function toCategoryDto(c: CategoryRecord, itemCount?: number): CategoryDto {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    color: c.color,
    sortOrder: c.sortOrder,
    isHidden: c.isHidden,
    itemCount: itemCount ?? menuItemsDb.count((m) => m.categoryId === c.id),
  }
}

export function toMenuItemDto(
  m: MenuItemRecord,
  context: { categories: Map<string, CategoryRecord>; sold: Set<string> }
): MenuItemDto {
  const sizes = [...m.sizes].sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    categoryId: m.categoryId,
    categoryName: context.categories.get(m.categoryId)?.name ?? '',
    imageUrl: m.imageUrl,
    description: m.description,
    hasSugarOption: m.hasSugarOption,
    hasIceOption: m.hasIceOption,
    isSoldOut: m.isSoldOut,
    isHidden: m.isHidden,
    status: statusOf(m),
    sortOrder: m.sortOrder,
    sizes,
    minPrice: Math.min(...sizes.map((s) => s.price)),
    toppingIds: m.toppingIds,
    everSold: context.sold.has(m.id),
    updatedAt: m.updatedAt,
  }
}

export function toToppingDto(t: ToppingRecord, sold: Set<string>): ToppingDto {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    price: t.price,
    isSoldOut: t.isSoldOut,
    isHidden: t.isHidden,
    status: statusOf(t),
    sortOrder: t.sortOrder,
    everSold: sold.has(t.id),
  }
}

function menuContext() {
  const sold = soldSets()
  return {
    categories: new Map(categoriesDb.all().map((c) => [c.id, c])),
    sold: sold.items,
    soldToppings: sold.toppings,
  }
}

const byCategoryThenOrder = (
  a: MenuItemRecord,
  b: MenuItemRecord,
  categoryOrder: Map<string, number>
) =>
  (categoryOrder.get(a.categoryId) ?? 0) - (categoryOrder.get(b.categoryId) ?? 0) ||
  a.sortOrder - b.sortOrder

function getCategoryOr404(id: string) {
  const c = categoriesDb.get(id)
  if (!c) throw notFound('Không tìm thấy danh mục.')
  return c
}
function getMenuItemOr404(id: string) {
  const m = menuItemsDb.get(id)
  if (!m) throw notFound('Không tìm thấy món.')
  return m
}
function getToppingOr404(id: string) {
  const t = toppingsDb.get(id)
  if (!t) throw notFound('Không tìm thấy topping.')
  return t
}

function validateMenuItem(input: SaveMenuItemRequest, excludeId?: string) {
  const errors: Record<string, string> = {}
  if (!input.code?.trim()) errors.code = 'Nhập mã món'
  if (!input.name?.trim()) errors.name = 'Nhập tên món'
  if (!input.sizes?.length) errors.sizes = 'Cần ít nhất một size'
  input.sizes?.forEach((s, i) => {
    if (!s.name?.trim()) errors[`sizes[${i}].name`] = 'Nhập tên size'
    if (!(s.price > 0) || s.price % 1000 !== 0)
      errors[`sizes[${i}].price`] = 'Giá phải là bội số 1.000 ₫'
  })
  if (input.sizes?.filter((s) => s.isDefault).length > 1) errors.sizes = 'Chỉ một size mặc định'
  if (Object.keys(errors).length) throw validation(errors)
  if (!categoriesDb.get(input.categoryId))
    throw validation({ categoryId: 'Danh mục không tồn tại' })
  const code = input.code.trim().toUpperCase()
  if (menuItemsDb.some((m) => m.code === code && m.id !== excludeId)) {
    throw conflict(`Mã món ${code} đã tồn tại.`, { code: 'Mã món đã tồn tại' })
  }
  return code
}

export const menuMock = {
  // ───────── §2.1 thực đơn gộp ─────────
  async getBundle(): Promise<MenuBundle> {
    await mockDelay(150, 300)
    requirePermission(permissions.orders.create, permissions.menuItems.view)
    const ctx = menuContext()
    const categories = categoriesDb
      .filter((c) => !c.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const categoryOrder = new Map(categories.map((c) => [c.id, c.sortOrder]))
    const counts = new Map<string, number>()
    const items = menuItemsDb
      .filter((m) => !m.isHidden)
      .sort((a, b) => byCategoryThenOrder(a, b, categoryOrder))
    for (const m of menuItemsDb.all()) counts.set(m.categoryId, (counts.get(m.categoryId) ?? 0) + 1)
    return {
      categories: categories.map((c) => toCategoryDto(c, counts.get(c.id) ?? 0)),
      items: items.map((m) => toMenuItemDto(m, ctx)),
      toppings: toppingsDb
        .filter((t) => !t.isHidden)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => toToppingDto(t, ctx.soldToppings)),
    }
  },

  // ───────── §2.2 danh mục ─────────
  async getCategories(): Promise<CategoryDto[]> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    const counts = new Map<string, number>()
    for (const m of menuItemsDb.all()) counts.set(m.categoryId, (counts.get(m.categoryId) ?? 0) + 1)
    return categoriesDb
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => toCategoryDto(c, counts.get(c.id) ?? 0))
  },

  async getCategory(id: string): Promise<CategoryDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    return toCategoryDto(getCategoryOr404(id))
  },

  async createCategory(input: SaveCategoryRequest): Promise<CategoryDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.create)
    const errors: Record<string, string> = {}
    if (!input.code?.trim()) errors.code = 'Nhập mã danh mục'
    if (!input.name?.trim()) errors.name = 'Nhập tên danh mục'
    if (!HEX.test(input.color ?? '')) errors.color = 'Màu dạng #RRGGBB'
    if (Object.keys(errors).length) throw validation(errors)
    const code = input.code.trim().toUpperCase()
    if (categoriesDb.some((c) => c.code === code)) {
      throw conflict(`Mã danh mục ${code} đã tồn tại.`, { code: 'Mã danh mục đã tồn tại' })
    }
    const maxOrder = Math.max(0, ...categoriesDb.all().map((c) => c.sortOrder))
    const record = categoriesDb.insert({
      id: newId(),
      code,
      name: input.name.trim(),
      color: input.color.toUpperCase(),
      sortOrder: maxOrder + 10,
      isHidden: !!input.isHidden,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    auditCreate('Category', record)
    return toCategoryDto(record, 0)
  },

  async updateCategory(id: string, input: SaveCategoryRequest): Promise<CategoryDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const before = getCategoryOr404(id)
    const errors: Record<string, string> = {}
    if (!input.name?.trim()) errors.name = 'Nhập tên danh mục'
    if (!HEX.test(input.color ?? '')) errors.color = 'Màu dạng #RRGGBB'
    if (Object.keys(errors).length) throw validation(errors)
    const code = (input.code ?? before.code).trim().toUpperCase()
    if (categoriesDb.some((c) => c.code === code && c.id !== id)) {
      throw conflict(`Mã danh mục ${code} đã tồn tại.`, { code: 'Mã danh mục đã tồn tại' })
    }
    const after = categoriesDb.update(id, {
      code,
      name: input.name.trim(),
      color: input.color.toUpperCase(),
      isHidden: !!input.isHidden,
      updatedAt: nowIso(),
    })!
    auditUpdate('Category', before, after)
    return toCategoryDto(after)
  },

  async reorderCategories(input: ReorderCategoriesRequest): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const all = categoriesDb.all()
    const ids = input.ids ?? []
    const valid =
      ids.length === all.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => all.some((c) => c.id === id))
    if (!valid) throw validation({ ids: 'Danh sách id phải gồm đúng toàn bộ danh mục' })
    mockDb.batch(() => {
      ids.forEach((id, index) =>
        categoriesDb.update(id, { sortOrder: (index + 1) * 10, updatedAt: nowIso() })
      )
    })
  },

  async deleteCategory(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.delete)
    const category = getCategoryOr404(id)
    const itemCount = menuItemsDb.count((m) => m.categoryId === id)
    if (itemCount > 0) {
      throw domain(`Danh mục đang có ${itemCount} món, chuyển món sang danh mục khác trước`, {
        itemCount,
      })
    }
    categoriesDb.remove(id)
    auditDelete('Category', category)
  },

  // ───────── §2.3 món ─────────
  async getMenuItems(query: MenuItemQuery): Promise<PaginatedResult<MenuItemDto>> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    const ctx = menuContext()
    const categoryOrder = new Map(categoriesDb.all().map((c) => [c.id, c.sortOrder]))
    const filtered = menuItemsDb
      .filter(
        (m) =>
          (!query.categoryId || m.categoryId === query.categoryId) &&
          (!query.status || statusOf(m) === query.status)
      )
      .sort((a, b) => byCategoryThenOrder(a, b, categoryOrder))
      .map((m) => toMenuItemDto(m, ctx))
    // Mặc định giữ thứ tự danh mục → sortOrder (đã sắp ở trên); sortBy khác thì listQuery xử lý
    const sortBy = query.sortBy && query.sortBy !== 'sortOrder' ? query.sortBy : undefined
    return listQuery(
      filtered,
      { ...query, sortBy },
      { searchFields: ['code', 'name'], defaultSortBy: '' }
    )
  },

  async getMenuItem(id: string): Promise<MenuItemDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    return toMenuItemDto(getMenuItemOr404(id), menuContext())
  },

  async createMenuItem(input: SaveMenuItemRequest): Promise<MenuItemDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.create)
    const code = validateMenuItem(input)
    const siblings = menuItemsDb.filter((m) => m.categoryId === input.categoryId)
    const hasDefault = input.sizes.some((s) => s.isDefault)
    const record = menuItemsDb.insert({
      id: newId(),
      code,
      name: input.name.trim(),
      categoryId: input.categoryId,
      description: input.description?.trim() || undefined,
      hasSugarOption: input.hasSugarOption,
      hasIceOption: input.hasIceOption,
      isSoldOut: false,
      isHidden: false,
      sortOrder: input.sortOrder ?? Math.max(0, ...siblings.map((m) => m.sortOrder)) + 10,
      sizes: input.sizes.map((s, i) => ({
        id: newId(),
        name: s.name.trim(),
        price: s.price,
        isDefault: hasDefault ? s.isDefault : i === 0,
        sortOrder: (i + 1) * 10,
      })),
      toppingIds: [...new Set(input.toppingIds ?? [])],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    auditCreate('MenuItem', record)
    return toMenuItemDto(record, menuContext())
  },

  async updateMenuItem(id: string, input: SaveMenuItemRequest): Promise<MenuItemDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const before = getMenuItemOr404(id)
    const code = validateMenuItem(input, id)
    const hasDefault = input.sizes.some((s) => s.isDefault)
    const after = menuItemsDb.update(id, {
      code,
      name: input.name.trim(),
      categoryId: input.categoryId,
      description: input.description?.trim() || undefined,
      hasSugarOption: input.hasSugarOption,
      hasIceOption: input.hasIceOption,
      sortOrder: input.sortOrder ?? before.sortOrder,
      sizes: input.sizes.map((s, i) => ({
        id: before.sizes.find((x) => x.name === s.name.trim())?.id ?? newId(),
        name: s.name.trim(),
        price: s.price,
        isDefault: hasDefault ? s.isDefault : i === 0,
        sortOrder: (i + 1) * 10,
      })),
      toppingIds: [...new Set(input.toppingIds ?? [])],
      updatedAt: nowIso(),
    })!
    auditUpdate('MenuItem', before, after)
    return toMenuItemDto(after, menuContext())
  },

  async setMenuItemAvailability(id: string, input: SetAvailabilityRequest): Promise<void> {
    await mockDelay(100, 250)
    requirePermission(permissions.menuItems.availability)
    const before = getMenuItemOr404(id)
    const after = menuItemsDb.update(id, { isSoldOut: !!input.isSoldOut, updatedAt: nowIso() })!
    auditUpdate('MenuItem', before, after)
  },

  async setMenuItemHidden(id: string, input: SetHiddenRequest): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const before = getMenuItemOr404(id)
    const after = menuItemsDb.update(id, { isHidden: !!input.isHidden, updatedAt: nowIso() })!
    auditUpdate('MenuItem', before, after)
  },

  async uploadMenuItemImage(id: string, file: File): Promise<UploadImageResult> {
    await mockDelay(300, 600)
    requirePermission(permissions.menuItems.update)
    const before = getMenuItemOr404(id)
    if (!IMAGE_TYPES.includes(file.type))
      throw validation({ file: 'Chỉ nhận ảnh JPG, PNG hoặc WebP' })
    if (file.size > MAX_IMAGE_BYTES) throw validation({ file: 'Ảnh tối đa 2 MB' })
    const stored = await mockBlobs.put(file, file.name)
    const after = menuItemsDb.update(id, { imageUrl: stored.url, updatedAt: nowIso() })!
    auditUpdate('MenuItem', before, after)
    return { imageUrl: stored.url }
  },

  async deleteMenuItem(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.delete)
    const item = getMenuItemOr404(id)
    if (soldSets().items.has(id)) throw domain('Món đã có trong hóa đơn, chỉ có thể ẩn')
    menuItemsDb.remove(id)
    auditDelete('MenuItem', item)
  },

  // ───────── §2.4 topping ─────────
  async getToppings(): Promise<ToppingDto[]> {
    await mockDelay()
    requirePermission(permissions.menuItems.view)
    const sold = soldSets().toppings
    return toppingsDb
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => toToppingDto(t, sold))
  },

  async createTopping(input: SaveToppingRequest): Promise<ToppingDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.create)
    const errors: Record<string, string> = {}
    if (!input.name?.trim()) errors.name = 'Nhập tên topping'
    if (!(input.price >= 0) || input.price % 1000 !== 0) errors.price = 'Giá phải là bội số 1.000 ₫'
    if (Object.keys(errors).length) throw validation(errors)
    const code = input.code?.trim()
      ? input.code.trim().toUpperCase()
      : nextCode(toppingsDb.all(), 'code', 'TP', 2)
    if (toppingsDb.some((t) => t.code === code)) {
      throw conflict(`Mã topping ${code} đã tồn tại.`, { code: 'Mã topping đã tồn tại' })
    }
    const record = toppingsDb.insert({
      id: newId(),
      code,
      name: input.name.trim(),
      price: input.price,
      isSoldOut: false,
      isHidden: false,
      sortOrder: input.sortOrder ?? Math.max(0, ...toppingsDb.all().map((t) => t.sortOrder)) + 10,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    auditCreate('Topping', record)
    return toToppingDto(record, new Set())
  },

  async updateTopping(id: string, input: SaveToppingRequest): Promise<ToppingDto> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const before = getToppingOr404(id)
    const errors: Record<string, string> = {}
    if (!input.name?.trim()) errors.name = 'Nhập tên topping'
    if (!(input.price >= 0) || input.price % 1000 !== 0) errors.price = 'Giá phải là bội số 1.000 ₫'
    if (Object.keys(errors).length) throw validation(errors)
    const code = (input.code ?? before.code).trim().toUpperCase()
    if (toppingsDb.some((t) => t.code === code && t.id !== id)) {
      throw conflict(`Mã topping ${code} đã tồn tại.`, { code: 'Mã topping đã tồn tại' })
    }
    const after = toppingsDb.update(id, {
      code,
      name: input.name.trim(),
      price: input.price,
      sortOrder: input.sortOrder ?? before.sortOrder,
      updatedAt: nowIso(),
    })!
    auditUpdate('Topping', before, after)
    return toToppingDto(after, soldSets().toppings)
  },

  async setToppingAvailability(id: string, input: SetAvailabilityRequest): Promise<void> {
    await mockDelay(100, 250)
    requirePermission(permissions.menuItems.availability)
    const before = getToppingOr404(id)
    const after = toppingsDb.update(id, { isSoldOut: !!input.isSoldOut, updatedAt: nowIso() })!
    auditUpdate('Topping', before, after)
  },

  async setToppingHidden(id: string, input: SetHiddenRequest): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.update)
    const before = getToppingOr404(id)
    const after = toppingsDb.update(id, { isHidden: !!input.isHidden, updatedAt: nowIso() })!
    auditUpdate('Topping', before, after)
  },

  async deleteTopping(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.menuItems.delete)
    const topping = getToppingOr404(id)
    if (soldSets().toppings.has(id)) throw domain('Topping đã có trong hóa đơn, chỉ có thể ẩn')
    mockDb.batch(() => {
      toppingsDb.remove(id)
      for (const m of menuItemsDb.filter((x) => x.toppingIds.includes(id))) {
        menuItemsDb.update(m.id, { toppingIds: m.toppingIds.filter((t) => t !== id) })
      }
    })
    auditDelete('Topping', topping)
  },
}
