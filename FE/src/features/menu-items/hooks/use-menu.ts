'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { menuService } from '../services/menu.service'
import type {
  MenuItemQuery,
  ReorderCategoriesRequest,
  SaveCategoryRequest,
  SaveMenuItemRequest,
  SaveToppingRequest,
} from '../types/menu.types'

export const menuKeys = {
  all: ['menu'] as const,
  bundle: ['menu', 'bundle'] as const,
  categories: ['menu', 'categories'] as const,
  items: (query: MenuItemQuery) => ['menu', 'items', query] as const,
  item: (id: string) => ['menu', 'item', id] as const,
  toppings: ['menu', 'toppings'] as const,
}

/** Thực đơn gộp cho màn bán hàng; làm mới 60 giây một lần để các máy thấy món tạm hết của nhau */
export function useMenuBundle(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: menuKeys.bundle,
    queryFn: () => menuService.getBundle(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: options.enabled ?? true,
  })
}

export function useCategories(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: menuKeys.categories,
    queryFn: () => menuService.getCategories(),
    enabled: options.enabled ?? true,
  })
}

export function useMenuItems(query: MenuItemQuery) {
  return useQuery({
    queryKey: menuKeys.items(query),
    queryFn: () => menuService.getMenuItems(query),
    placeholderData: keepPreviousData,
  })
}

export function useToppings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: menuKeys.toppings,
    queryFn: () => menuService.getToppings(),
    enabled: options.enabled ?? true,
  })
}

/** Sau khi ghi: làm mới toàn bộ thực đơn (kể cả màn bán hàng) và nhật ký */
export function useInvalidateMenu() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: menuKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
  }
}

export function useSaveCategory() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveCategoryRequest }) =>
      id ? menuService.updateCategory(id, input) : menuService.createCategory(input),
    onSuccess: invalidate,
  })
}

export function useReorderCategories() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: (input: ReorderCategoriesRequest) => menuService.reorderCategories(input),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteCategory(id),
    onSuccess: invalidate,
  })
}

export function useSaveMenuItem() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: async ({
      id,
      input,
      image,
    }: {
      id?: string
      input: SaveMenuItemRequest
      image?: File | null
    }) => {
      const saved = id
        ? await menuService.updateMenuItem(id, input)
        : await menuService.createMenuItem(input)
      if (image) {
        const { imageUrl } = await menuService.uploadMenuItemImage(saved.id, image)
        return { ...saved, imageUrl }
      }
      return saved
    },
    onSuccess: invalidate,
  })
}

export function useSetMenuItemAvailability() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: ({ id, isSoldOut }: { id: string; isSoldOut: boolean }) =>
      menuService.setMenuItemAvailability(id, { isSoldOut }),
    onSuccess: invalidate,
  })
}

export function useSetMenuItemHidden() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) =>
      menuService.setMenuItemHidden(id, { isHidden }),
    onSuccess: invalidate,
  })
}

export function useDeleteMenuItem() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteMenuItem(id),
    onSuccess: invalidate,
  })
}

export function useSaveTopping() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveToppingRequest }) =>
      id ? menuService.updateTopping(id, input) : menuService.createTopping(input),
    onSuccess: invalidate,
  })
}

export function useSetToppingAvailability() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: ({ id, isSoldOut }: { id: string; isSoldOut: boolean }) =>
      menuService.setToppingAvailability(id, { isSoldOut }),
    onSuccess: invalidate,
  })
}

export function useSetToppingHidden() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) =>
      menuService.setToppingHidden(id, { isHidden }),
    onSuccess: invalidate,
  })
}

export function useDeleteTopping() {
  const invalidate = useInvalidateMenu()
  return useMutation({
    mutationFn: (id: string) => menuService.deleteTopping(id),
    onSuccess: invalidate,
  })
}
