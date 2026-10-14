'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useApproveDiscount } from '@/features/orders/hooks/use-orders'
import type { DiscountApprovalDto } from '@/features/orders/types/order.types'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'

type ManagerApprovalDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Số tiền giảm thủ công đang xin và hạn mức thu ngân */
  requested: number
  limit: number
  onApproved: (approval: DiscountApprovalDto) => void
}

/**
 * FR-15: giảm giá vượt hạn mức 10% cần quản lý nhập tài khoản ngay trên tablet
 * (POST /api/orders/discount-approvals). Sai mật khẩu hay thiếu quyền → từ chối, đơn giữ nguyên (TC-18).
 */
export function ManagerApprovalDialog({
  open,
  onOpenChange,
  requested,
  limit,
  onApproved,
}: ManagerApprovalDialogProps) {
  const approve = useApproveDiscount()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setUsername('')
      setPassword('')
      setError(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) return setError('Nhập tên đăng nhập và mật khẩu của quản lý')
    approve.mutate(
      { username: username.trim(), password },
      {
        onSuccess: (result) => {
          onApproved(result)
          onOpenChange(false)
        },
        onError: (err) => {
          setError(getErrorMessage(err))
          setPassword('')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !approve.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sm:flex-row sm:items-start sm:gap-4">
          <span
            className="bg-warning/12 text-warning flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <ShieldCheck className="size-5" />
          </span>
          <div className="space-y-1.5">
            <DialogTitle>Quản lý xác nhận giảm giá</DialogTitle>
            <DialogDescription>
              Giảm {formatVnd(requested)} vượt hạn mức thu ngân {formatVnd(limit)} (10% tổng tiền
              hàng). Quản lý nhập tài khoản để duyệt; tên người duyệt sẽ ghi trên hóa đơn.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="grid gap-4">
          {error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <FormField label="Tên đăng nhập quản lý" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="vd: quanly"
              className="h-11"
              autoFocus
            />
          </FormField>
          <FormField label="Mật khẩu" required>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              className="h-11"
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={approve.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={approve.isPending}>
              {approve.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
