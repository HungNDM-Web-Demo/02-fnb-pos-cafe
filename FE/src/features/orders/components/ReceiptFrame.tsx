'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { routePath } from '@/config/route-path'
import './receipt.css'

type ReceiptFrameProps = {
  /** Tự gọi window.print() khi mở từ luồng thanh toán/chốt ca (?print=1) */
  autoPrint: boolean
  /** Dữ liệu đã sẵn sàng để in */
  ready: boolean
  /** Nút quay lại màn bán hàng (hóa đơn) hay về trang trước */
  backTo?: 'pos' | 'back'
  children: React.ReactNode
}

/** Khung trang in: thanh công cụ (ẩn khi in) + tờ giấy 80 mm căn giữa. */
export function ReceiptFrame({ autoPrint, ready, backTo = 'back', children }: ReceiptFrameProps) {
  const router = useRouter()
  const printed = useRef(false)

  useEffect(() => {
    if (!autoPrint || !ready || printed.current) return
    printed.current = true
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [autoPrint, ready])

  return (
    <div className="bg-muted min-h-svh print:bg-white">
      <div className="print-hidden bg-card sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4">
        {backTo === 'pos' ? (
          <Button variant="outline" onClick={() => router.push(routePath.pos)}>
            <ShoppingCart aria-hidden="true" />
            Về bán hàng
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => (window.history.length > 1 ? router.back() : router.push(routePath.pos))}
          >
            <ArrowLeft aria-hidden="true" />
            Quay lại
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="cta" onClick={() => window.print()} disabled={!ready}>
          <Printer aria-hidden="true" />
          In
        </Button>
      </div>
      <div className="flex justify-center px-4 py-6 print:p-0">
        <div className="receipt rounded-sm px-3 py-4 shadow-md print:rounded-none print:p-0 print:shadow-none">
          {children}
        </div>
      </div>
    </div>
  )
}
