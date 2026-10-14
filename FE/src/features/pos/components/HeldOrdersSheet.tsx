'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, FolderOpen, Loader2, PauseCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteHeldOrder, useHeldOrders } from '@/features/orders/hooks/use-orders'
import type { HeldOrderDto } from '@/features/orders/types/order.types'
import { getErrorMessage } from '@/lib/api-error'
import { formatRelativeTime, formatVnd } from '@/lib/format'

type HeldOrdersSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReopen: (held: HeldOrderDto) => void
}

/** UC-05: danh sách đơn giữ (tối đa 10), mở lại hoặc xóa; đơn có món tạm hết được cảnh báo (BR-14). */
export function HeldOrdersSheet({ open, onOpenChange, onReopen }: HeldOrdersSheetProps) {
  const held = useHeldOrders({ enabled: open })
  const remove = useDeleteHeldOrder()
  const [deleteTarget, setDeleteTarget] = useState<HeldOrderDto | null>(null)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa ${deleteTarget.holdName}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2">
              <PauseCircle className="text-primary size-5" aria-hidden="true" />
              Đơn giữ
            </SheetTitle>
            <SheetDescription>
              Tối đa 10 đơn giữ trong ca. Chốt ca phải xử lý hết đơn giữ.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-busy={held.isLoading}>
            {held.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : !held.data?.length ? (
              <EmptyState
                icon={FolderOpen}
                title="Chưa có đơn giữ"
                description='Bấm "Giữ đơn" ở giỏ hàng để lưu tạm đơn đang tạo.'
              />
            ) : (
              <ul className="space-y-2">
                {held.data.map((order) => {
                  const count = order.items.reduce((s, i) => s + i.quantity, 0)
                  return (
                    <li key={order.id} className="bg-card rounded-xl border p-3 shadow-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{order.holdName}</p>
                          <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Clock className="size-3" aria-hidden="true" />
                            {formatRelativeTime(order.createdAt)} · {count} món
                            {order.tableTag ? ` · Bàn ${order.tableTag}` : ''}
                          </p>
                        </div>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatVnd(order.total)}
                        </p>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {order.items
                          .map((i) => `${i.quantity}× ${i.itemName} (${i.sizeName})`)
                          .join(', ')}
                      </p>
                      {order.hasUnavailableItems && (
                        <p
                          className="text-warning mt-1.5 flex items-center gap-1.5 text-xs font-medium"
                          role="status"
                        >
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          Có món vừa tạm hết, xử lý trước khi thanh toán
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button
                          className="h-11 flex-1"
                          onClick={() => {
                            onReopen(order)
                            onOpenChange(false)
                          }}
                        >
                          Mở lại
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-lg"
                          onClick={() => setDeleteTarget(order)}
                          aria-label={`Xóa ${order.holdName}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {held.isFetching && !held.isLoading && (
              <p className="text-muted-foreground mt-3 flex items-center justify-center gap-1 text-xs">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Đang làm mới
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa đơn giữ này?"
        description={`${deleteTarget?.holdName} (${formatVnd(deleteTarget?.total ?? 0)}) sẽ bị xóa, không thể khôi phục.`}
        confirmText="Xóa đơn"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
