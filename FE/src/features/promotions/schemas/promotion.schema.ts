import { z } from 'zod'

const discountRefine = (
  v: { discountType: 'PhanTram' | 'SoTien'; discountValue: number },
  ctx: z.RefinementCtx
) => {
  if (v.discountType === 'PhanTram' && (v.discountValue < 1 || v.discountValue > 100)) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Phần trăm từ 1 đến 100' })
  }
  if (v.discountType === 'SoTien' && (v.discountValue <= 0 || v.discountValue % 1000 !== 0)) {
    ctx.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'Số tiền phải là bội số 1.000 ₫',
    })
  }
}

/** FR-26: khuyến mãi tự động */
export const promotionSchema = z
  .object({
    name: z.string().trim().min(1, 'Nhập tên khuyến mãi').max(150, 'Tối đa 150 ký tự'),
    description: z.string().max(500, 'Tối đa 500 ký tự'),
    discountType: z.enum(['PhanTram', 'SoTien']),
    discountValue: z.number({ error: 'Nhập giá trị giảm' }),
    maxDiscount: z.number().nullable(),
    scope: z.enum(['HoaDon', 'DanhMuc', 'Mon']),
    categoryId: z.string(),
    menuItemIds: z.array(z.string()),
    minOrderAmount: z.number().min(0, 'Không âm'),
    startTime: z.string(),
    endTime: z.string(),
    daysOfWeek: z.array(z.number()),
    startDate: z.string().min(1, 'Chọn ngày bắt đầu'),
    endDate: z.string().min(1, 'Chọn ngày kết thúc'),
  })
  .superRefine((v, ctx) => {
    discountRefine(v, ctx)
    if (v.scope === 'DanhMuc' && !v.categoryId)
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Chọn danh mục' })
    if (v.scope === 'Mon' && v.menuItemIds.length === 0)
      ctx.addIssue({ code: 'custom', path: ['menuItemIds'], message: 'Chọn ít nhất một món' })
    if (v.startDate && v.endDate && v.endDate < v.startDate)
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Ngày kết thúc phải sau ngày bắt đầu',
      })
    if (!!v.startTime !== !!v.endTime)
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'Nhập đủ giờ bắt đầu và kết thúc',
      })
    else if (v.startTime && v.endTime && v.endTime <= v.startTime)
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'Giờ kết thúc phải sau giờ bắt đầu',
      })
  })
export type PromotionFormValues = z.infer<typeof promotionSchema>

/** FR-27: voucher */
export const voucherSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{4,12}$/, 'Mã 4–12 ký tự chữ in hoa và số')),
    description: z.string().max(200, 'Tối đa 200 ký tự'),
    discountType: z.enum(['PhanTram', 'SoTien']),
    discountValue: z.number({ error: 'Nhập giá trị giảm' }),
    maxDiscount: z.number().nullable(),
    minOrderAmount: z.number().min(0, 'Không âm'),
    maxUses: z.number().int().positive('Lớn hơn 0').nullable(),
    expiresDate: z.string(),
  })
  .superRefine(discountRefine)
export type VoucherFormInput = z.input<typeof voucherSchema>
export type VoucherFormValues = z.output<typeof voucherSchema>
