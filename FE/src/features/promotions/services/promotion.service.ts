import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { promotionMock } from '../mock/promotion.mock'
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
} from '../types/promotion.types'

/** Service khuyến mãi, voucher (07 §2.7): chọn mock hoặc API. */
export const promotionService = {
  getPromotions: (query: PromotionQuery): Promise<PaginatedResult<PromotionDto>> =>
    isMockMode()
      ? promotionMock.getPromotions(query)
      : apiCall.get<PaginatedResult<PromotionDto>>(apiRoutes.promotions.list, { params: query }),
  getActivePromotions: (): Promise<PromotionDto[]> =>
    isMockMode()
      ? promotionMock.getActivePromotions()
      : apiCall.get<PromotionDto[]>(apiRoutes.promotions.active),
  createPromotion: (input: SavePromotionRequest): Promise<PromotionDto> =>
    isMockMode()
      ? promotionMock.createPromotion(input)
      : apiCall.post<PromotionDto>(apiRoutes.promotions.list, input),
  updatePromotion: (id: string, input: SavePromotionRequest): Promise<PromotionDto> =>
    isMockMode()
      ? promotionMock.updatePromotion(id, input)
      : apiCall.put<PromotionDto>(apiRoutes.promotions.detail(id), input),
  pausePromotion: (id: string, input: PauseRequest): Promise<void> =>
    isMockMode()
      ? promotionMock.pausePromotion(id, input)
      : apiCall.patch(apiRoutes.promotions.pause(id), input),
  deletePromotion: (id: string): Promise<void> =>
    isMockMode()
      ? promotionMock.deletePromotion(id)
      : apiCall.delete(apiRoutes.promotions.detail(id)),

  getVouchers: (query: VoucherQuery): Promise<PaginatedResult<VoucherDto>> =>
    isMockMode()
      ? promotionMock.getVouchers(query)
      : apiCall.get<PaginatedResult<VoucherDto>>(apiRoutes.vouchers.list, { params: query }),
  createVoucher: (input: SaveVoucherRequest): Promise<VoucherDto> =>
    isMockMode()
      ? promotionMock.createVoucher(input)
      : apiCall.post<VoucherDto>(apiRoutes.vouchers.list, input),
  updateVoucher: (id: string, input: SaveVoucherRequest): Promise<VoucherDto> =>
    isMockMode()
      ? promotionMock.updateVoucher(id, input)
      : apiCall.put<VoucherDto>(apiRoutes.vouchers.detail(id), input),
  pauseVoucher: (id: string, input: PauseRequest): Promise<void> =>
    isMockMode()
      ? promotionMock.pauseVoucher(id, input)
      : apiCall.patch(apiRoutes.vouchers.pause(id), input),
  deleteVoucher: (id: string): Promise<void> =>
    isMockMode() ? promotionMock.deleteVoucher(id) : apiCall.delete(apiRoutes.vouchers.detail(id)),
  checkVoucher: (input: VoucherCheckRequest): Promise<VoucherCheckResult> =>
    isMockMode()
      ? promotionMock.checkVoucher(input)
      : apiCall.post<VoucherCheckResult>(apiRoutes.vouchers.check, input),
}
