// Sinh ca làm (shifts) và hóa đơn (orders) 90 ngày cho src/mock/seed/demo-data.json.
// Xác định: bộ sinh số ngẫu nhiên có hạt giống cố định, chạy lại cho đúng kết quả cũ.
// Giữ nguyên phần viết tay (categories, menuItems, toppings, promotions, vouchers, customers), chỉ ghi đè shifts, orders.
// Cấu trúc khóa gọn của hóa đơn: docs/06-THIET-KE-CSDL.md §5.2. Tiền không ghi vào file: seeder và FE mock tính lại theo docs/07 §3.
// Chạy: pnpm seed:orders  (hoặc node scripts/generate-orders.mjs)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mock', 'seed', 'demo-data.json')
const data = JSON.parse(readFileSync(file, 'utf8'))

function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261014)
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
function weighted(entries) {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [value, w] of entries) {
    r -= w
    if (r < 0) return value
  }
  return entries[entries.length - 1][0]
}
const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

// ---------- Kiểm tra ràng buộc test (docs/05 §1) trước khi sinh ----------
const itemByCode = new Map(data.menuItems.map((m) => [m.code, m]))
const toppingByCode = new Map(data.toppings.map((t) => [t.code, t]))
const sizePrice = (code, size) => itemByCode.get(code)?.sizes.find((s) => s.name === size)?.price
const checks = [
  [sizePrice('M009', 'M') === 35000 && sizePrice('M009', 'L') === 42000, 'M009 "Trà sữa trân châu" M 35.000 / L 42.000'],
  [itemByCode.get('M009')?.name === 'Trà sữa trân châu', 'M009 tên "Trà sữa trân châu"'],
  [toppingByCode.get('TP01')?.name === 'Trân châu' && toppingByCode.get('TP01')?.price === 5000, 'TP01 "Trân châu" 5.000'],
  [toppingByCode.get('TP04')?.name === 'Thạch dừa' && toppingByCode.get('TP04')?.price === 7000, 'TP04 "Thạch dừa" 7.000'],
  [itemByCode.get('M009')?.toppings.includes('TP01') && itemByCode.get('M009')?.toppings.includes('TP04'), 'M009 cho phép TP01, TP04'],
  [itemByCode.has('M001'), 'M001 tồn tại'],
  [!itemByCode.has('M099'), 'M099 chưa có'],
  [itemByCode.get('M004')?.name === 'Cà phê sữa đá' && sizePrice('M004', 'M') && itemByCode.get('M004')?.sugar, 'M004 "Cà phê sữa đá" có size M và tùy chọn đường'],
  [itemByCode.get('M005')?.name === 'Bạc xỉu' && sizePrice('M005', 'M'), 'M005 "Bạc xỉu" có size M'],
  [data.categories.length === 6, '6 danh mục'],
  [data.menuItems.length === 40, '40 món'],
  [data.toppings.length === 12, '12 topping'],
  [data.promotions.length === 5, '5 khuyến mãi'],
  [data.vouchers.find((v) => v.code === 'GIAM20K')?.discountValue === 20000 && data.vouchers.find((v) => v.code === 'GIAM20K')?.minOrderAmount === 60000, 'GIAM20K 20.000, đơn tối thiểu 60.000'],
  [data.vouchers.find((v) => v.code === 'HETHAN')?.expiresDayOffset < 0, 'HETHAN đã hết hạn'],
  [data.menuItems.every((m) => m.sizes.every((s) => s.price % 1000 === 0 && s.price > 0)), 'giá size bội số 1.000'],
  [data.toppings.every((t) => t.price % 1000 === 0), 'giá topping bội số 1.000'],
  [data.menuItems.every((m) => m.toppings.every((t) => toppingByCode.has(t))), 'topping của món tồn tại'],
  [data.menuItems.every((m) => data.categories.some((c) => c.code === m.category)), 'danh mục của món tồn tại'],
  [new Set(data.menuItems.map((m) => m.code)).size === 40, 'mã món không trùng'],
]
const failed = checks.filter(([ok]) => !ok)
if (failed.length) {
  console.error('Dữ liệu viết tay chưa đạt ràng buộc:\n' + failed.map(([, msg]) => ` - ${msg}`).join('\n'))
  process.exit(1)
}

// ---------- Tham số ----------
const DAYS = 90
const BASE_ORDERS_PER_DAY = 32
// Hệ số theo vị trí ngày trong chu kỳ 7 ngày tính từ hôm nay (0 = hôm nay), không phụ thuộc thứ thật
const weekPattern = [1.0, 1.25, 1.3, 1.0, 0.95, 0.9, 1.05]
// Trọng số giờ bán (06h–21h), cao điểm 7–9h và 14–16h (NFR-06)
const hourWeights = { 6: 0.4, 7: 1.6, 8: 1.8, 9: 1.3, 10: 0.8, 11: 0.7, 12: 0.6, 13: 0.7, 14: 1.5, 15: 1.7, 16: 1.2, 17: 0.9, 18: 0.8, 19: 0.9, 20: 0.7, 21: 0.4 }
const popularity = { M004: 6, M009: 6, M005: 4, M018: 4, M001: 3, M007: 3, M015: 3, M011: 2.5, M025: 2.5, M010: 2, M031: 2, M036: 2, M024: 1.5, M040: 1.5, M019: 1.5, M006: 1.5 }
const itemWeights = data.menuItems.map((m) => [m.code, popularity[m.code] ?? (m.category === 'BN' ? 0.8 : 1)])
const tables = Array.from({ length: 12 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`)
const notes = ['Ít ngọt', 'Không ống hút', 'Để riêng đá', 'Làm nhanh giúp', 'Nhiều đá riêng']
const cancelReasons = ['Nhập nhầm món', 'Khách đổi ý', 'Thanh toán trùng', 'Nhầm size', 'Khách không lấy']
const customers = data.customers.map((c, i) => [c.phone, i < 4 ? 3 : i < 8 ? 2 : 1])
const voucherDefs = data.vouchers.map((v) => ({ ...v, used: 0 }))
const voucherWeight = { GIAM20K: 5, TANGBAN: 4, HETHAN: 3, SINHNHAT: 1, HETLUOT: 1 }

// ---------- Ca làm ----------
const shifts = []
const shiftKey = (day, seq) => `${day}/${seq}`
const shiftByKey = new Map()
const bigDiffNotes = ['Đếm thiếu, đã báo quản lý', 'Thiếu tiền, nghi thối nhầm cho khách', 'Thừa tiền, có thể khách đưa dư không lấy thối']
const reviewNotes = [
  'Đã đối chiếu camera, thu ngân thối nhầm; đã nhắc nhở',
  'Khách đưa dư không lấy tiền thối, ghi nhận thừa',
  'Thiếu do đổi tiền lẻ chưa ghi, đã bù lại',
]
for (let day = -(DAYS - 1); day <= 0; day++) {
  const isToday = day === 0
  // Hai ca trong ngày luôn do hai thu ngân khác nhau để ca chiều mở lúc 13:50 không vi phạm BR-10
  const morningCashier = rand() < 0.8 ? 'thungan' : 'thungan2'
  const afternoonCashier = morningCashier === 'thungan' ? 'thungan2' : 'thungan'
  const plan = isToday
    ? [{ seq: 1, cashier: morningCashier, open: hhmm(6, 30 + randInt(0, 9)), close: '11:45' }]
    : [
        { seq: 1, cashier: morningCashier, open: hhmm(6, 30 + randInt(0, 9)), close: hhmm(14, randInt(0, 8)) },
        { seq: 2, cashier: afternoonCashier, open: hhmm(13, 50 + randInt(0, 8)), close: hhmm(21, 30 + randInt(0, 15)) },
      ]
  for (const p of plan) {
    const openingCash = weighted([[1000000, 9], [1500000, 0.6], [2000000, 0.4]])
    let diff = 0
    const roll = rand()
    if (roll < 0.2) diff = randInt(1, 50) * 1000 * (rand() < 0.6 ? -1 : 1)
    else if (roll < 0.255) diff = randInt(55, 150) * 1000 * (rand() < 0.7 ? -1 : 1)
    // Ép hai ca mẫu cho kịch bản: ca sáng hôm qua lệch −70.000 chưa xử lý; ca chiều 6 ngày trước lệch +80.000 đã xử lý
    if (day === -1 && p.seq === 1) diff = -70000
    if (day === -6 && p.seq === 2) diff = 80000
    if (day === 0) diff = 0
    const shift = { day, seq: p.seq, cashier: p.cashier, open: p.open, close: p.close, openingCash, diff }
    if (Math.abs(diff) > 50000) {
      shift.note = diff < 0 ? pick(bigDiffNotes.slice(0, 2)) : bigDiffNotes[2]
      if (day <= -2) shift.review = { note: diff < 0 ? pick([reviewNotes[0], reviewNotes[2]]) : reviewNotes[1], by: 'quanly' }
    } else if (diff !== 0 && rand() < 0.3) {
      shift.note = diff < 0 ? 'Thiếu ít, có thể thối nhầm' : 'Thừa tiền lẻ'
    }
    shifts.push(shift)
    shiftByKey.set(shiftKey(day, p.seq), shift)
  }
}

// ---------- Hóa đơn ----------
const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
function pickTime(day, seq) {
  const shift = shiftByKey.get(shiftKey(day, seq))
  const openMin = toMinutes(shift.open)
  const closeMin = toMinutes(shift.close)
  const hours = Object.entries(hourWeights)
    .map(([h, w]) => [Number(h), w])
    .filter(([h]) => (seq === 1 ? h < 14 : h >= 14))
  for (let attempt = 0; attempt < 20; attempt++) {
    const hour = weighted(hours)
    const minutes = hour * 60 + randInt(0, 59)
    if (minutes >= openMin + 5 && minutes <= closeMin - 10) return minutes
  }
  return openMin + 15
}

function pickLine() {
  const code = weighted(itemWeights)
  const item = itemByCode.get(code)
  let size
  if (item.sizes.length === 1) size = item.sizes[0].name
  else if (item.sizes.length === 3) size = weighted([['S', 15], ['M', 55], ['L', 30]])
  else size = weighted([['M', 60], ['L', 40]])
  const line = { m: code, z: size, q: weighted([[1, 80], [2, 17], [3, 3]]) }
  if (item.toppings.length) {
    const chance = item.category === 'TS' ? 0.55 : 0.2
    if (rand() < chance) {
      const count = item.category === 'TS' && rand() < 0.35 ? 2 : 1
      const pool = [...item.toppings]
      line.tp = []
      for (let i = 0; i < count && pool.length; i++) line.tp.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
      line.tp.sort()
    }
  }
  if (item.sugar) line.su = weighted([[100, 35], [70, 30], [50, 25], [30, 7], [0, 3]])
  if (item.ice) line.ic = weighted([['Vua', 55], ['It', 25], ['Nhieu', 12], ['KhongDa', 8]])
  if (rand() < 0.03) line.n = pick(notes)
  if (rand() < 0.01) line.dc = { type: 'SoTien', value: 5000, reason: 'Món lỗi' }
  return line
}

function lineSubtotal(line) {
  const price = sizePrice(line.m, line.z)
  const toppings = (line.tp ?? []).reduce((s, t) => s + toppingByCode.get(t).price, 0)
  return (price + toppings) * line.q
}

function pickCash(subtotal, hasDiscount) {
  const up = (unit) => Math.ceil(subtotal / unit) * unit
  const options = []
  if (!hasDiscount && subtotal % 10000 === 0) options.push([subtotal, 25])
  options.push([up(10000), 30], [up(50000), 25], [up(100000), 15], [up(200000), 4], [up(500000), 1])
  return weighted(options)
}

const orders = []
let paid = 0
let cancelled = 0
let lines = 0
let lineToppings = 0
let subtotalSum = 0
let discountOrders = 0
let overrideOrders = 0
for (let day = -(DAYS - 1); day <= 0; day++) {
  const progress = (day + DAYS) / DAYS
  const trend = 0.85 + 0.3 * progress
  const week = weekPattern[((day % 7) + 7) % 7]
  const noise = 0.85 + rand() * 0.3
  const todayFactor = day === 0 ? 0.35 : 1
  const count = Math.max(3, Math.round(BASE_ORDERS_PER_DAY * trend * week * noise * todayFactor))
  const dayOrders = []
  for (let i = 0; i < count; i++) {
    const seq = day === 0 ? 1 : rand() < 0.48 ? 1 : 2
    const minutes = pickTime(day, seq)
    const shift = shiftByKey.get(shiftKey(day, seq))
    const order = { d: day, s: seq, t: hhmm(Math.floor(minutes / 60), minutes % 60) }
    if (rand() < 0.55) {
      order.sv = 'TaiCho'
      order.tb = pick(tables)
    } else order.sv = 'MangDi'
    order.pm = rand() < 0.6 ? 'TienMat' : 'ChuyenKhoan'

    const lineCount = weighted([[1, 45], [2, 30], [3, 17], [4, 8]])
    order.it = Array.from({ length: lineCount }, pickLine)
    const subtotal = order.it.reduce((s, l) => s + lineSubtotal(l), 0)

    const isCancelled = rand() < 0.05
    let hasDiscount = order.it.some((l) => l.dc)
    if (rand() < 0.06) {
      const choice = weighted([['P5', 40], ['P10', 30], ['S5', 15], ['P15', 10], ['P20', 5]])
      if (choice === 'P5') order.dc = { type: 'PhanTram', value: 5, reason: 'Khách quen' }
      else if (choice === 'P10') order.dc = { type: 'PhanTram', value: 10, reason: 'Khách quen' }
      else if (choice === 'S5') order.dc = subtotal >= 50000 ? { type: 'SoTien', value: 5000, reason: 'Món lỗi' } : { type: 'PhanTram', value: 5, reason: 'Món lỗi' }
      else if (choice === 'P15') order.dc = { type: 'PhanTram', value: 15, reason: 'Khách quen', by: 'quanly' }
      else order.dc = { type: 'PhanTram', value: 20, reason: 'Khác: khách đoàn', by: 'quanly' }
      hasDiscount = true
      discountOrders++
      if (order.dc.by) overrideOrders++
    }

    if (rand() < 0.05) {
      const eligible = voucherDefs.filter((v) => {
        if (v.maxUses != null && v.used >= v.maxUses) return false
        if (subtotal < v.minOrderAmount) return false
        if (v.expiresDayOffset != null && day > v.expiresDayOffset) return false
        return true
      })
      if (eligible.length) {
        const v = weighted(eligible.map((x) => [x, voucherWeight[x.code] ?? 1]))
        order.vc = v.code
        if (!isCancelled) v.used++
        hasDiscount = true
      }
    }

    if (rand() < 0.15) order.cu = weighted(customers)
    if (order.pm === 'TienMat') order.cash = pickCash(subtotal, hasDiscount)

    if (isCancelled) {
      const closeMin = toMinutes(shift.close)
      const at = Math.min(minutes + randInt(5, 40), closeMin - 5)
      order.cx = { at: hhmm(Math.floor(at / 60), at % 60), by: 'quanly', reason: pick(cancelReasons) }
      cancelled++
    } else {
      paid++
      subtotalSum += subtotal
    }
    lines += order.it.length
    lineToppings += order.it.reduce((s, l) => s + (l.tp?.length ?? 0), 0)
    dayOrders.push(order)
  }
  dayOrders.sort((a, b) => toMinutes(a.t) - toMinutes(b.t))
  orders.push(...dayOrders)
}

// ---------- Ghi file: phần viết tay giữ dạng đẹp, mỗi ca và mỗi hóa đơn một dòng ----------
const rest = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'shifts' && key !== 'orders'))
let out = JSON.stringify(rest, null, 2)
out = out.replace(/\n}\s*$/, '')
out += ',\n  "shifts": [\n' + shifts.map((s) => '    ' + JSON.stringify(s)).join(',\n') + '\n  ],\n'
out += '  "orders": [\n' + orders.map((o) => '    ' + JSON.stringify(o)).join(',\n') + '\n  ]\n}\n'
writeFileSync(file, out, 'utf8')
const written = JSON.parse(readFileSync(file, 'utf8')) // kiểm tra JSON hợp lệ
for (const o of written.orders) {
  const shift = shiftByKey.get(shiftKey(o.d, o.s))
  if (!shift || o.t < shift.open || o.t > shift.close || (o.cx && (o.cx.at <= o.t || o.cx.at > shift.close)))
    throw new Error(`Hóa đơn ${JSON.stringify(o)} nằm ngoài ca ${JSON.stringify(shift)}`)
}

const needReview = shifts.filter((s) => Math.abs(s.diff) > 50000)
const sizes = data.menuItems.reduce((s, m) => s + m.sizes.length, 0)
const itemToppings = data.menuItems.reduce((s, m) => s + m.toppings.length, 0)
console.log(`Thực đơn: ${data.categories.length} danh mục, ${data.menuItems.length} món, ${sizes} size, ${data.toppings.length} topping, ${itemToppings} dòng gán topping`)
console.log(`Khuyến mãi ${data.promotions.length}, voucher ${data.vouchers.length}, khách hàng ${data.customers.length}`)
console.log(`Ca: ${shifts.length} (cần kiểm tra chưa xử lý ${needReview.filter((s) => !s.review).length}, đã xử lý ${needReview.filter((s) => s.review).length})`)
console.log(`Hóa đơn: ${orders.length} (đã thanh toán ${paid}, đã hủy ${cancelled}); dòng ${lines}; topping dòng ${lineToppings}`)
console.log(`Giảm giá thủ công ${discountOrders} hóa đơn (vượt hạn mức do quanly duyệt ${overrideOrders}); tiền mặt ${orders.filter((o) => o.pm === 'TienMat').length}`)
console.log('Lượt dùng voucher (hóa đơn đã thanh toán): ' + voucherDefs.map((v) => `${v.code}=${v.used}/${v.maxUses ?? '∞'}`).join(', '))
console.log(`Tổng tiền hàng 90 ngày (Σ subtotal, chưa giảm giá, không gồm hủy): ${subtotalSum.toLocaleString('vi-VN')} ₫`)
console.log(`Kích thước file: ${(out.length / 1024).toFixed(0)} KB`)
