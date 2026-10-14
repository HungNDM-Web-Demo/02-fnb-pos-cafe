'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { ReceiptFrame } from '@/features/orders/components/ReceiptFrame'
import { useStoreProfile } from '@/features/pos/hooks/use-store-profile'
import { formatDateTime, formatVnd } from '@/lib/format'
import { useShift } from '../hooks/use-shifts'
import { shiftStatusLabels, type ShiftDetail } from '../types/shift.types'

/** Phiếu chốt ca khổ 80 mm (FR-23), mở từ chốt ca (?print=1). */
export function ShiftReceiptPage({ id }: { id: string }) {
  return (
    <Suspense>
      <ShiftReceiptView id={id} />
    </Suspense>
  )
}

function ShiftReceiptView({ id }: { id: string }) {
  const params = useSearchParams()
  const autoPrint = params.get('print') === '1'
  const shift = useShift(id)
  const store = useStoreProfile()
  const ready = !!shift.data && !!store.data

  return (
    <ReceiptFrame autoPrint={autoPrint} ready={ready}>
      {shift.error ? (
        <ErrorState error={shift.error} onRetry={() => void shift.refetch()} />
      ) : !shift.data ? (
        <div className="space-y-2">
          <Skeleton className="mx-auto h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <ShiftReceiptBody shift={shift.data} storeName={store.data?.name ?? ''} />
      )}
    </ReceiptFrame>
  )
}

function ShiftReceiptBody({ shift, storeName }: { shift: ShiftDetail; storeName: string }) {
  const diff = shift.difference ?? 0
  return (
    <article aria-label={`Phiếu chốt ca ${shift.code}`}>
      <header className="text-center">
        <p className="text-[15px] font-bold uppercase">{storeName}</p>
        <p className="mt-1 text-[15px] font-bold tracking-wide">PHIẾU CHỐT CA</p>
      </header>
      <hr className="receipt-sep" />
      <table className="w-full">
        <tbody>
          <Line label="Mã ca" value={shift.code} bold />
          <Line label="Thu ngân" value={shift.cashierName} />
          <Line label="Mở ca" value={formatDateTime(shift.openedAt)} />
          <Line label="Chốt ca" value={formatDateTime(shift.closedAt)} />
          <Line label="Trạng thái" value={shiftStatusLabels[shift.status]} />
        </tbody>
      </table>
      <hr className="receipt-sep" />
      <table className="w-full">
        <tbody>
          <Line label="Số hóa đơn" value={String(shift.orderCount)} />
          <Line label="Hóa đơn hủy" value={String(shift.cancelledOrderCount)} />
          <Line label="Doanh thu tiền mặt" value={formatVnd(shift.cashSales)} />
          <Line label="Doanh thu chuyển khoản" value={formatVnd(shift.transferSales)} />
          <Line label="Tổng doanh thu" value={formatVnd(shift.revenue)} bold />
          {shift.cashCancelled > 0 && (
            <Line label="Tiền mặt HĐ hủy" value={formatVnd(shift.cashCancelled)} />
          )}
        </tbody>
      </table>
      <hr className="receipt-sep" />
      <table className="w-full">
        <tbody>
          <Line label="Tiền đầu ca" value={formatVnd(shift.openingCash)} />
          <Line label="Tiền mặt lý thuyết" value={formatVnd(shift.expectedCash)} />
          <Line label="Tiền mặt thực đếm" value={formatVnd(shift.countedCash)} />
          <Line
            label="Chênh lệch"
            value={`${diff < 0 ? '−' : diff > 0 ? '+' : ''}${formatVnd(Math.abs(diff))}`}
            bold
          />
        </tbody>
      </table>
      {shift.note && (
        <>
          <hr className="receipt-sep" />
          <p>Ghi chú: {shift.note}</p>
        </>
      )}
      <hr className="receipt-sep" />
      <div className="mt-6 grid grid-cols-2 text-center">
        <div>
          <p className="font-bold">Thu ngân</p>
          <p className="mt-10">{shift.cashierName}</p>
        </div>
        <div>
          <p className="font-bold">Quản lý</p>
          <p className="mt-10">{shift.reviewedByName ?? '…………………'}</p>
        </div>
      </div>
    </article>
  )
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={bold ? 'font-bold' : undefined}>
      <td className="pr-2">{label}</td>
      <td className="text-right whitespace-nowrap">{value}</td>
    </tr>
  )
}
