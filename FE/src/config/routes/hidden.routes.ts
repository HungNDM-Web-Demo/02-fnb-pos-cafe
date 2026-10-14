import { Printer, UserRound } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavItem } from './index'

/** Trang không nằm trong menu nhưng cần tiêu đề trên Header và kiểm tra quyền. */
export const hiddenRoutes: NavItem[] = [
  {
    title: 'Hồ sơ cá nhân',
    href: routePath.profile,
    icon: UserRound,
  },
  {
    // Khớp dài hơn /shifts nên thu ngân (không có shifts.view) vẫn in được phiếu chốt ca của mình
    title: 'Phiếu chốt ca',
    href: '/shifts/receipt',
    icon: Printer,
    permission: permissions.shifts.operate,
  },
  {
    title: 'Hóa đơn',
    href: '/pos/receipt',
    icon: Printer,
    permission: [permissions.orders.view, permissions.orders.create],
  },
]
