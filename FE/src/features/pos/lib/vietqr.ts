/**
 * Chuỗi VietQR (EMVCo QR Code, NAPAS "QRIBFTTA") giả lập để vẽ bằng gói `qrcode` tại máy
 * (07 §4): có mã ngân hàng, số tài khoản, số tiền và nội dung là mã hóa đơn. Không gọi dịch vụ ngoài.
 */

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

/** CRC16-CCITT (0xFFFF, đa thức 0x1021) theo chuẩn EMVCo, trả 4 ký tự hex in hoa */
function crc16(text: string): string {
  let crc = 0xffff
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Bỏ dấu và ký tự ngoài A–Z0–9 khoảng trắng để nội dung chuyển khoản mọi app đọc được */
export function toTransferContent(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25)
}

export type VietQrInput = {
  bankBin: string
  bankAccount: string
  amount: number
  /** Nội dung chuyển khoản, vd mã hóa đơn */
  content: string
}

export function buildVietQr({ bankBin, bankAccount, amount, content }: VietQrInput): string {
  const merchantInfo =
    field('00', 'A000000727') +
    field('01', field('00', bankBin) + field('01', bankAccount)) +
    field('02', 'QRIBFTTA')
  let payload =
    field('00', '01') +
    field('01', '12') +
    field('38', merchantInfo) +
    field('53', '704') +
    field('54', String(Math.round(amount))) +
    field('58', 'VN') +
    field('62', field('08', toTransferContent(content) || 'THANH TOAN')) +
    '6304'
  payload += crc16(payload)
  return payload
}
