import { AuthGuard } from '@/features/auth/components/AuthGuard'

/** Màn bán hàng toàn màn hình: cần đăng nhập nhưng không có sidebar (07 §4 "Bán hàng mở full-screen"). */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
