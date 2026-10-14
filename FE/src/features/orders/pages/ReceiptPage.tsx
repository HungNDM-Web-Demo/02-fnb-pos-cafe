'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/ErrorState'
import { QrImage } from '@/features/pos/components/QrImage'
import { useStoreProfile } from '@/features/pos/hooks/use-store-profile'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { ReceiptFrame } from '../components/ReceiptFrame'
import { useOrder } from '../hooks/use-orders'
import {
  iceLevelLabels,
  paymentMethodLabels,
  serviceTypeLabels,
  type OrderDto,
} from '../types/order.types'

/** SCR-05 Bản in hóa đơn 80 mm (FR-18): mở từ thanh toán (?print=1) hoặc in lại (?reprint=1, UC-09). */
export function ReceiptPage({ id }: { id: string }) {
  return (
    <Suspense>
      <ReceiptView id={id} />
    </Suspense>
  )
}

function ReceiptView({ id }: { id: string }) {
  const params = useSearchParams()
  const autoPrint = params.get('print') === '1'
  const reprint = params.get('reprint') === '1'
  const order = useOrder(id)
  const store = useStoreProfile()
  const ready = !!order.data && !!store.data

  return (
    <ReceiptFrame autoPrint={autoPrint} ready={ready} backTo={autoPrint ? 'pos' : 'back'}>
      {order.error ? (
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      ) : !order.data ? (
        <div className="space-y-2">
          <Skeleton className="mx-auto h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <ReceiptBody order={order.data} store={store.data} reprint={reprint} />
      )}
    </ReceiptFrame>
  )
}

function ReceiptBody({
  order,
  store,
  reprint,
}: {
  order: OrderDto
  store: { name: string; address: string; phone: string; receiptFooter: string } | undefined
  reprint: boolean
}) {
  const cancelled = order.status === 'DaHuy'
  return (
    <article aria-label={`Hóa đơn ${order.code}`}>
      <header className="text-center">
        <p className="text-[15px] font-bold uppercase">{store?.name ?? '…'}</p>
        {store?.address && <p>{store.address}</p>}
        {store?.phone && <p>ĐT: {store.phone}</p>}
      </header>
      <hr className="receipt-sep" />
      <p className="text-center text-[15px] font-bold tracking-wide">HÓA ĐƠN THANH TOÁN</p>
      {reprint && <p className="text-center font-bold">— IN LẠI —</p>}
      {cancelled && <p className="text-center font-bold">— ĐÃ HỦY —</p>}
      <table className="mt-1 w-full">
        <tbody>
          <tr>
            <td>Số HĐ:</td>
            <td className="text-right font-bold">{order.code}</td>
          </tr>
          <tr>
            <td>Thời gian:</td>
            <td className="text-right">{formatDateTime(order.paidAt)}</td>
          </tr>
          <tr>
            <td>Thu ngân:</td>
            <td className="text-right">{order.cashierName}</td>
          </tr>
          <tr>
            <td>Hình thức:</td>
            <td className="text-right">
              {serviceTypeLabels[order.serviceType]}
              {order.tableTag ? ` · Bàn ${order.tableTag}` : ''}
            </td>
          </tr>
          {order.customer && (
            <tr>
              <td>Khách:</td>
              <td className="text-right">
                {order.customer.name} · {order.customer.phone}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <hr className="receipt-sep" />

      <table className="w-full">
        <thead>
          <tr className="font-bold">
            <th className="text-left">Món</th>
            <th className="w-8 text-center">SL</th>
            <th className="w-20 text-right">T.tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => {
            const options = [
              item.sugarLevel !== undefined ? `${item.sugarLevel}% đường` : null,
              item.iceLevel ? iceLevelLabels[item.iceLevel] : null,
            ].filter(Boolean)
            return (
              <tr key={item.id} className="align-top">
                <td className="pr-1 pb-1">
                  <div className="font-semibold">
                    {item.itemName} ({item.sizeName})
                  </div>
                  {item.toppings.length > 0 && (
                    <div>
                      +{' '}
                      {item.toppings
                        .map((t) => `${t.name} ${formatNumber(t.price / 1000, 0)}k`)
                        .join(', ')}
                    </div>
                  )}
                  {options.length > 0 && <div>{options.join(', ')}</div>}
                  {item.note && <div className="italic">Ghi chú: {item.note}</div>}
                  <div>{formatVnd(item.unitPrice)}</div>
                  {item.discount && <div>Giảm dòng: −{formatVnd(item.discount.amount)}</div>}
                  {item.promotion && (
                    <div>
                      KM {item.promotion.name}: −{formatVnd(item.promotion.amount)}
                    </div>
                  )}
                </td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">{formatVnd(item.lineNet)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <hr className="receipt-sep" />

      <table className="w-full">
        <tbody>
          <Line label="Tổng tiền hàng" value={formatVnd(order.subtotal)} />
          {order.lineDiscountTotal > 0 && (
            <Line label="Giảm giá dòng" value={`−${formatVnd(order.lineDiscountTotal)}`} />
          )}
          {order.itemPromotionDiscount > 0 && (
            <Line label="Khuyến mãi món" value={`−${formatVnd(order.itemPromotionDiscount)}`} />
          )}
          {order.orderDiscount && (
            <Line
              label={`Giảm giá HĐ (${order.orderDiscount.reason}${order.orderDiscount.approvedByName ? `, duyệt: ${order.orderDiscount.approvedByName}` : ''})`}
              value={`−${formatVnd(order.orderDiscount.amount)}`}
            />
          )}
          {order.voucher && (
            <Line
              label={`Voucher ${order.voucher.code}`}
              value={`−${formatVnd(order.voucher.amount)}`}
            />
          )}
          {order.promotion && (
            <Line
              label={`KM ${order.promotion.name}`}
              value={`−${formatVnd(order.promotion.amount)}`}
            />
          )}
          <tr className="text-[15px] font-bold">
            <td className="pt-1">TỔNG THANH TOÁN</td>
            <td className="pt-1 text-right">{formatVnd(order.total)}</td>
          </tr>
        </tbody>
      </table>
      <hr className="receipt-sep" />

      {order.payment && (
        <table className="w-full">
          <tbody>
            <Line label="Phương thức" value={paymentMethodLabels[order.payment.method]} />
            {order.payment.method === 'TienMat' && (
              <>
                <Line label="Tiền khách đưa" value={formatVnd(order.payment.cashReceived)} />
                <Line label="Tiền thối" value={formatVnd(order.payment.changeAmount)} />
              </>
            )}
            {order.customer && <Line label="Điểm tích lũy" value={`+${order.pointsEarned}`} />}
          </tbody>
        </table>
      )}
      {order.payment?.method === 'ChuyenKhoan' && order.payment.qrContent && (
        <div className="mt-2 flex flex-col items-center">
          <QrImage
            value={order.payment.qrContent}
            size={140}
            alt={`Mã QR chuyển khoản ${order.code}`}
          />
          <p className="mt-1">Nội dung CK: {order.code}</p>
        </div>
      )}
      {cancelled && (
        <>
          <hr className="receipt-sep" />
          <p>
            Đã hủy lúc {formatDateTime(order.cancelledAt)} bởi {order.cancelledByName}. Lý do:{' '}
            {order.cancelReason}
          </p>
        </>
      )}
      <hr className="receipt-sep" />
      <footer className="text-center">
        <p>{store?.receiptFooter || 'Cảm ơn quý khách!'}</p>
      </footer>
    </article>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="pr-2 align-top">{label}</td>
      <td className="text-right whitespace-nowrap">{value}</td>
    </tr>
  )
}
