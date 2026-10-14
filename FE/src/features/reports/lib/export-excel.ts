/**
 * Xuất báo cáo đang xem ra file Excel tại máy (FR-32) bằng gói `write-excel-file`.
 * Nạp gói lười khi bấm nút để không tăng kích thước trang.
 */

export type ExcelColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
  /** Độ rộng cột (ký tự) */
  width?: number
  /** Định dạng số Excel, vd '#,##0' */
  format?: string
}

export async function exportExcel<T>(
  fileName: string,
  title: string,
  columns: ExcelColumn<T>[],
  rows: T[]
) {
  const { default: writeXlsxFile } = await import('write-excel-file/universal')
  const header = columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const }))
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = c.value(row)
      if (v === null || v === undefined) return null
      return typeof v === 'number'
        ? { value: v, type: Number, format: c.format ?? '#,##0' }
        : { value: String(v), type: String }
    })
  )
  const sheetData = [[{ value: title, fontWeight: 'bold' as const }], [], header, ...body]
  const blob = await writeXlsxFile(sheetData, {
    columns: columns.map((c) => ({ width: c.width ?? 16 })),
  }).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
