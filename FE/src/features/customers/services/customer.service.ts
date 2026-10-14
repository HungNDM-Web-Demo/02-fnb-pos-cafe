import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { customerMock } from '../mock/customer.mock'
import type {
  CustomerDetail,
  CustomerDto,
  CustomerQuery,
  SaveCustomerRequest,
} from '../types/customer.types'

/** Service khách hàng (07 §2.9): chọn mock hoặc API. */
export const customerService = {
  getList: (query: CustomerQuery): Promise<PaginatedResult<CustomerDto>> =>
    isMockMode()
      ? customerMock.getList(query)
      : apiCall.get<PaginatedResult<CustomerDto>>(apiRoutes.customers.list, { params: query }),
  lookup: (phone: string): Promise<CustomerDto> =>
    isMockMode()
      ? customerMock.lookup(phone)
      : apiCall.get<CustomerDto>(apiRoutes.customers.lookup, { params: { phone } }),
  getById: (id: string): Promise<CustomerDetail> =>
    isMockMode()
      ? customerMock.getById(id)
      : apiCall.get<CustomerDetail>(apiRoutes.customers.detail(id)),
  create: (input: SaveCustomerRequest): Promise<CustomerDto> =>
    isMockMode()
      ? customerMock.create(input)
      : apiCall.post<CustomerDto>(apiRoutes.customers.list, input),
  update: (id: string, input: SaveCustomerRequest): Promise<CustomerDto> =>
    isMockMode()
      ? customerMock.update(id, input)
      : apiCall.put<CustomerDto>(apiRoutes.customers.detail(id), input),
}
