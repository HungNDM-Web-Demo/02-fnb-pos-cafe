import {
  BadgePercent,
  ChartColumn,
  Clock,
  Coffee,
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  UsersRound,
  Wallet,
} from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/**
 * Menu chính của POS Quán Cafe (07-DANH-SACH-API §4 "Menu sidebar").
 * - Bán hàng mở toàn màn hình (app/(pos)), không có sidebar.
 * - "Ca của tôi" chỉ hiện với người không có `shifts.view` (quản lý xem ở Ca làm).
 * - Thực đơn gắn thêm `menu-items.update` nên thu ngân không thấy.
 * - Khách hàng chỉ hiện với người có `orders.view-all`.
 */
export const mainRoutes: NavGroup = {
  id: 'main',
  items: [
    {
      title: 'Tổng quan',
      href: routePath.dashboard,
      icon: LayoutDashboard,
      permission: permissions.dashboard.view,
      description: 'Doanh thu hôm nay, giờ cao điểm, món bán chạy',
    },
    {
      title: 'Bán hàng',
      href: routePath.pos,
      icon: ShoppingCart,
      permission: permissions.orders.create,
      description: 'Màn bán hàng cho thu ngân, tối ưu máy tính bảng',
    },
    {
      title: 'Hóa đơn',
      href: routePath.orders,
      icon: Receipt,
      permission: permissions.orders.view,
      description: 'Tra cứu, in lại, hủy hóa đơn',
    },
    {
      title: 'Ca làm',
      href: routePath.shifts,
      icon: Clock,
      permission: permissions.shifts.view,
      description: 'Danh sách ca, ca cần kiểm tra',
    },
    {
      title: 'Ca của tôi',
      href: routePath.shiftsCurrent,
      icon: Wallet,
      permission: permissions.shifts.operate,
      hideWhen: permissions.shifts.view,
      description: 'Mở ca, chốt ca, đối soát tiền mặt',
    },
    {
      title: 'Thực đơn',
      href: routePath.menuItems,
      icon: Coffee,
      permission: permissions.menuItems.update,
      description: 'Danh mục, món, size, topping',
    },
    {
      title: 'Khuyến mãi',
      href: routePath.promotions,
      icon: BadgePercent,
      permission: permissions.promotions.view,
      description: 'Chương trình khuyến mãi và voucher',
    },
    {
      title: 'Báo cáo',
      href: routePath.reports,
      icon: ChartColumn,
      permission: permissions.reports.view,
      description: 'Doanh thu, món bán chạy, khung giờ, thu ngân',
    },
    {
      title: 'Khách hàng',
      href: routePath.customers,
      icon: UsersRound,
      permission: permissions.orders.viewAll,
      description: 'Khách tích điểm và lịch sử mua',
    },
  ],
}
