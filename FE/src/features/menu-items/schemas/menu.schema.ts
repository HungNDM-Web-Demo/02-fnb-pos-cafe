import { z } from 'zod'

/** Form món (UC-01, FR-04): mã, tên, danh mục, size ≥ 1 với giá bội số 1.000 (E2), đúng một size mặc định. */
export const menuItemSchema = z
  .object({
    code: z.string().trim().min(1, 'Nhập mã món').max(20, 'Mã tối đa 20 ký tự'),
    name: z.string().trim().min(1, 'Nhập tên món').max(150, 'Tên tối đa 150 ký tự'),
    categoryId: z.string().min(1, 'Chọn danh mục'),
    description: z.string().max(500, 'Mô tả tối đa 500 ký tự'),
    hasSugarOption: z.boolean(),
    hasIceOption: z.boolean(),
    sizes: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Nhập tên size').max(20, 'Tối đa 20 ký tự'),
          price: z
            .number({ error: 'Nhập giá' })
            .positive('Giá phải lớn hơn 0')
            .refine((v) => v % 1000 === 0, 'Giá phải là bội số 1.000 ₫'),
          isDefault: z.boolean(),
        })
      )
      .min(1, 'Cần ít nhất một size'),
    toppingIds: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    const names = value.sizes.map((s) => s.name.trim().toLowerCase())
    names.forEach((n, i) => {
      if (n && names.indexOf(n) !== i)
        ctx.addIssue({ code: 'custom', path: ['sizes', i, 'name'], message: 'Tên size bị trùng' })
    })
    if (value.sizes.filter((s) => s.isDefault).length > 1) {
      ctx.addIssue({ code: 'custom', path: ['sizes'], message: 'Chỉ một size mặc định' })
    }
  })

export type MenuItemFormValues = z.infer<typeof menuItemSchema>

export const categorySchema = z.object({
  code: z.string().trim().min(1, 'Nhập mã danh mục').max(20, 'Mã tối đa 20 ký tự'),
  name: z.string().trim().min(1, 'Nhập tên danh mục').max(100, 'Tên tối đa 100 ký tự'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Màu dạng #RRGGBB'),
  isHidden: z.boolean(),
})
export type CategoryFormValues = z.infer<typeof categorySchema>

export const toppingSchema = z.object({
  code: z.string().trim().max(20, 'Mã tối đa 20 ký tự'),
  name: z.string().trim().min(1, 'Nhập tên topping').max(100, 'Tên tối đa 100 ký tự'),
  price: z
    .number({ error: 'Nhập giá' })
    .min(0, 'Giá không âm')
    .refine((v) => v % 1000 === 0, 'Giá phải là bội số 1.000 ₫'),
})
export type ToppingFormValues = z.infer<typeof toppingSchema>
