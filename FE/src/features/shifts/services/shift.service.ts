import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { shiftMock } from '../mock/shift.mock'
import type {
  CloseShiftRequest,
  OpenShiftRequest,
  ReviewShiftRequest,
  ShiftDetail,
  ShiftDto,
  ShiftListItem,
  ShiftQuery,
  ShiftSummary,
} from '../types/shift.types'

/** 204 của BE: axios trả chuỗi rỗng → đổi thành null */
const nullable = <T>(value: T | '' | undefined): T | null =>
  value === '' || value === undefined ? null : value

/** Service ca làm (07 §2.6): chọn mock hoặc API. */
export const shiftService = {
  getCurrent: async (): Promise<ShiftDto | null> =>
    isMockMode()
      ? shiftMock.getCurrent()
      : nullable(await apiCall.get<ShiftDto | ''>(apiRoutes.shifts.current)),

  open: (input: OpenShiftRequest): Promise<ShiftDto> =>
    isMockMode() ? shiftMock.open(input) : apiCall.post<ShiftDto>(apiRoutes.shifts.list, input),

  getCurrentSummary: async (): Promise<ShiftSummary | null> =>
    isMockMode()
      ? shiftMock.getCurrentSummary()
      : nullable(await apiCall.get<ShiftSummary | ''>(apiRoutes.shifts.currentSummary)),

  close: (input: CloseShiftRequest): Promise<ShiftDto> =>
    isMockMode() ? shiftMock.close(input) : apiCall.post<ShiftDto>(apiRoutes.shifts.close, input),

  getList: (query: ShiftQuery): Promise<PaginatedResult<ShiftListItem>> =>
    isMockMode()
      ? shiftMock.getList(query)
      : apiCall.get<PaginatedResult<ShiftListItem>>(apiRoutes.shifts.list, { params: query }),

  getById: (id: string): Promise<ShiftDetail> =>
    isMockMode() ? shiftMock.getById(id) : apiCall.get<ShiftDetail>(apiRoutes.shifts.detail(id)),

  review: (id: string, input: ReviewShiftRequest): Promise<ShiftDto> =>
    isMockMode()
      ? shiftMock.review(id, input)
      : apiCall.patch<ShiftDto>(apiRoutes.shifts.review(id), input),
}
