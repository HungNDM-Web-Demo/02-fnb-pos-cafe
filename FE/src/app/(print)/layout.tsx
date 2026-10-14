import { AuthGuard } from '@/features/auth/components/AuthGuard'

/** Trang in (hóa đơn, phiếu chốt ca): cần đăng nhập, không sidebar, CSS @page 80 mm (NFR-04). */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
