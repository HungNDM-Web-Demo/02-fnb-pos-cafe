import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { PHONE_MESSAGE, cleanPhone, isValidPhone } from '@/lib/validators'
import { auditCreate, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { conflict, notFound, validation } from '@/mock/mock-errors'
import { listQuery, newId } from '@/mock/mock-helpers'
import { toOrderListItem } from '@/features/orders/mock/order.mock'
import { customersDb, ordersDb } from '@/features/pos/mock/pos.db'
import type { PaginatedResult } from '@/types/api'
import type {
  CustomerDetail,
  CustomerDto,
  CustomerQuery,
  SaveCustomerRequest,
} from '../types/customer.types'

/** Handler /api/customers ở chế độ mock (07 §2.9). */

function getOr404(id: string) {
  const c = customersDb.get(id)
  if (!c) throw notFound('Không tìm thấy khách hàng.')
  return c
}

function validate(input: SaveCustomerRequest) {
  const errors: Record<string, string> = {}
  const phone = cleanPhone(input.phone) ?? ''
  if (!phone || !isValidPhone(phone)) errors.phone = PHONE_MESSAGE
  if (!input.name?.trim()) errors.name = 'Nhập tên khách'
  if (Object.keys(errors).length) throw validation(errors)
  return phone
}

export const customerMock = {
  async getList(query: CustomerQuery): Promise<PaginatedResult<CustomerDto>> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    return listQuery(customersDb.all(), query, {
      searchFields: ['phone', 'name'],
      defaultSortBy: 'lastOrderAt',
    })
  },

  /** GET /api/customers/lookup?phone= */
  async lookup(phone: string): Promise<CustomerDto> {
    await mockDelay(100, 250)
    requirePermission(permissions.customers.view)
    const normalized = cleanPhone(phone) ?? ''
    const found = customersDb.find((c) => c.phone === normalized)
    if (!found) throw notFound('Chưa có khách với số điện thoại này.')
    return found
  },

  async getById(id: string): Promise<CustomerDetail> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    const customer = getOr404(id)
    const recentOrders = ordersDb
      .filter((o) => o.customer?.id === id && o.status !== 'DangGiu')
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
      .slice(0, 20)
      .map(toOrderListItem)
    return { ...customer, recentOrders }
  },

  async create(input: SaveCustomerRequest): Promise<CustomerDto> {
    await mockDelay()
    requirePermission(permissions.customers.create)
    const phone = validate(input)
    if (customersDb.some((c) => c.phone === phone)) {
      throw conflict('Số điện thoại đã có khách.', { phone: 'Số điện thoại đã có khách' })
    }
    const record = customersDb.insert({
      id: newId(),
      phone,
      name: input.name.trim(),
      note: input.note?.trim() || undefined,
      points: 0,
      orderCount: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
    })
    auditCreate('Customer', record)
    return record
  },

  async update(id: string, input: SaveCustomerRequest): Promise<CustomerDto> {
    await mockDelay()
    requirePermission(permissions.customers.create)
    const before = getOr404(id)
    const phone = validate({ ...input, phone: input.phone || before.phone })
    if (customersDb.some((c) => c.phone === phone && c.id !== id)) {
      throw conflict('Số điện thoại đã có khách.', { phone: 'Số điện thoại đã có khách' })
    }
    const after = customersDb.update(id, {
      phone,
      name: input.name.trim(),
      note: input.note?.trim() || undefined,
    })!
    auditUpdate('Customer', before, after)
    return after
  },
}
