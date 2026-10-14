import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { menuMock } from '../mock/menu.mock'
import type {
  CategoryDto,
  MenuBundle,
  MenuItemDto,
  MenuItemQuery,
  ReorderCategoriesRequest,
  SaveCategoryRequest,
  SaveMenuItemRequest,
  SaveToppingRequest,
  SetAvailabilityRequest,
  SetHiddenRequest,
  ToppingDto,
  UploadImageResult,
} from '../types/menu.types'

/** Service thực đơn (07 §2.1 → §2.4): chọn mock hoặc API. */
export const menuService = {
  getBundle: (): Promise<MenuBundle> =>
    isMockMode() ? menuMock.getBundle() : apiCall.get<MenuBundle>(apiRoutes.menu),

  // Danh mục
  getCategories: (): Promise<CategoryDto[]> =>
    isMockMode() ? menuMock.getCategories() : apiCall.get<CategoryDto[]>(apiRoutes.categories.list),
  createCategory: (input: SaveCategoryRequest): Promise<CategoryDto> =>
    isMockMode()
      ? menuMock.createCategory(input)
      : apiCall.post<CategoryDto>(apiRoutes.categories.list, input),
  updateCategory: (id: string, input: SaveCategoryRequest): Promise<CategoryDto> =>
    isMockMode()
      ? menuMock.updateCategory(id, input)
      : apiCall.put<CategoryDto>(apiRoutes.categories.detail(id), input),
  reorderCategories: (input: ReorderCategoriesRequest): Promise<void> =>
    isMockMode()
      ? menuMock.reorderCategories(input)
      : apiCall.put(apiRoutes.categories.order, input),
  deleteCategory: (id: string): Promise<void> =>
    isMockMode() ? menuMock.deleteCategory(id) : apiCall.delete(apiRoutes.categories.detail(id)),

  // Món
  getMenuItems: (query: MenuItemQuery): Promise<PaginatedResult<MenuItemDto>> =>
    isMockMode()
      ? menuMock.getMenuItems(query)
      : apiCall.get<PaginatedResult<MenuItemDto>>(apiRoutes.menuItems.list, { params: query }),
  getMenuItem: (id: string): Promise<MenuItemDto> =>
    isMockMode()
      ? menuMock.getMenuItem(id)
      : apiCall.get<MenuItemDto>(apiRoutes.menuItems.detail(id)),
  createMenuItem: (input: SaveMenuItemRequest): Promise<MenuItemDto> =>
    isMockMode()
      ? menuMock.createMenuItem(input)
      : apiCall.post<MenuItemDto>(apiRoutes.menuItems.list, input),
  updateMenuItem: (id: string, input: SaveMenuItemRequest): Promise<MenuItemDto> =>
    isMockMode()
      ? menuMock.updateMenuItem(id, input)
      : apiCall.put<MenuItemDto>(apiRoutes.menuItems.detail(id), input),
  setMenuItemAvailability: (id: string, input: SetAvailabilityRequest): Promise<void> =>
    isMockMode()
      ? menuMock.setMenuItemAvailability(id, input)
      : apiCall.patch(apiRoutes.menuItems.availability(id), input),
  setMenuItemHidden: (id: string, input: SetHiddenRequest): Promise<void> =>
    isMockMode()
      ? menuMock.setMenuItemHidden(id, input)
      : apiCall.patch(apiRoutes.menuItems.hidden(id), input),
  uploadMenuItemImage: (id: string, file: File): Promise<UploadImageResult> => {
    if (isMockMode()) return menuMock.uploadMenuItemImage(id, file)
    const form = new FormData()
    form.append('file', file)
    return apiCall.post<UploadImageResult>(apiRoutes.menuItems.image(id), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteMenuItem: (id: string): Promise<void> =>
    isMockMode() ? menuMock.deleteMenuItem(id) : apiCall.delete(apiRoutes.menuItems.detail(id)),

  // Topping
  getToppings: (): Promise<ToppingDto[]> =>
    isMockMode() ? menuMock.getToppings() : apiCall.get<ToppingDto[]>(apiRoutes.toppings.list),
  createTopping: (input: SaveToppingRequest): Promise<ToppingDto> =>
    isMockMode()
      ? menuMock.createTopping(input)
      : apiCall.post<ToppingDto>(apiRoutes.toppings.list, input),
  updateTopping: (id: string, input: SaveToppingRequest): Promise<ToppingDto> =>
    isMockMode()
      ? menuMock.updateTopping(id, input)
      : apiCall.put<ToppingDto>(apiRoutes.toppings.detail(id), input),
  setToppingAvailability: (id: string, input: SetAvailabilityRequest): Promise<void> =>
    isMockMode()
      ? menuMock.setToppingAvailability(id, input)
      : apiCall.patch(apiRoutes.toppings.availability(id), input),
  setToppingHidden: (id: string, input: SetHiddenRequest): Promise<void> =>
    isMockMode()
      ? menuMock.setToppingHidden(id, input)
      : apiCall.patch(apiRoutes.toppings.hidden(id), input),
  deleteTopping: (id: string): Promise<void> =>
    isMockMode() ? menuMock.deleteTopping(id) : apiCall.delete(apiRoutes.toppings.detail(id)),
}
