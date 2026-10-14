import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { formatVnd } from '@/lib/format'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { conflict, domain, notFound, validation } from '@/mock/mock-errors'
import { listQuery, newId, nextCode } from '@/mock/mock-helpers'
import { priceCart, promotionStatusAt, type PricingVoucher } from '@/features/pos/lib/pricing'
import {
  categoriesDb,
  promotionsDb,
  vouchersDb,
  type PromotionRecord,
  type VoucherRecord,
} from '@/features/pos/mock/pos.db'
import type { PaginatedResult } from '@/types/api'
import type {
  PauseRequest,
  PromotionDto,
  PromotionQuery,
  SavePromotionRequest,
  SaveVoucherRequest,
  VoucherCheckRequest,
  VoucherCheckResult,
  VoucherDto,
  VoucherQuery,
  VoucherStatus,
} from '../types/promotion.types'

/** Handler /api/promotions, /api/vouchers ở chế độ mock (07 §2.7). */

const nowIso = () => new Date().toISOString()
const VOUCHER_CODE = /^[A-Z0-9]{4,12}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

export function toPromotionDto(p: PromotionRecord): PromotionDto {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscount: p.maxDiscount,
    scope: p.scope,
    categoryId: p.categoryId,
    categoryName: p.categoryId ? categoriesDb.get(p.categoryId)?.name : undefined,
    menuItemIds: p.menuItemIds,
    minOrderAmount: p.minOrderAmount,
    startTime: p.startTime,
    endTime: p.endTime,
    daysOfWeek: p.daysOfWeek,
    startDate: p.startDate,
    endDate: p.endDate,
    isPaused: p.isPaused,
    status: promotionStatusAt(p),
    updatedAt: p.updatedAt,
  }
}

export function voucherStatusOf(v: VoucherRecord, at = new Date()): VoucherStatus {
  if (v.isPaused) return 'TamDung'
  if (v.expiresAt && new Date(v.expiresAt).getTime() < at.getTime()) return 'HetHan'
  if (v.maxUses !== undefined && v.maxUses !== null && v.usedCount >= v.maxUses) return 'HetLuot'
  return 'HoatDong'
}

export function toVoucherDto(v: VoucherRecord): VoucherDto {
  return {
    id: v.id,
    code: v.code,
    description: v.description,
    discountType: v.discountType,
    discountValue: v.discountValue,
    maxDiscount: v.maxDiscount,
    minOrderAmount: v.minOrderAmount,
    maxUses: v.maxUses,
    usedCount: v.usedCount,
    expiresAt: v.expiresAt,
    isPaused: v.isPaused,
    status: voucherStatusOf(v),
    updatedAt: v.updatedAt,
  }
}

/** Khuyến mãi đang chạy hôm nay (chưa xét khung giờ) cho màn bán hàng */
export function activePromotions(): PromotionDto[] {
  return promotionsDb
    .all()
    .map(toPromotionDto)
    .filter((p) => p.status === 'DangChay')
}

/**
 * Kiểm tra voucher theo thứ tự 07 §2.7, trả bản ghi hợp lệ; sai → 400 errors.code với câu đúng chữ.
 * Dùng chung cho /api/vouchers/check và thanh toán.
 */
export function validateVoucher(
  code: string,
  subtotal: number,
  at = new Date(),
  /** Khóa lỗi: 'code' khi kiểm tra voucher, 'voucherCode' khi thanh toán (07 §5 #16) */
  field: 'code' | 'voucherCode' = 'code'
): VoucherRecord {
  const normalized = (code ?? '').trim().toUpperCase()
  const fail = (message: string): never => {
    throw validation({ [field]: message }, message)
  }
  const voucher = vouchersDb.find((v) => v.code === normalized)
  if (!voucher) return fail('Voucher không tồn tại')
  if (voucher.isPaused) return fail('Voucher đang tạm dừng')
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < at.getTime())
    return fail('Voucher đã hết hạn')
  if (
    voucher.maxUses !== undefined &&
    voucher.maxUses !== null &&
    voucher.usedCount >= voucher.maxUses
  ) {
    return fail('Voucher đã hết lượt')
  }
  if (subtotal < voucher.minOrderAmount)
    return fail(`Đơn tối thiểu ${formatVnd(voucher.minOrderAmount)}`)
  return voucher
}

export const toPricingVoucher = (v: VoucherRecord): PricingVoucher => ({
  voucherId: v.id,
  code: v.code,
  discountType: v.discountType,
  discountValue: v.discountValue,
  maxDiscount: v.maxDiscount,
  minOrderAmount: v.minOrderAmount,
})

function getPromotionOr404(id: string) {
  const p = promotionsDb.get(id)
  if (!p) throw notFound('Không tìm thấy khuyến mãi.')
  return p
}
function getVoucherOr404(id: string) {
  const v = vouchersDb.get(id)
  if (!v) throw notFound('Không tìm thấy voucher.')
  return v
}

function validatePromotion(input: SavePromotionRequest) {
  const errors: Record<string, string> = {}
  if (!input.name?.trim()) errors.name = 'Nhập tên khuyến mãi'
  if (input.discountType === 'PhanTram') {
    if (!(input.discountValue >= 1 && input.discountValue <= 100))
      errors.discountValue = 'Phần trăm từ 1 đến 100'
  } else if (!(input.discountValue > 0) || input.discountValue % 1000 !== 0) {
    errors.discountValue = 'Số tiền phải là bội số 1.000 ₫'
  }
  if (input.scope === 'DanhMuc' && !input.categoryId) errors.categoryId = 'Chọn danh mục'
  if (input.scope === 'Mon' && !input.menuItemIds?.length)
    errors.menuItemIds = 'Chọn ít nhất một món'
  if (!DATE.test(input.startDate ?? '')) errors.startDate = 'Chọn ngày bắt đầu'
  if (!DATE.test(input.endDate ?? '')) errors.endDate = 'Chọn ngày kết thúc'
  else if (input.endDate < input.startDate) errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu'
  if ((input.startTime && !input.endTime) || (!input.startTime && input.endTime)) {
    errors.endTime = 'Nhập đủ giờ bắt đầu và kết thúc'
  } else if (input.startTime && input.endTime) {
    if (!TIME.test(input.startTime) || !TIME.test(input.endTime)) errors.endTime = 'Giờ dạng HH:mm'
    else if (input.endTime <= input.startTime) errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu'
  }
  if (Object.keys(errors).length) throw validation(errors)
}

function validateVoucherInput(input: SaveVoucherRequest, excludeId?: string): string {
  const errors: Record<string, string> = {}
  const code = (input.code ?? '').trim().toUpperCase()
  if (!VOUCHER_CODE.test(code)) errors.code = 'Mã 4–12 ký tự chữ in hoa và số'
  if (input.discountType === 'PhanTram') {
    if (!(input.discountValue >= 1 && input.discountValue <= 100))
      errors.discountValue = 'Phần trăm từ 1 đến 100'
  } else if (!(input.discountValue > 0) || input.discountValue % 1000 !== 0) {
    errors.discountValue = 'Số tiền phải là bội số 1.000 ₫'
  }
  if (input.minOrderAmount < 0) errors.minOrderAmount = 'Không âm'
  if (Object.keys(errors).length) throw validation(errors)
  if (vouchersDb.some((v) => v.code === code && v.id !== excludeId)) {
    throw conflict(`Mã voucher ${code} đã tồn tại.`, { code: 'Mã voucher đã tồn tại' })
  }
  return code
}

export const promotionMock = {
  async getPromotions(query: PromotionQuery): Promise<PaginatedResult<PromotionDto>> {
    await mockDelay()
    requirePermission(permissions.promotions.view)
    const items = promotionsDb
      .all()
      .map(toPromotionDto)
      .filter((p) => !query.status || p.status === query.status)
    return listQuery(items, query, {
      searchFields: ['code', 'name'],
      defaultSortBy: 'startDate',
      defaultSortDir: 'desc',
    })
  },

  async getActivePromotions(): Promise<PromotionDto[]> {
    await mockDelay(100, 200)
    requirePermission(permissions.orders.create)
    return activePromotions()
  },

  async getPromotion(id: string): Promise<PromotionDto> {
    await mockDelay()
    requirePermission(permissions.promotions.view)
    return toPromotionDto(getPromotionOr404(id))
  },

  async createPromotion(input: SavePromotionRequest): Promise<PromotionDto> {
    await mockDelay()
    requirePermission(permissions.promotions.create)
    validatePromotion(input)
    const record = promotionsDb.insert({
      id: newId(),
      code: nextCode(promotionsDb.all(), 'code', 'KM', 2),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscount: input.discountType === 'PhanTram' ? input.maxDiscount || undefined : undefined,
      scope: input.scope,
      categoryId: input.scope === 'DanhMuc' ? input.categoryId : undefined,
      menuItemIds: input.scope === 'Mon' ? input.menuItemIds : [],
      minOrderAmount: input.minOrderAmount || 0,
      startTime: input.startTime || undefined,
      endTime: input.endTime || undefined,
      daysOfWeek: [...(input.daysOfWeek ?? [])].sort(),
      startDate: input.startDate,
      endDate: input.endDate,
      isPaused: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    auditCreate('Promotion', record)
    return toPromotionDto(record)
  },

  async updatePromotion(id: string, input: SavePromotionRequest): Promise<PromotionDto> {
    await mockDelay()
    requirePermission(permissions.promotions.update)
    const before = getPromotionOr404(id)
    validatePromotion(input)
    const after = promotionsDb.update(id, {
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscount: input.discountType === 'PhanTram' ? input.maxDiscount || undefined : undefined,
      scope: input.scope,
      categoryId: input.scope === 'DanhMuc' ? input.categoryId : undefined,
      menuItemIds: input.scope === 'Mon' ? input.menuItemIds : [],
      minOrderAmount: input.minOrderAmount || 0,
      startTime: input.startTime || undefined,
      endTime: input.endTime || undefined,
      daysOfWeek: [...(input.daysOfWeek ?? [])].sort(),
      startDate: input.startDate,
      endDate: input.endDate,
      updatedAt: nowIso(),
    })!
    auditUpdate('Promotion', before, after)
    return toPromotionDto(after)
  },

  async pausePromotion(id: string, input: PauseRequest): Promise<void> {
    await mockDelay()
    requirePermission(permissions.promotions.update)
    const before = getPromotionOr404(id)
    const after = promotionsDb.update(id, { isPaused: !!input.isPaused, updatedAt: nowIso() })!
    auditUpdate('Promotion', before, after)
  },

  async deletePromotion(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.promotions.delete)
    const record = getPromotionOr404(id)
    promotionsDb.remove(id)
    auditDelete('Promotion', record)
  },

  // ───────── voucher ─────────
  async getVouchers(query: VoucherQuery): Promise<PaginatedResult<VoucherDto>> {
    await mockDelay()
    requirePermission(permissions.promotions.view)
    const items = vouchersDb
      .all()
      .map(toVoucherDto)
      .filter((v) => !query.status || v.status === query.status)
    return listQuery(items, query, {
      searchFields: ['code', 'description'],
      defaultSortBy: 'updatedAt',
    })
  },

  async getVoucher(id: string): Promise<VoucherDto> {
    await mockDelay()
    requirePermission(permissions.promotions.view)
    return toVoucherDto(getVoucherOr404(id))
  },

  async createVoucher(input: SaveVoucherRequest): Promise<VoucherDto> {
    await mockDelay()
    requirePermission(permissions.promotions.create)
    const code = validateVoucherInput(input)
    const record = vouchersDb.insert({
      id: newId(),
      code,
      description: input.description?.trim() || undefined,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscount: input.discountType === 'PhanTram' ? input.maxDiscount || undefined : undefined,
      minOrderAmount: input.minOrderAmount || 0,
      maxUses: input.maxUses || undefined,
      usedCount: 0,
      expiresAt: input.expiresAt || undefined,
      isPaused: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    auditCreate('Voucher', record)
    return toVoucherDto(record)
  },

  async updateVoucher(id: string, input: SaveVoucherRequest): Promise<VoucherDto> {
    await mockDelay()
    requirePermission(permissions.promotions.update)
    const before = getVoucherOr404(id)
    const code = validateVoucherInput(input, id)
    if (code !== before.code) {
      throw validation(
        { code: 'Không đổi được mã voucher, tạo voucher mới' },
        'Không đổi được mã voucher, tạo voucher mới'
      )
    }
    const after = vouchersDb.update(id, {
      code,
      description: input.description?.trim() || undefined,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscount: input.discountType === 'PhanTram' ? input.maxDiscount || undefined : undefined,
      minOrderAmount: input.minOrderAmount || 0,
      maxUses: input.maxUses || undefined,
      expiresAt: input.expiresAt || undefined,
      updatedAt: nowIso(),
    })!
    auditUpdate('Voucher', before, after)
    return toVoucherDto(after)
  },

  async pauseVoucher(id: string, input: PauseRequest): Promise<void> {
    await mockDelay()
    requirePermission(permissions.promotions.update)
    const before = getVoucherOr404(id)
    const after = vouchersDb.update(id, { isPaused: !!input.isPaused, updatedAt: nowIso() })!
    auditUpdate('Voucher', before, after)
  },

  async deleteVoucher(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.promotions.delete)
    const record = getVoucherOr404(id)
    if (record.usedCount > 0) throw domain('Voucher đã được dùng, chỉ có thể tạm dừng')
    vouchersDb.remove(id)
    auditDelete('Voucher', record)
  },

  /** POST /api/vouchers/check (UC-06 1b, TC-19, TC-20) */
  async checkVoucher(input: VoucherCheckRequest): Promise<VoucherCheckResult> {
    await mockDelay(150, 300)
    requirePermission(permissions.orders.discount)
    const voucher = validateVoucher(input.code, input.subtotal)
    const pricing = toPricingVoucher(voucher)
    // Ước tính trên subtotal (chưa có giảm dòng), BE tính lại khi thanh toán
    const estimated = priceCart({
      lines: [
        {
          menuItemId: 'x',
          itemCode: 'x',
          itemName: 'x',
          categoryId: 'x',
          sizeName: 'x',
          sizePrice: input.subtotal,
          toppings: [],
          quantity: 1,
        },
      ],
      voucher: pricing,
      promotions: [],
      at: new Date(),
    })
    return { ...pricing, estimatedDiscount: estimated.voucher?.amount ?? 0 }
  },
}
