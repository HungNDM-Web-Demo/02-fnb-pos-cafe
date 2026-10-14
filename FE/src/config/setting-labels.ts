/**
 * Nhãn, gợi ý cho khóa cài đặt riêng của dự án (project.json → settings, docs/06 §3).
 * Trang Cài đặt chung dùng bảng này để hiện nhãn tiếng Việt thay vì tên khóa.
 */
export const settingExtraLabels: Record<string, { label: string; hint?: string }> = {
  'Store.Name': { label: 'Tên quán', hint: 'In trên hóa đơn' },
  'Store.Address': { label: 'Địa chỉ' },
  'Store.Phone': { label: 'Số điện thoại' },
  'Store.ReceiptFooter': { label: 'Lời chào cuối hóa đơn' },
  'Store.BankBin': { label: 'Mã ngân hàng (BIN)', hint: 'QR chuyển khoản giả lập, vd 970415' },
  'Store.BankAccount': { label: 'Số tài khoản' },
  'Store.BankAccountName': { label: 'Tên chủ tài khoản' },
}

/** Dự án này không có quy tắc kiểm tra riêng cho cài đặt. */
export function validateProjectSettings(
  items: { key: string; value?: string | null }[],
  current: Record<string, string>
): Record<number, string> {
  void items
  void current
  return {}
}
