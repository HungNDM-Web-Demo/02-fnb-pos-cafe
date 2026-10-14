'use client'

import { useState } from 'react'
import { Loader2, PauseCircle } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
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

type HoldOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  pending?: boolean
  onConfirm: (holdName: string) => void
}

/** UC-05 bước 1: giữ đơn với tên gợi nhớ (mặc định "Đơn N"). */
export function HoldOrderDialog({
  open,
  onOpenChange,
  defaultName,
  pending,
  onConfirm,
}: HoldOrderDialogProps) {
  const [name, setName] = useState(defaultName)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setName(defaultName)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="text-primary size-5" aria-hidden="true" />
            Giữ đơn
          </DialogTitle>
          <DialogDescription>
            Đơn được lưu tạm để phục vụ khách khác; mở lại từ nút &ldquo;Đơn giữ&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm(name.trim() || defaultName)
          }}
          className="grid gap-4"
        >
          <FormField label="Tên gợi nhớ">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="vd: Chị áo đỏ"
              className="h-11"
              autoFocus
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Giữ đơn
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
