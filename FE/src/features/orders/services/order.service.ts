import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { orderMock } from '../mock/order.mock'
import type {
  CancelOrderRequest,
  CheckoutRequest,
  DiscountApprovalDto,
  DiscountApprovalRequest,
  HeldOrderDto,
  HoldOrderRequest,
  NextCodeResult,
  OrderDto,
  OrderListItem,
  OrderQuery,
} from '../types/order.types'

/** Service bán hàng, hóa đơn (07 §2.5): chọn mock hoặc API. */
export const orderService = {
  getList: (query: OrderQuery): Promise<PaginatedResult<OrderListItem>> =>
    isMockMode()
      ? orderMock.getList(query)
      : apiCall.get<PaginatedResult<OrderListItem>>(apiRoutes.orders.list, { params: query }),

  getById: (id: string): Promise<OrderDto> =>
    isMockMode() ? orderMock.getById(id) : apiCall.get<OrderDto>(apiRoutes.orders.detail(id)),

  nextCode: (): Promise<NextCodeResult> =>
    isMockMode() ? orderMock.nextCode() : apiCall.get<NextCodeResult>(apiRoutes.orders.nextCode),

  /** 201 tạo mới hoặc 200 trả hóa đơn cũ cùng clientRequestId: FE xử lý như nhau (TC-24) */
  checkout: (request: CheckoutRequest): Promise<OrderDto> =>
    isMockMode()
      ? orderMock.checkout(request)
      : apiCall.post<OrderDto>(apiRoutes.orders.list, request),

  cancel: (id: string, input: CancelOrderRequest): Promise<OrderDto> =>
    isMockMode()
      ? orderMock.cancel(id, input)
      : apiCall.post<OrderDto>(apiRoutes.orders.cancel(id), input),

  getHeld: (): Promise<HeldOrderDto[]> =>
    isMockMode() ? orderMock.getHeld() : apiCall.get<HeldOrderDto[]>(apiRoutes.orders.held),

  hold: (request: HoldOrderRequest): Promise<HeldOrderDto> =>
    isMockMode()
      ? orderMock.hold(request)
      : apiCall.post<HeldOrderDto>(apiRoutes.orders.held, request),

  updateHeld: (id: string, request: HoldOrderRequest): Promise<HeldOrderDto> =>
    isMockMode()
      ? orderMock.updateHeld(id, request)
      : apiCall.put<HeldOrderDto>(apiRoutes.orders.heldDetail(id), request),

  deleteHeld: (id: string): Promise<void> =>
    isMockMode() ? orderMock.deleteHeld(id) : apiCall.delete(apiRoutes.orders.heldDetail(id)),

  approveDiscount: (request: DiscountApprovalRequest): Promise<DiscountApprovalDto> =>
    isMockMode()
      ? orderMock.approveDiscount(request)
      : apiCall.post<DiscountApprovalDto>(apiRoutes.orders.discountApprovals, request),
}
