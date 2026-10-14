import type { StatusTone } from '@/components/shared/StatusBadge'
import type { AuditAction } from './types/audit-log.types'

/** Nhãn hiển thị cho nhật ký. Dự án thêm tên entity và tên cột nghiệp vụ của mình vào đây. */

export const auditActionLabels: Record<AuditAction, { label: string; tone: StatusTone }> = {
  Create: { label: 'Thêm', tone: 'success' },
  Update: { label: 'Sửa', tone: 'info' },
  Delete: { label: 'Xóa', tone: 'danger' },
  Login: { label: 'Đăng nhập', tone: 'neutral' },
}

/** Tên entity (BE) → tên tiếng Việt; cũng là danh sách cho bộ lọc "Đối tượng". */
export const auditEntityLabels: Record<string, string> = {
  User: 'Tài khoản',
  Role: 'Vai trò',
  Setting: 'Cài đặt',
  Category: 'Danh mục món',
  MenuItem: 'Món',
  Topping: 'Topping',
  Order: 'Hóa đơn',
  Shift: 'Ca làm',
  Promotion: 'Khuyến mãi',
  Voucher: 'Voucher',
  Customer: 'Khách hàng',
}

/** Tên cột (camelCase) → nhãn tiếng Việt trong bảng "trước / sau". */
export const auditFieldLabels: Record<string, string> = {
  username: 'Tên đăng nhập',
  fullName: 'Họ tên',
  email: 'Email',
  phone: 'Số điện thoại',
  avatarUrl: 'Ảnh đại diện',
  isActive: 'Đang hoạt động',
  isDemoAccount: 'Tài khoản demo',
  lastLoginAt: 'Đăng nhập gần nhất',
  roleIds: 'Vai trò',
  code: 'Mã',
  name: 'Tên',
  description: 'Mô tả',
  isSystem: 'Vai trò hệ thống',
  permissions: 'Quyền',
  key: 'Khóa',
  value: 'Giá trị',
  groupName: 'Nhóm',
  quickLogin: 'Đăng nhập nhanh',
  sortOrder: 'Thứ tự',
  status: 'Trạng thái',
  createdAt: 'Ngày tạo',
  updatedAt: 'Ngày sửa',
  // Thực đơn
  color: 'Màu',
  isHidden: 'Ẩn',
  isSoldOut: 'Tạm hết',
  categoryId: 'Danh mục',
  categoryName: 'Danh mục',
  imageUrl: 'Ảnh',
  hasSugarOption: 'Tùy chọn đường',
  hasIceOption: 'Tùy chọn đá',
  sizes: 'Size',
  minPrice: 'Giá thấp nhất',
  toppingIds: 'Topping',
  price: 'Giá',
  // Hóa đơn, ca
  shiftId: 'Ca',
  shiftCode: 'Mã ca',
  cashierName: 'Thu ngân',
  serviceType: 'Hình thức',
  tableTag: 'Số thẻ bàn',
  items: 'Món',
  subtotal: 'Tổng tiền hàng',
  discountTotal: 'Tổng giảm',
  total: 'Tổng thanh toán',
  payment: 'Thanh toán',
  paidAt: 'Thanh toán lúc',
  cancelledAt: 'Hủy lúc',
  cancelledByName: 'Người hủy',
  cancelReason: 'Lý do hủy',
  holdName: 'Tên đơn giữ',
  openedAt: 'Giờ mở',
  closedAt: 'Giờ chốt',
  openingCash: 'Tiền đầu ca',
  expectedCash: 'Tiền mặt lý thuyết',
  countedCash: 'Tiền thực đếm',
  difference: 'Chênh lệch',
  note: 'Ghi chú',
  reviewNote: 'Ghi chú xử lý',
  reviewedByName: 'Người kiểm tra',
  reviewedAt: 'Kiểm tra lúc',
  // Khuyến mãi
  discountType: 'Kiểu giảm',
  discountValue: 'Giá trị giảm',
  maxDiscount: 'Giảm tối đa',
  scope: 'Phạm vi',
  minOrderAmount: 'Đơn tối thiểu',
  startTime: 'Giờ bắt đầu',
  endTime: 'Giờ kết thúc',
  daysOfWeek: 'Ngày trong tuần',
  startDate: 'Hiệu lực từ',
  endDate: 'Hiệu lực đến',
  isPaused: 'Tạm dừng',
  maxUses: 'Số lượt tối đa',
  usedCount: 'Đã dùng',
  expiresAt: 'Hạn dùng',
  // Khách hàng
  points: 'Điểm',
  orderCount: 'Số hóa đơn',
  totalSpent: 'Tổng chi',
  lastOrderAt: 'Mua gần nhất',
}

export const entityLabel = (name: string) => auditEntityLabels[name] ?? name
export const fieldLabel = (name: string) => auditFieldLabels[name] ?? name
