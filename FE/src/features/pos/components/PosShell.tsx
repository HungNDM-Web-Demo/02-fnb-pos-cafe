'use client'

import Link from 'next/link'
import { Clock, LogOut, PauseCircle, Receipt } from 'lucide-react'
import { DemoToolbar } from '@/components/demo/DemoToolbar'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { UserMenu } from '@/components/shared/UserMenu'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { resolveHomePath } from '@/config/routes'
import type { ShiftDto } from '@/features/shifts/types/shift.types'
import { usePermissions } from '@/hooks/use-permissions'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type PosShellProps = {
  shift: ShiftDto | null | undefined
  heldCount?: number
  onOpenHeld?: () => void
  children: React.ReactNode
}

/** Khung màn bán hàng toàn màn hình (không sidebar): thanh trên gọn, nội dung chiếm hết chiều cao. */
export function PosShell({ shift, heldCount = 0, onOpenHeld, children }: PosShellProps) {
  const { can } = usePermissions()
  const home = resolveHomePath(can)
  const exitHref = home === routePath.pos ? routePath.orders : home

  return (
    <div className="bg-background flex h-svh flex-col overflow-hidden">
      <header className="bg-card flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <BrandLogo size="sm" />
        <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />
        {shift ? (
          <span
            className="flex min-w-0 items-center gap-2 text-sm whitespace-nowrap"
            aria-live="polite"
          >
            <span className="bg-success size-2 rounded-full" aria-hidden="true" />
            <span className="font-semibold">{shift.code}</span>
            <span className="text-muted-foreground hidden truncate xl:inline">
              mở {formatTime(shift.openedAt)} · {shift.cashierName}
            </span>
          </span>
        ) : (
          <span className="text-warning flex items-center gap-2 text-sm font-medium">
            <span className="bg-warning size-2 rounded-full" aria-hidden="true" />
            Chưa mở ca
          </span>
        )}
        <span className="flex-1" />
        <Button
          variant="outline"
          className={cn('h-10', heldCount > 0 && 'border-primary/50 text-primary')}
          onClick={onOpenHeld}
          disabled={!shift}
        >
          <PauseCircle aria-hidden="true" />
          Đơn giữ
          {heldCount > 0 && (
            <span className="bg-primary text-primary-foreground ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold">
              {heldCount}
            </span>
          )}
        </Button>
        {can(permissions.shifts.operate) && (
          <Button asChild variant="outline" className="h-10">
            <Link href={routePath.shiftsCurrent}>
              <Clock aria-hidden="true" />
              Ca của tôi
            </Link>
          </Button>
        )}
        {can(permissions.orders.view) && (
          <Button asChild variant="outline" className="h-10">
            <Link href={routePath.orders}>
              <Receipt aria-hidden="true" />
              Hóa đơn
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost" className="h-10" title="Rời màn bán hàng">
          <Link href={exitHref}>
            <LogOut aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Thoát</span>
          </Link>
        </Button>
        <ThemeToggle />
        <UserMenu />
      </header>
      {/* Chừa chỗ cho nút công cụ demo nổi góc dưới phải để không che nút Thanh toán */}
      <main className={cn('min-h-0 flex-1 p-3', appConfig.demoToolbar && 'pb-[4.5rem]')}>
        {children}
      </main>
      <DemoToolbar />
    </div>
  )
}
