'use client'

import { Ban, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSetMenuItemAvailability } from '@/features/menu-items/hooks/use-menu'
import type { MenuItemDto } from '@/features/menu-items/types/menu.types'
import { getErrorMessage } from '@/lib/api-error'

type AvailabilityDialogProps = {
  item: MenuItemDto | null
  onOpenChange: (open: boolean) => void
}

/** Menu ngắn khi nhấn giữ thẻ món (UC-02): Tạm hết hoặc Bán lại. */
export function AvailabilityDialog({ item, onOpenChange }: AvailabilityDialogProps) {
  const mutation = useSetMenuItemAvailability()
  const soldOut = !!item?.isSoldOut

  const confirm = () => {
    if (!item) return
    mutation.mutate(
      { id: item.id, isSoldOut: !soldOut },
      {
        onSuccess: () => {
          toast.success(soldOut ? `${item.name} đã bán lại` : `Đã báo ${item.name} tạm hết`)
          onOpenChange(false)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !mutation.isPending && onOpenChange(open)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{soldOut ? 'Bán lại món này?' : 'Báo tạm hết?'}</DialogTitle>
          <DialogDescription>
            {soldOut
              ? `${item?.name} sẽ chọn được trở lại ở mọi máy bán hàng.`
              : `${item?.name} sẽ mờ đi và không chọn được ở mọi máy bán hàng cho tới khi bán lại.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Hủy
          </Button>
          <Button
            variant={soldOut ? 'default' : 'danger'}
            size="lg"
            onClick={confirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : soldOut ? (
              <RotateCcw aria-hidden="true" />
            ) : (
              <Ban aria-hidden="true" />
            )}
            {soldOut ? 'Bán lại' : 'Tạm hết'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
