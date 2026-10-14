// Sinh ảnh món mẫu (minh họa phẳng, 800×800, WebP ≤ 60 KB) cho các món trong src/mock/seed/demo-data.json
// vào public/seed/menu/{maMon}.webp (docs/06-THIET-KE-CSDL.md, mục ảnh món).
// Mỗi món vẽ bằng SVG hình học theo một "khuôn" (ly đá, tách nóng, ly trà sữa, trà trái cây, đá xay,
// soda, nước ép, lát bánh, bông lan, bánh sừng bò, cookie) biến thể theo màu, lớp, topping; nền màu nhạt
// theo `categories[].color`. Không chữ trên ảnh. Xác định: không ngẫu nhiên tự do (bộ sinh số có hạt
// giống theo mã món), chạy lại cho cùng byte. Không ghi gì vào file JSON.
//
// Chạy:      pnpm seed:images
// Tùy chọn:  --only <chuỗi>       chỉ vẽ món có mã chứa chuỗi
//            --preview <thư mục>  xuất thêm PNG để xem nhanh
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'src', 'mock', 'seed', 'demo-data.json')
const OUT_DIR = join(ROOT, 'public', 'seed', 'menu')
const S = 800
const MAX_BYTES = 60 * 1000

const args = process.argv.slice(2)
const argVal = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const ONLY = argVal('--only')
const PREVIEW = argVal('--preview')

// ============================================================ Tiện ích
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r2 = (n) => Math.round(n * 100) / 100
function attrs(o) {
  let out = ''
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === false) continue
    out += ` ${k}="${typeof v === 'number' ? r2(v) : esc(v)}"`
  }
  return out
}
const el = (tag, o = {}, body = '') =>
  body ? `<${tag}${attrs(o)}>${body}</${tag}>` : `<${tag}${attrs(o)}/>`
const rect = (x, y, w, h, o = {}) => el('rect', { x, y, width: w, height: h, ...o })
const circle = (cx, cy, r, o = {}) => el('circle', { cx, cy, r, ...o })
const ellipse = (cx, cy, rx, ry, o = {}) => el('ellipse', { cx, cy, rx, ry, ...o })
const path = (d, o = {}) => el('path', { d, ...o })
const g = (o, body) => el('g', o, body)
const line = (x1, y1, x2, y2, o = {}) => el('line', { x1, y1, x2, y2, ...o })
const rot = (a, x, y) => `rotate(${r2(a)} ${r2(x)} ${r2(y)})`

const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16))
const rgbToHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()
const mix = (a, b, t) => {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t))
}
const tint = (c, t) => mix(c, '#FFFFFF', t)
const shade = (c, t) => mix(c, '#000000', t)
const range = (n) => Array.from({ length: n }, (_, i) => i)

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStr(s) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619)
  return h >>> 0
}

// ============================================================ Định nghĩa dùng chung trong một ảnh
let defs = []
let uid = 0
const newId = (p) => `${p}${++uid}`
function linGrad(stops, dir = 'h') {
  const id = newId('lg')
  const [x2, y2] = dir === 'v' ? [0, 1] : [1, 0]
  defs.push(
    el(
      'linearGradient',
      { id, x1: 0, y1: 0, x2, y2 },
      stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c })).join('')
    )
  )
  return `url(#${id})`
}
// Chất lỏng: trái sáng, phải tối một chút
const liq = (c) =>
  linGrad([
    [0, tint(c, 0.14)],
    [0.55, c],
    [1, shade(c, 0.14)],
  ])
function clipOf(inner) {
  const id = newId('cp')
  defs.push(el('clipPath', { id }, inner))
  return `url(#${id})`
}
function blurFilter(std) {
  const id = newId('bl')
  defs.push(
    el(
      'filter',
      { id, x: '-50%', y: '-50%', width: '200%', height: '200%' },
      el('feGaussianBlur', { stdDeviation: std })
    )
  )
  return `url(#${id})`
}

// ============================================================ Hình cơ bản
// Ly/cốc hình thang bo đáy, miệng ở `top`, đáy ở `bot`
function cupPath(cx, top, bot, wT, wB, r) {
  const l1 = cx - wT / 2
  const r1 = cx + wT / 2
  const l2 = cx - wB / 2
  const rr = cx + wB / 2
  return `M${l1} ${top}L${r1} ${top}L${rr} ${bot - r}Q${rr} ${bot} ${rr - r} ${bot}L${l2 + r} ${bot}Q${l2} ${bot} ${l2} ${bot - r}Z`
}

// Thành ly phía sau (kính mờ) và phía trước (viền, vệt sáng)
const glassBack = (d) => path(d, { fill: '#FFFFFF', 'fill-opacity': 0.26 })
function glassFront(d, cx, top, bot, wT) {
  const x = cx - wT / 2 + 22
  return (
    path(d, {
      fill: 'none',
      stroke: '#FFFFFF',
      'stroke-opacity': 0.9,
      'stroke-width': 7,
      'stroke-linejoin': 'round',
    }) + rect(x, top + 40, 12, bot - top - 110, { rx: 6, fill: '#FFFFFF', 'fill-opacity': 0.4 })
  )
}

// Các lớp chất lỏng từ đáy lên: [{ frac, color }] (frac = phần chiều cao), cắt theo clip của ly
function liquidLayers(cx, liqTop, bot, wT, layers, clip) {
  const H = bot - liqTop
  let y = bot
  let out = ''
  for (const L of layers) {
    const h = H * L.frac
    out += rect(cx - 200, y - h, 400, h + 1, { fill: liq(L.color) })
    y -= h
  }
  const topLayer = layers[layers.length - 1]
  out += ellipse(cx, liqTop, wT / 2 - 2, 11, { fill: tint(topLayer.color, 0.28) })
  return (
    g({ 'clip-path': clip }, out) +
    ellipse(cx, liqTop, wT / 2 - 2, 11, {
      fill: 'none',
      stroke: '#FFFFFF',
      'stroke-opacity': 0.35,
      'stroke-width': 3,
    })
  )
}

function iceCube(cx, cy, s, a) {
  return g(
    { transform: rot(a, cx, cy) },
    rect(cx - s / 2, cy - s / 2, s, s, {
      rx: s * 0.24,
      fill: '#FFFFFF',
      'fill-opacity': 0.42,
      stroke: '#FFFFFF',
      'stroke-opacity': 0.9,
      'stroke-width': 4,
    }) +
      path(`M${cx - s * 0.28} ${cy - s * 0.06}L${cx - s * 0.06} ${cy - s * 0.28}`, {
        stroke: '#FFFFFF',
        'stroke-width': 5,
        'stroke-linecap': 'round',
        'stroke-opacity': 0.95,
      })
  )
}
function iceCluster(cx, liqTop, wT, rnd, n = 4) {
  const spots = [
    [-0.26, 0.09, 64, -14],
    [0.22, 0.05, 58, 18],
    [-0.02, 0.26, 56, 8],
    [0.3, 0.3, 50, -26],
    [-0.3, 0.42, 52, 22],
  ]
  return spots
    .slice(0, n)
    .map(([dx, dy, s, a]) =>
      iceCube(cx + dx * wT + (rnd() - 0.5) * 8, liqTop + 40 + dy * 160, s, a + (rnd() - 0.5) * 6)
    )
    .join('')
}

function straw(x, yTop, yBot, angle, color, w = 24) {
  return g(
    { transform: rot(angle, x, yBot) },
    rect(x - w / 2, yTop, w, yBot - yTop, { rx: w / 2, fill: color }) +
      rect(x - w / 2 + 5, yTop + 10, 6, yBot - yTop - 20, {
        rx: 3,
        fill: '#FFFFFF',
        'fill-opacity': 0.38,
      })
  )
}

function domeLid(cx, top, w, band) {
  const r = w / 2 + 6
  return (
    path(`M${cx - r} ${top}A${r} ${r * 0.62} 0 0 1 ${cx + r} ${top}Z`, {
      fill: '#FFFFFF',
      'fill-opacity': 0.5,
      stroke: '#FFFFFF',
      'stroke-width': 6,
      'stroke-opacity': 0.95,
    }) +
    ellipse(cx - r * 0.35, top - r * 0.32, r * 0.22, r * 0.1, {
      fill: '#FFFFFF',
      'fill-opacity': 0.6,
      transform: rot(-24, cx - r * 0.35, top - r * 0.32),
    }) +
    rect(cx - r - 4, top - 9, 2 * r + 8, 18, { rx: 9, fill: band })
  )
}
const flatLid = (cx, top, w, band) =>
  rect(cx - w / 2 - 10, top - 10, w + 20, 20, { rx: 10, fill: band }) +
  rect(cx - w / 2 + 4, top - 6, w - 8, 6, { rx: 3, fill: '#FFFFFF', 'fill-opacity': 0.45 })

function creamSwirl(cx, top, w, drizzle, crumbs) {
  const o = { fill: '#FFF9F0', stroke: '#EBDAC4', 'stroke-width': 3 }
  let out =
    ellipse(cx, top - 2, w * 0.5, 30, o) +
    ellipse(cx, top - 36, w * 0.41, 28, o) +
    ellipse(cx, top - 68, w * 0.31, 24, o) +
    ellipse(cx, top - 96, w * 0.2, 18, o) +
    circle(cx + 8, top - 120, 12, o)
  if (drizzle) {
    const d = {
      fill: 'none',
      stroke: drizzle,
      'stroke-width': 7,
      'stroke-linecap': 'round',
      'stroke-opacity': 0.9,
    }
    out += path(`M${cx - w * 0.36} ${top - 14}q22 -16 44 0t44 0t44 0`, d)
    out += path(`M${cx - w * 0.26} ${top - 50}q18 -14 36 0t36 0`, d)
    out += path(`M${cx - w * 0.12} ${top - 82}q14 -12 28 0`, d)
  }
  if (crumbs) {
    const pts = [
      [-0.3, -20, 9],
      [0.12, -8, 7],
      [0.32, -24, 8],
      [-0.1, -46, 7],
      [0.22, -58, 6],
      [-0.2, -74, 6],
      [0.06, -100, 5],
    ]
    for (const [dx, dy, r] of pts)
      out += ellipse(cx + dx * w, top + dy, r, r * 0.7, {
        fill: crumbs,
        transform: rot(dx * 90, cx + dx * w, top + dy),
      })
  }
  return out
}

function leaf(cx, cy, len, angle, color) {
  const h = len * 0.42
  return g(
    { transform: `translate(${r2(cx)} ${r2(cy)}) rotate(${angle})` },
    path(`M0 0Q${len * 0.5} ${-h} ${len} 0Q${len * 0.5} ${h} 0 0Z`, { fill: color }) +
      path(`M6 0L${len - 8} 0`, {
        stroke: tint(color, 0.45),
        'stroke-width': 3,
        'stroke-linecap': 'round',
      })
  )
}
function steam(cx, y, color) {
  const d = {
    fill: 'none',
    stroke: color,
    'stroke-width': 9,
    'stroke-linecap': 'round',
    'stroke-opacity': 0.55,
  }
  return [-44, 0, 44]
    .map((dx, i) =>
      path(`M${cx + dx} ${y}c14 -22 -14 -44 0 -66c12 -18 -8 -32 2 -${48 + i * 6}`, d)
    )
    .join('')
}
function shadow(color) {
  return ellipse(400, 614, 190, 26, {
    fill: shade(color, 0.5),
    'fill-opacity': 0.3,
    filter: blurFilter(14),
  })
}

// ============================================================ Trân châu, trái cây, phụ liệu
function pearls(cx, bot, w, rnd, color = '#2A1A15', n = 14) {
  let out = ''
  const cols = 6
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = cx - w * 0.36 + (col + 0.5 + (row % 2) * 0.5) * ((w * 0.72) / cols) + (rnd() - 0.5) * 6
    const y = bot - 26 - row * 28 - (rnd() - 0.5) * 6
    out +=
      circle(x, y, 14, { fill: color }) +
      circle(x - 4, y - 5, 4, { fill: '#FFFFFF', 'fill-opacity': 0.45 })
  }
  return out
}
function pudding(cx, bot) {
  return (
    rect(cx - 70, bot - 70, 140, 62, { rx: 14, fill: '#F6C453' }) +
    rect(cx - 70, bot - 70, 140, 20, { rx: 10, fill: '#B9701F' }) +
    rect(cx - 50, bot - 44, 36, 10, { rx: 5, fill: '#FFFFFF', 'fill-opacity': 0.5 })
  )
}
function wheel(cx, cy, s, outer, inner, seg) {
  let o = circle(cx, cy, s, { fill: outer, stroke: shade(outer, 0.2), 'stroke-width': 4 })
  o += circle(cx, cy, s * 0.8, { fill: inner })
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    o += line(cx, cy, cx + Math.cos(a) * s * 0.78, cy + Math.sin(a) * s * 0.78, {
      stroke: seg,
      'stroke-width': 4,
    })
  }
  return o
}
function fruitPiece(kind, cx, cy, s, a) {
  const t = { transform: rot(a, cx, cy) }
  switch (kind) {
    case 'peach': // lát đào hình lưỡi liềm
      return path(
        `M${cx - s} ${cy}A${s} ${s} 0 0 1 ${cx + s} ${cy}A${s * 0.62} ${s * 0.62} 0 0 0 ${cx - s} ${cy}Z`,
        { fill: '#F59E4B', stroke: '#E07A2D', 'stroke-width': 4, 'stroke-linejoin': 'round', ...t }
      )
    case 'lychee':
      return (
        circle(cx, cy, s, { fill: '#FBF1EA', stroke: '#F4A9BE', 'stroke-width': 5 }) +
        circle(cx - s * 0.3, cy - s * 0.3, s * 0.22, { fill: '#FFFFFF' })
      )
    case 'strawberry':
      return g(
        t,
        path(
          `M${cx} ${cy + s}C${cx - s * 1.1} ${cy + s * 0.2} ${cx - s * 0.9} ${cy - s * 0.9} ${cx} ${cy - s * 0.7}C${cx + s * 0.9} ${cy - s * 0.9} ${cx + s * 1.1} ${cy + s * 0.2} ${cx} ${cy + s}Z`,
          { fill: '#E6354F' }
        ) +
          [
            [-0.35, 0],
            [0.3, -0.1],
            [0, 0.4],
            [-0.15, -0.4],
            [0.2, 0.3],
          ]
            .map(([dx, dy]) => ellipse(cx + dx * s, cy + dy * s, 3, 4.5, { fill: '#FFE7A3' }))
            .join('') +
          path(
            `M${cx - s * 0.5} ${cy - s * 0.6}L${cx} ${cy - s * 0.95}L${cx + s * 0.5} ${cy - s * 0.6}L${cx} ${cy - s * 0.45}Z`,
            { fill: '#3F9D4A' }
          )
      )
    case 'mango':
      return rect(cx - s, cy - s, 2 * s, 2 * s, {
        rx: s * 0.3,
        fill: '#F8C430',
        stroke: '#E9A61C',
        'stroke-width': 4,
        ...t,
      })
    case 'guava':
      return (
        rect(cx - s, cy - s, 2 * s, 2 * s, {
          rx: s * 0.45,
          fill: '#F58CA5',
          stroke: '#E86C8C',
          'stroke-width': 4,
          ...t,
        }) + circle(cx, cy, s * 0.45, { fill: '#FBD4DE' })
      )
    case 'lemon':
      return g(t, wheel(cx, cy, s, '#F8DE4A', '#FBEF8A', '#F8DE4A'))
    case 'lime':
      return g(t, wheel(cx, cy, s, '#9BCB5A', '#DCEFB1', '#9BCB5A'))
    case 'blueberry':
      return (
        circle(cx, cy, s, { fill: '#4C3D9E' }) +
        circle(cx, cy, s * 0.3, { fill: '#2B2366' }) +
        circle(cx - s * 0.35, cy - s * 0.35, s * 0.2, { fill: '#FFFFFF', 'fill-opacity': 0.5 })
      )
    case 'passion': // hạt chanh dây
      return (
        ellipse(cx, cy, s, s * 0.7, { fill: '#3C2A1E', ...t }) +
        ellipse(cx, cy, s * 0.55, s * 0.35, { fill: '#F3C04B', 'fill-opacity': 0.6, ...t })
      )
    default:
      return ''
  }
}
function fruitCluster(kind, cx, liqTop, bot, w, rnd, count, size) {
  const spots = [
    [-0.24, 0.12, 10],
    [0.2, 0.08, -18],
    [0.04, 0.34, 26],
    [-0.28, 0.5, -8],
    [0.26, 0.46, 14],
    [-0.04, 0.68, -30],
    [0.22, 0.78, 6],
    [-0.26, 0.84, 20],
  ]
  return spots
    .slice(0, count)
    .map(([dx, dy, a]) =>
      fruitPiece(
        kind,
        cx + dx * w + (rnd() - 0.5) * 8,
        liqTop + 30 + dy * (bot - liqTop - 70),
        size,
        a + (rnd() - 0.5) * 10
      )
    )
    .join('')
}
function bitsCluster(cx, liqTop, color, spots) {
  return spots
    .map(([dx, dy, s]) =>
      rect(cx + dx, liqTop + dy, s, s, {
        rx: s * 0.3,
        fill: color,
        transform: rot(dx, cx + dx + s / 2, liqTop + dy + s / 2),
      })
    )
    .join('')
}
function plate(cx, cy, rx) {
  return (
    ellipse(cx, cy, rx, rx * 0.2, { fill: '#FFFFFF', 'fill-opacity': 0.85 }) +
    ellipse(cx, cy - 3, rx * 0.8, rx * 0.14, { fill: '#F4F0EA', 'fill-opacity': 0.9 })
  )
}

// ============================================================ Các khuôn
const CX = 400
function tallCup(liqOffset) {
  const top = 246
  const bot = 590
  const wT = 236
  const wB = 196
  const d = cupPath(CX, top, bot, wT, wB, 30)
  return { d, clip: clipOf(path(d)), liqTop: top + liqOffset, top, bot, wT, wB }
}

// Khuôn 1: ly cao có đá (cà phê đá, bạc xỉu, cà phê muối)
function moldGlass(it, rnd) {
  const c = tallCup(44)
  let inner = liquidLayers(CX, c.liqTop, c.bot, c.wT, it.layers, c.clip)
  if (it.foam) {
    const fh = 80
    inner += g(
      { 'clip-path': c.clip },
      path(
        `M${CX - 200} ${c.liqTop - 20}H${CX + 200}V${c.liqTop + fh}q-30 14 -60 0t-60 0t-60 0t-60 0t-60 0t-60 0Z`,
        { fill: it.foam }
      ) +
        range(9)
          .map((i) =>
            circle(
              CX - 90 + i * 22 + (rnd() - 0.5) * 10,
              c.liqTop + 10 + (rnd() - 0.5) * 30,
              3 + rnd() * 2,
              { fill: '#FFFFFF' }
            )
          )
          .join('')
    )
    inner += ellipse(CX, c.liqTop, c.wT / 2 - 2, 11, { fill: tint(it.foam, 0.4) })
  }
  if (it.ice)
    inner += g(
      { 'clip-path': c.clip },
      iceCluster(CX, c.liqTop + (it.foam ? 70 : 0), c.wT, rnd, it.foam ? 3 : 4)
    )
  const fore = it.straw ? straw(CX + 52, c.top - 100, c.bot - 60, 12, it.straw) : ''
  return glassBack(c.d) + inner + fore + glassFront(c.d, CX, c.top, c.bot, c.wT)
}

// Khuôn 2: tách thủy tinh thấp có quai, nóng (phin, kem trứng, hơi nóng)
function moldCup(it, rnd) {
  const top = 356
  const bot = 590
  const wT = 250
  const wB = 214
  const cx = 386
  const d = cupPath(cx, top, bot, wT, wB, 40)
  const clip = clipOf(path(d))
  const liqTop = top + (it.phin ? 54 : 40)
  let out =
    ellipse(cx, bot + 4, 200, 34, { fill: '#FFFFFF', 'fill-opacity': 0.75 }) +
    ellipse(cx, bot + 2, 150, 20, { fill: '#FFFFFF', 'fill-opacity': 0.55 })
  const hx = cx + wT / 2 - 6
  const handle = `M${hx} ${top + 54}C${hx + 96} ${top + 44} ${hx + 96} ${top + 190} ${cx + wB / 2 - 6} ${top + 196}`
  out += path(handle, {
    fill: 'none',
    stroke: '#FFFFFF',
    'stroke-opacity': 0.92,
    'stroke-width': 28,
    'stroke-linecap': 'round',
  })
  out += path(handle, {
    fill: 'none',
    stroke: it.bg,
    'stroke-opacity': 0.9,
    'stroke-width': 10,
    'stroke-linecap': 'round',
  })
  out += glassBack(d)
  out += liquidLayers(cx, liqTop, bot, wT, it.layers, clip)
  if (it.foamDome) {
    // kem trứng đánh bông vun lên trên miệng tách
    out += g({ 'clip-path': clip }, rect(cx - 200, liqTop - 30, 400, 92, { fill: it.foamDome }))
    out += path(
      `M${cx - wT / 2 + 4} ${top + 6}C${cx - wT / 2 - 6} ${top - 110} ${cx + wT / 2 + 6} ${top - 110} ${cx + wT / 2 - 4} ${top + 6}Z`,
      { fill: tint(it.foamDome, 0.12) }
    )
    out += path(`M${cx - 70} ${top - 40}q30 -26 70 -18`, {
      fill: 'none',
      stroke: '#FFFFFF',
      'stroke-width': 8,
      'stroke-linecap': 'round',
      'stroke-opacity': 0.8,
    })
    out += range(10)
      .map(() =>
        circle(cx - 90 + rnd() * 180, top - 50 + rnd() * 30, 3, {
          fill: '#6B3E1E',
          'fill-opacity': 0.8,
        })
      )
      .join('')
  }
  out += glassFront(d, cx, top, bot, wT)
  if (it.phin) {
    const w = 170
    const silver = linGrad([
      [0, '#EEF0F4'],
      [0.45, '#C9CCD4'],
      [1, '#9598A4'],
    ])
    out += ellipse(cx, top - 2, wT / 2 + 14, 18, { fill: '#C2C5CE' })
    out += ellipse(cx, top - 6, wT / 2 + 14, 16, { fill: '#DFE1E7' })
    out += rect(cx - w / 2, top - 112, w, 108, { rx: 10, fill: silver })
    out += rect(cx - w / 2, top - 44, w, 8, { fill: '#7E8290', 'fill-opacity': 0.45 })
    out += ellipse(cx, top - 112, w / 2 + 6, 16, {
      fill: '#DCDEE5',
      stroke: '#A8ABB6',
      'stroke-width': 3,
    })
    out += ellipse(cx, top - 116, w / 2 - 20, 9, { fill: '#F2F3F6' })
    out += circle(cx, top - 128, 10, { fill: '#A8ABB6' })
    out += circle(cx - 3, top - 131, 3, { fill: '#FFFFFF', 'fill-opacity': 0.8 })
  } else {
    out += steam(cx, it.foamDome ? top - 96 : top - 34, shade(it.bg, 0.45))
  }
  return out
}

// Khuôn 3: ly trà sữa (nắp vòm/phẳng, ống hút to, trân châu, pudding, sọc đường đen)
function moldBubble(it, rnd) {
  const c = tallCup(34)
  let inner = liquidLayers(CX, c.liqTop, c.bot, c.wT, it.layers, c.clip)
  if (it.stripes) {
    const d = {
      fill: 'none',
      stroke: it.stripes,
      'stroke-width': 13,
      'stroke-linecap': 'round',
      'stroke-opacity': 0.9,
    }
    inner += g(
      { 'clip-path': c.clip },
      [-78, -44, -8, 30, 66]
        .map((dx, i) =>
          path(
            `M${CX + dx} ${c.liqTop + 6}c${i % 2 ? -14 : 16} 70 ${i % 2 ? 10 : -12} 120 ${i % 2 ? -6 : 8} ${180 + (i % 3) * 40}`,
            d
          )
        )
        .join('')
    )
  }
  if (it.ice) inner += g({ 'clip-path': c.clip }, iceCluster(CX, c.liqTop, c.wT, rnd, 3))
  if (it.pearls) inner += g({ 'clip-path': c.clip }, pearls(CX, c.bot, c.wB, rnd, it.pearls))
  if (it.pudding) inner += g({ 'clip-path': c.clip }, pudding(CX, c.bot))
  if (it.bits)
    inner += g(
      { 'clip-path': c.clip },
      bitsCluster(CX, c.liqTop, it.bits, [
        [-50, 60, 16],
        [20, 110, 14],
        [60, 50, 12],
        [-20, 160, 13],
        [50, 190, 12],
        [-66, 230, 11],
      ])
    )
  if (it.dust)
    inner += g(
      { 'clip-path': c.clip },
      range(24)
        .map(() =>
          circle(CX - 100 + rnd() * 200, c.liqTop - 4 + rnd() * 10, 2 + rnd() * 2, { fill: it.dust })
        )
        .join('')
    )
  const fore =
    (it.dome ? domeLid(CX, c.top, c.wT, it.band) : flatLid(CX, c.top, c.wT, it.band)) +
    straw(CX + 34, c.top - 120, c.bot - 50, -8, it.straw, it.pearls || it.pudding ? 30 : 22)
  return glassBack(c.d) + inner + glassFront(c.d, CX, c.top, c.bot, c.wT) + fore
}

// Khuôn 4: trà trái cây (ly nhựa nắp phẳng, đá, miếng trái cây, lá)
function moldFruitTea(it, rnd) {
  const c = tallCup(34)
  let inner = liquidLayers(CX, c.liqTop, c.bot, c.wT, it.layers, c.clip)
  inner += g(
    { 'clip-path': c.clip },
    fruitCluster(it.fruit, CX, c.liqTop, c.bot, c.wT, rnd, it.count ?? 6, it.size ?? 24)
  )
  inner += g({ 'clip-path': c.clip }, iceCluster(CX, c.liqTop, c.wT, rnd, 3))
  if (it.seeds)
    inner += g(
      { 'clip-path': c.clip },
      range(26)
        .map(() =>
          fruitPiece('passion', CX - 100 + rnd() * 200, c.liqTop + 10 + rnd() * 280, 6, rnd() * 180)
        )
        .join('')
    )
  let fore = flatLid(CX, c.top, c.wT, it.band) + straw(CX + 40, c.top - 118, c.bot - 50, -8, it.straw, 22)
  if (it.garnish === 'lemon') fore += fruitPiece('lemon', CX - c.wT / 2 + 4, c.top + 2, 40, 0)
  if (it.garnish === 'leaf')
    fore += leaf(CX - 20, c.top - 26, 70, -30, '#3F9D4A') + leaf(CX - 24, c.top - 20, 56, 20, '#4FB35A')
  if (it.garnish === 'rose')
    fore +=
      circle(CX - c.wT / 2 + 10, c.top - 6, 20, { fill: '#F27A9A' }) +
      circle(CX - c.wT / 2 + 10, c.top - 6, 10, { fill: '#F9B9C9' })
  return glassBack(c.d) + inner + glassFront(c.d, CX, c.top, c.bot, c.wT) + fore
}

// Khuôn 5: đá xay (ly cao, kem tươi xoáy, sốt rưới, ống hút)
function moldFrappe(it, rnd) {
  const c = tallCup(30)
  let inner = liquidLayers(CX, c.liqTop, c.bot, c.wT, it.layers, c.clip)
  // hạt đá xay sáng lấm tấm
  inner += g(
    { 'clip-path': c.clip },
    range(28)
      .map(() =>
        circle(CX - 110 + rnd() * 220, c.liqTop + 30 + rnd() * 260, 3 + rnd() * 3, {
          fill: '#FFFFFF',
          'fill-opacity': 0.35,
        })
      )
      .join('')
  )
  if (it.flakes)
    inner += g(
      { 'clip-path': c.clip },
      range(18)
        .map(() =>
          path(`M${CX - 100 + rnd() * 200} ${c.liqTop + 40 + rnd() * 240}q8 -8 16 0`, {
            fill: 'none',
            stroke: '#FFFFFF',
            'stroke-width': 4,
            'stroke-linecap': 'round',
            'stroke-opacity': 0.85,
          })
        )
        .join('')
    )
  if (it.bits)
    inner += g(
      { 'clip-path': c.clip },
      bitsCluster(CX, c.liqTop, it.bits, [
        [-60, 70, 18],
        [30, 120, 16],
        [70, 40, 13],
        [-30, 180, 15],
        [50, 230, 13],
        [-70, 250, 12],
      ])
    )
  const fore =
    creamSwirl(CX, c.top - 6, c.wT, it.drizzle, it.crumbs) +
    straw(CX + 64, c.top - 160, c.bot - 50, -10, it.straw, 22)
  return (
    glassBack(c.d) +
    inner +
    glassFront(c.d, CX, c.top, c.bot, c.wT) +
    rect(CX - c.wT / 2 - 8, c.top - 8, c.wT + 16, 16, { rx: 8, fill: it.band }) +
    fore
  )
}

// Khuôn 6: soda (ly thẳng, bọt khí, lát chanh, lá bạc hà, quả mọng)
function moldSoda(it, rnd) {
  const top = 236
  const bot = 590
  const w = 210
  const d = cupPath(CX, top, bot, w, w - 10, 26)
  const clip = clipOf(path(d))
  const liqTop = top + 44
  let inner = liquidLayers(CX, liqTop, bot, w, it.layers, clip)
  inner += g(
    { 'clip-path': clip },
    range(34)
      .map(() =>
        circle(CX - 90 + rnd() * 180, liqTop + 20 + rnd() * 300, 3 + rnd() * 6, {
          fill: 'none',
          stroke: '#FFFFFF',
          'stroke-width': 3,
          'stroke-opacity': 0.75,
        })
      )
      .join('')
  )
  if (it.berries)
    inner += g(
      { 'clip-path': clip },
      [
        [-50, 300, 16],
        [10, 290, 15],
        [60, 250, 14],
        [-20, 120, 13],
        [40, 80, 12],
      ]
        .map(([dx, dy, s]) => fruitPiece('blueberry', CX + dx, liqTop + dy, s, 0))
        .join('')
    )
  if (it.limes) inner += g({ 'clip-path': clip }, fruitCluster('lime', CX, liqTop, bot, w, rnd, 3, 28))
  inner += g({ 'clip-path': clip }, iceCluster(CX, liqTop, w, rnd, 3))
  const fore =
    straw(CX - 44, top - 110, bot - 50, 10, it.straw, 20) +
    fruitPiece(it.wedge, CX + w / 2 - 2, top, 42, 0) +
    leaf(CX - 10, top - 20, 74, -38, '#2E9E4F') +
    leaf(CX - 14, top - 10, 60, 14, '#43B65F')
  return glassBack(d) + inner + glassFront(d, CX, top, bot, w) + fore
}

// Khuôn 7: nước ép (ly thấp bo tròn + trái cây bên cạnh)
function moldJuice(it, rnd) {
  const cx = 440
  const top = 300
  const bot = 590
  const wT = 230
  const wB = 200
  const d = cupPath(cx, top, bot, wT, wB, 58)
  const clip = clipOf(path(d))
  const liqTop = top + 40
  let inner = liquidLayers(cx, liqTop, bot, wT, it.layers, clip)
  inner += g(
    { 'clip-path': clip },
    range(16)
      .map(() =>
        circle(cx - 90 + rnd() * 180, liqTop + 30 + rnd() * 200, 2 + rnd() * 3, {
          fill: '#FFFFFF',
          'fill-opacity': 0.4,
        })
      )
      .join('')
  )
  inner += g({ 'clip-path': clip }, iceCluster(cx, liqTop, wT, rnd, 2))
  let fore = straw(cx + 50, top - 100, bot - 60, 14, it.straw, 22)
  const fx = 236
  const fy = 540
  if (it.fruit === 'orange') {
    fore += circle(fx, fy, 78, { fill: '#F39A2B' }) + circle(fx, fy, 66, { fill: '#FFE2B0' })
    fore += wheel(fx, fy, 62, '#F9B344', '#F9B344', '#FFE2B0')
    fore += circle(fx, fy, 7, { fill: '#FFE2B0' })
    fore += leaf(fx + 40, fy - 72, 60, -20, '#3F9D4A')
  } else if (it.fruit === 'pineapple') {
    const gr = linGrad(
      [
        [0, '#F6C53B'],
        [1, '#D99A1E'],
      ],
      'v'
    )
    fore += ellipse(fx, fy - 20, 70, 100, { fill: gr })
    let hatch = ''
    const hs = { stroke: '#B97A12', 'stroke-width': 4, 'stroke-opacity': 0.75 }
    for (let i = -4; i <= 4; i++) {
      hatch += line(fx - 90 + i * 30, fy - 140, fx + 10 + i * 30, fy + 100, hs)
      hatch += line(fx + 90 - i * 30, fy - 140, fx - 10 - i * 30, fy + 100, hs)
    }
    fore += g({ 'clip-path': clipOf(ellipse(fx, fy - 20, 70, 100)) }, hatch)
    for (const [ang, len] of [
      [-100, 90],
      [-82, 110],
      [-64, 96],
      [-118, 80],
      [-46, 78],
    ])
      fore += leaf(fx, fy - 112, len, ang, len > 100 ? '#2E8B46' : '#3FA75A')
  } else if (it.fruit === 'carrot') {
    for (const [dx, ang] of [
      [-20, 12],
      [30, -6],
    ]) {
      const x = fx + dx
      fore += g(
        { transform: rot(ang, x, fy) },
        path(
          `M${x - 34} ${fy - 90}Q${x} ${fy - 110} ${x + 34} ${fy - 90}L${x + 6} ${fy + 90}Q${x} ${fy + 100} ${x - 6} ${fy + 90}Z`,
          { fill: '#F2792B' }
        ) +
          [
            [-50, 24],
            [-10, 20],
            [30, 14],
          ]
            .map(([dy, hw]) =>
              line(x - hw / 2, fy + dy, x + hw / 2, fy + dy, {
                stroke: '#D8601A',
                'stroke-width': 4,
                'stroke-linecap': 'round',
              })
            )
            .join('') +
          leaf(x, fy - 96, 56, -100, '#3F9D4A') +
          leaf(x, fy - 96, 50, -70, '#52B868') +
          leaf(x, fy - 96, 46, -130, '#52B868')
      )
    }
  }
  return glassBack(d) + inner + glassFront(d, cx, top, bot, wT) + fore
}

// Khuôn 8: lát bánh (mặt cắt có lớp + mặt trên + mặt bên)
function moldSlice(it, rnd) {
  const cx = 400
  const bot = 586
  const faceH = 190
  const faceW = 230
  const faceTop = bot - faceH
  const l = cx - faceW / 2
  const r = cx + faceW / 2
  let out = plate(cx, bot + 10, 240)
  out += path(`M${r} ${faceTop}L${r + 90} ${faceTop - 70}L${r + 90} ${bot - 70}L${r} ${bot}Z`, {
    fill: shade(it.layers[0].color, 0.25),
  })
  let y = bot
  for (const L of it.layers) {
    const h = faceH * L.frac
    out += rect(l, y - h, faceW, h + 1, { fill: L.color })
    y -= h
  }
  out += path(`M${l} ${faceTop}L${l + 90} ${faceTop - 70}L${r + 90} ${faceTop - 70}L${r} ${faceTop}Z`, {
    fill: it.topColor,
  })
  if (it.topDots)
    out += range(40)
      .map(() =>
        circle(l + 30 + rnd() * (faceW + 40), faceTop - 60 + rnd() * 50, 2 + rnd() * 2, {
          fill: it.topDots,
          'fill-opacity': 0.9,
        })
      )
      .join('')
  if (it.topGlossy)
    out += path(`M${l + 30} ${faceTop - 20}L${l + 70} ${faceTop - 52}L${cx + 40} ${faceTop - 52}L${cx} ${faceTop - 20}Z`, {
      fill: '#FFFFFF',
      'fill-opacity': 0.35,
    })
  if (it.garnish === 'mint')
    out += leaf(cx + 60, faceTop - 48, 50, -30, '#3F9D4A') + leaf(cx + 58, faceTop - 44, 42, 24, '#52B868')
  if (it.garnish === 'bean')
    out +=
      ellipse(cx + 50, faceTop - 36, 18, 11, { fill: '#5A3521', transform: rot(-30, cx + 50, faceTop - 36) }) +
      line(cx + 40, faceTop - 30, cx + 60, faceTop - 42, { stroke: '#2E1A10', 'stroke-width': 3 })
  out += path(`M${l} ${faceTop}V${bot}H${r}V${faceTop}`, {
    fill: 'none',
    stroke: shade(it.layers[0].color, 0.3),
    'stroke-width': 3,
    'stroke-opacity': 0.5,
  })
  return out
}

// Khuôn 9: bông lan trứng muối (khối vuông vàng, sốt chảy, lòng đỏ, chà bông)
function moldSponge(it, rnd) {
  const cx = 400
  const bot = 586
  const w = 250
  const h = 170
  const top = bot - h
  const l = cx - w / 2
  const r = cx + w / 2
  let out = plate(cx, bot + 10, 240)
  out += path(`M${r} ${top}L${r + 80} ${top - 64}L${r + 80} ${bot - 64}L${r} ${bot}Z`, { fill: '#D9A03F' })
  out += rect(l, top, w, h, { fill: '#F3C462' })
  out += range(26)
    .map(() =>
      circle(l + 10 + rnd() * (w - 20), top + 14 + rnd() * (h - 28), 2.5, {
        fill: '#E2AA3C',
        'fill-opacity': 0.7,
      })
    )
    .join('')
  out += path(`M${l} ${top}L${l + 80} ${top - 64}L${r + 80} ${top - 64}L${r} ${top}Z`, { fill: '#F8D98A' })
  // sốt trứng muối phủ mặt trên và chảy xuống mặt trước
  out += path(`M${l + 20} ${top - 10}L${l + 90} ${top - 56}L${r + 60} ${top - 56}L${r - 20} ${top - 10}Z`, {
    fill: '#F5A623',
  })
  for (const [dx, len] of [
    [-100, 60],
    [-62, 30],
    [-20, 74],
    [26, 44],
    [70, 90],
    [104, 36],
  ])
    out += path(`M${cx + dx - 14} ${top - 8}h28v${len}a14 14 0 0 1 -28 0Z`, { fill: '#F5A623' })
  out += rect(l + 16, top - 10, w - 32, 14, { fill: '#F5A623' })
  // chà bông
  const fl = { fill: 'none', stroke: '#B9733A', 'stroke-width': 3, 'stroke-linecap': 'round' }
  out += range(30)
    .map(() => {
      const x = cx - 80 + rnd() * 200
      const y = top - 46 + rnd() * 30
      return path(`M${x} ${y}q${6 + rnd() * 8} ${-6 + rnd() * 12} ${14 + rnd() * 10} ${rnd() * 6}`, fl)
    })
    .join('')
  out += range(16)
    .map(() =>
      path(`M${cx - 70 + rnd() * 180} ${top - 42 + rnd() * 26}q6 -6 12 0`, { ...fl, stroke: '#E4A26A' })
    )
    .join('')
  // lòng đỏ
  out += ellipse(cx + 36, top - 36, 40, 24, { fill: '#F2931D' })
  out += ellipse(cx + 28, top - 42, 14, 8, { fill: '#FFFFFF', 'fill-opacity': 0.5 })
  return out
}

// Khuôn 10: bánh sừng bò (thân lưỡi liềm, các múi cuộn, vệt nướng vàng)
function moldCroissant() {
  const cx = 400
  const cy = 520
  const gr = linGrad(
    [
      [0, '#F8CF78'],
      [1, '#D18C2A'],
    ],
    'v'
  )
  // Các múi gối tròn xếp theo cung tròn (tâm ở dưới nên hai đầu cong xuống), to ở giữa, nhỏ dần ra hai đầu.
  // Vẽ từ hai đầu vào giữa để múi giữa nằm trên cùng.
  const R = 320
  const oy = cy + 230
  const angles = [-138, -42, -128.4, -51.6, -118.8, -61.2, -109.2, -70.8, -99.6, -80.4, -90]
  const seg = (deg) => {
    const t = (deg * Math.PI) / 180
    const k = 1 - (Math.abs(deg + 90) / 48) * 0.6
    return { x: cx + R * Math.cos(t), y: oy + R * Math.sin(t), rx: 82 * k, ry: 60 * k, a: deg + 90 }
  }
  let out = plate(cx, 604, 250)
  for (const deg of angles) {
    const s = seg(deg)
    out += ellipse(s.x, s.y + 10, s.rx + 2, s.ry + 2, {
      fill: '#B86E1D',
      'fill-opacity': 0.5,
      transform: rot(s.a, s.x, s.y + 10),
    })
  }
  for (const deg of angles) {
    const s = seg(deg)
    out += ellipse(s.x, s.y, s.rx, s.ry, {
      fill: gr,
      stroke: '#B86E1D',
      'stroke-width': 4,
      transform: rot(s.a, s.x, s.y),
    })
    out += ellipse(s.x - s.rx * 0.18, s.y - s.ry * 0.4, s.rx * 0.42, s.ry * 0.2, {
      fill: '#FFFFFF',
      'fill-opacity': 0.34,
      transform: rot(s.a, s.x, s.y),
    })
  }
  return out
}

// Khuôn 11: cookie
function moldCookie(it, rnd) {
  const cx = 400
  const cy = 470
  const R = 150
  const cookie = (x, y, r) => {
    let d = ''
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const rr = r + (i % 2 ? -4 : 4) + (rnd() - 0.5) * 4
      d += `${i ? 'L' : 'M'}${r2(x + Math.cos(a) * rr)} ${r2(y + Math.sin(a) * rr)}`
    }
    let o = path(d + 'Z', {
      fill: '#C78A4B',
      stroke: '#9A6230',
      'stroke-width': 4,
      'stroke-linejoin': 'round',
    })
    o += circle(x - r * 0.25, y - r * 0.25, r * 0.55, { fill: '#D9A063', 'fill-opacity': 0.6 })
    const chips = [
      [-0.5, -0.2],
      [-0.1, -0.55],
      [0.35, -0.4],
      [0.55, 0.1],
      [0.2, 0.3],
      [-0.3, 0.45],
      [-0.6, 0.15],
      [0.05, -0.1],
      [0.45, 0.55],
    ]
    for (const [dx, dy] of chips)
      o += ellipse(x + dx * r, y + dy * r, r * 0.09, r * 0.065, {
        fill: '#4A2B1E',
        transform: rot(dx * 120, x + dx * r, y + dy * r),
      })
    return o
  }
  let out = plate(cx, 600, 250)
  out += g({ transform: `translate(-86 -58) ${rot(-10, cx, cy)}` }, cookie(cx, cy, R * 0.84))
  out += cookie(cx + 20, cy + 10, R)
  out += [
    [-200, 90],
    [-170, 120],
    [210, 100],
  ]
    .map(([dx, dy]) =>
      rect(cx + dx, cy + dy, 10, 8, { rx: 3, fill: '#B07A3F', transform: rot(dx, cx + dx, cy + dy) })
    )
    .join('')
  return out
}

const MOLDS = {
  glass: moldGlass,
  cup: moldCup,
  bubble: moldBubble,
  fruitTea: moldFruitTea,
  frappe: moldFrappe,
  soda: moldSoda,
  juice: moldJuice,
  slice: moldSlice,
  sponge: moldSponge,
  croissant: moldCroissant,
  cookie: moldCookie,
}

// ============================================================ Cấu hình từng món
const COFFEE = '#3B241A'
const MILK = '#FBF3E4'
const CF_MILK = '#9C6A44'
const L = (frac, color) => ({ frac, color })
const ITEMS = {
  M001: { mold: 'glass', layers: [L(1, COFFEE)], ice: true, straw: '#111111' },
  M002: { mold: 'cup', layers: [L(1, COFFEE)], phin: true },
  M003: { mold: 'cup', layers: [L(0.3, MILK), L(0.7, shade(CF_MILK, 0.2))], phin: true },
  M004: { mold: 'glass', layers: [L(0.32, MILK), L(0.68, shade(CF_MILK, 0.15))], ice: true, straw: '#78350F' },
  M005: { mold: 'glass', layers: [L(0.6, '#E7CFAF'), L(0.4, '#C19467')], ice: true, straw: '#B45309' },
  M006: { mold: 'frappe', layers: [L(0.5, '#C9A982'), L(0.5, '#E6D7C0')], band: '#78350F', straw: '#78350F', flakes: true, drizzle: '#8B5A3C' },
  M007: { mold: 'glass', layers: [L(0.3, MILK), L(0.7, '#6B4530')], foam: '#FFF4DE', ice: true, straw: '#78350F' },
  M008: { mold: 'cup', layers: [L(1, '#4A2C1E')], foamDome: '#F7DD9A' },
  M009: { mold: 'bubble', layers: [L(1, '#C9A47C')], pearls: '#2A1A15', dome: true, band: '#BE185D', straw: '#BE185D' },
  M010: { mold: 'bubble', layers: [L(1, '#D4B38E')], ice: true, band: '#BE185D', straw: '#E0527F' },
  M011: { mold: 'bubble', layers: [L(0.45, '#E9F0DC'), L(0.55, '#8DBB6A')], dust: '#5E8F3E', dome: true, band: '#15803D', straw: '#15803D' },
  M012: { mold: 'bubble', layers: [L(1, '#7A4A2E')], pudding: true, ice: true, band: '#BE185D', straw: '#F3C04B' },
  M013: { mold: 'bubble', layers: [L(1, '#B59BD2')], bits: '#7C5BA8', dome: true, band: '#7C3AED', straw: '#7C3AED' },
  M014: { mold: 'bubble', layers: [L(1, '#C29566')], ice: true, band: '#BE185D', straw: '#78350F' },
  M015: { mold: 'bubble', layers: [L(1, '#F6EBDD')], stripes: '#6B3E1E', pearls: '#2A1A15', dome: true, band: '#78350F', straw: '#111111' },
  M016: { mold: 'bubble', layers: [L(0.35, '#F4F0E0'), L(0.65, '#9FD09B')], ice: true, band: '#15803D', straw: '#15803D' },
  M017: { mold: 'bubble', layers: [L(0.4, '#E8D4C2'), L(0.6, '#B36E4B')], ice: true, band: '#BE185D', straw: '#BE185D' },
  M018: { mold: 'fruitTea', layers: [L(0.5, '#F6B55C'), L(0.5, '#F9CF8C')], fruit: 'peach', count: 4, size: 30, band: '#F59E0B', straw: '#F59E0B', garnish: 'leaf' },
  M019: { mold: 'fruitTea', layers: [L(0.5, '#F7D7DE'), L(0.5, '#FBE9EE')], fruit: 'lychee', count: 5, size: 24, band: '#BE185D', straw: '#F27A9A', garnish: 'rose' },
  M020: { mold: 'fruitTea', layers: [L(0.5, '#F2A93B'), L(0.5, '#F7C45C')], fruit: 'passion', count: 0, seeds: true, band: '#15803D', straw: '#15803D', garnish: 'leaf' },
  M021: { mold: 'fruitTea', layers: [L(0.45, '#E8536F'), L(0.55, '#F58AA0')], fruit: 'strawberry', count: 3, size: 34, band: '#BE185D', straw: '#E6354F', garnish: 'leaf' },
  M022: { mold: 'fruitTea', layers: [L(0.5, '#F08EA6'), L(0.5, '#F7B9C8')], fruit: 'guava', count: 5, size: 20, band: '#15803D', straw: '#E86C8C', garnish: 'leaf' },
  M023: { mold: 'fruitTea', layers: [L(0.5, '#F5B429'), L(0.5, '#F9D262')], fruit: 'mango', count: 6, size: 18, band: '#15803D', straw: '#F59E0B', garnish: 'leaf' },
  M024: { mold: 'fruitTea', layers: [L(0.4, '#E9C44A'), L(0.6, '#F3E27E')], fruit: 'lemon', count: 3, size: 34, band: '#15803D', straw: '#15803D', garnish: 'lemon' },
  M025: { mold: 'frappe', layers: [L(0.6, '#8C5A3A'), L(0.4, '#B88B66')], band: '#1D4ED8', straw: '#1D4ED8', drizzle: '#8B5A3C' },
  M026: { mold: 'frappe', layers: [L(0.6, '#6FA85A'), L(0.4, '#9DC98A')], band: '#1D4ED8', straw: '#15803D', drizzle: '#6FA85A' },
  M027: { mold: 'frappe', layers: [L(0.6, '#4E2F22'), L(0.4, '#7A5240')], band: '#1D4ED8', straw: '#1D4ED8', drizzle: '#3B1F14' },
  M028: { mold: 'frappe', layers: [L(0.6, '#9E8C7E'), L(0.4, '#C3B4A6')], band: '#1D4ED8', straw: '#1D4ED8', bits: '#3B2A22', crumbs: '#3B2A22' },
  M029: { mold: 'frappe', layers: [L(0.6, '#F06A8A'), L(0.4, '#F8A5B9')], band: '#1D4ED8', straw: '#E6354F', drizzle: '#E6354F' },
  M030: { mold: 'frappe', layers: [L(0.6, '#F5B52E'), L(0.4, '#FAD06A')], band: '#1D4ED8', straw: '#F59E0B', drizzle: '#F2A516' },
  M031: { mold: 'soda', layers: [L(0.55, '#C8E8B7'), L(0.45, '#E3F3D8')], wedge: 'lime', limes: true, straw: '#15803D' },
  M032: { mold: 'soda', layers: [L(0.55, '#4C3D9E'), L(0.45, '#7B6CD1')], wedge: 'lemon', berries: true, straw: '#0E7490' },
  M033: { mold: 'juice', layers: [L(1, '#F7A52A')], fruit: 'orange', straw: '#0E7490' },
  M034: { mold: 'juice', layers: [L(1, '#F5CC3B')], fruit: 'pineapple', straw: '#0E7490' },
  M035: { mold: 'juice', layers: [L(1, '#F28233')], fruit: 'carrot', straw: '#0E7490' },
  M036: { mold: 'croissant' },
  M037: { mold: 'slice', layers: [L(0.22, '#8B5A3C'), L(0.3, '#F5E9D3'), L(0.2, '#8B5A3C'), L(0.28, '#F5E9D3')], topColor: '#4A2F23', topDots: '#2B1B14', garnish: 'bean' },
  M038: { mold: 'slice', layers: [L(0.22, '#F1D9A4'), L(0.5, '#FBECC2'), L(0.28, '#F5B52E')], topColor: '#F2A516', topDots: '#3C2A1E', topGlossy: true, garnish: 'mint' },
  M039: { mold: 'sponge' },
  M040: { mold: 'cookie' },
}
// Món chưa cấu hình: chọn khuôn theo danh mục, màu lấy từ màu danh mục
function fallbackItem(item, cat) {
  const base = tint(cat.color, 0.3)
  const map = {
    CF: { mold: 'glass', layers: [L(1, COFFEE)], ice: true, straw: '#111111' },
    TS: { mold: 'bubble', layers: [L(1, base)], ice: true, band: cat.color, straw: cat.color },
    TT: { mold: 'fruitTea', layers: [L(1, base)], fruit: 'mango', count: 4, size: 20, band: cat.color, straw: cat.color, garnish: 'leaf' },
    DX: { mold: 'frappe', layers: [L(1, base)], band: cat.color, straw: cat.color, drizzle: shade(base, 0.3) },
    SN: { mold: 'soda', layers: [L(1, base)], wedge: 'lemon', straw: cat.color },
    BN: { mold: 'cookie' },
  }
  return map[item.category] ?? map.BN
}

// ============================================================ Dựng và xuất
function renderItem(item, cat) {
  defs = []
  uid = 0
  const rnd = mulberry32(hashStr(item.code))
  const cfg = ITEMS[item.code] ?? fallbackItem(item, cat)
  const bg = tint(cat.color, 0.86)
  const it = { ...cfg, bg }
  let body = rect(0, 0, S, S, { fill: bg })
  body += circle(400, 420, 300, { fill: tint(cat.color, 0.77) })
  body += circle(560, 170, 54, { fill: tint(cat.color, 0.7), 'fill-opacity': 0.5 })
  body += circle(170, 620, 30, { fill: tint(cat.color, 0.7), 'fill-opacity': 0.5 })
  // Hình món phóng 1,12 lần quanh tâm để chiếm khung tốt hơn khi hiện thu nhỏ ở lưới POS
  body += g({ transform: 'translate(400 440) scale(1.12) translate(-400 -440)' }, shadow(cat.color) + MOLDS[it.mold](it, rnd))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${defs.join('')}</defs>${body}</svg>`
}

async function encodeWebp(svg) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  for (let q = 86; q >= 40; q -= 6) {
    const buf = await sharp(png).webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer()
    if (buf.length <= MAX_BYTES) return { buf, q, png }
  }
  throw new Error('Ảnh vượt 60 KB ở mọi mức chất lượng')
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  const cats = Object.fromEntries(data.categories.map((c) => [c.code, c]))
  mkdirSync(OUT_DIR, { recursive: true })
  if (PREVIEW) mkdirSync(PREVIEW, { recursive: true })
  const sizes = []
  for (const item of data.menuItems) {
    if (ONLY && !item.code.includes(ONLY)) continue
    const cat = cats[item.category]
    if (!cat) throw new Error(`Món ${item.code} có danh mục lạ: ${item.category}`)
    const file = item.image || `${item.code}.webp`
    const svg = renderItem(item, cat)
    const { buf, q, png } = await encodeWebp(svg)
    writeFileSync(join(OUT_DIR, file), buf)
    if (PREVIEW) writeFileSync(join(PREVIEW, file.replace(/\.\w+$/, '.png')), png)
    sizes.push(buf.length)
    const mold = ITEMS[item.code]?.mold ?? 'fallback'
    console.log(
      `${file.padEnd(12)} ${item.name.padEnd(26)} ${mold.padEnd(10)} ${(buf.length / 1024).toFixed(1).padStart(6)} KB  q${q}`
    )
  }
  const max = Math.max(...sizes) / 1024
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024
  console.log(`Đã tạo ${sizes.length} ảnh · lớn nhất ${max.toFixed(1)} KB · trung bình ${avg.toFixed(1)} KB`)
}

await main()
