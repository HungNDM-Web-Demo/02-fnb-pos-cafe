# Danh sách API — POS Quán Cafe

> Base URL dev: `https://localhost:7102` · Swagger: `https://localhost:7102/swagger`
> Quy ước chung (đường dẫn, phân trang, lỗi) và API nền (auth, users, roles, settings, audit-logs, demo): xem `ZDOCS/03-KIEN-TRUC/QUY-UOC-API.md`.
> File này là **hợp đồng giữa BE và FE**: BE (`Application/DTOs`) và FE (`features/*/types`) phải khớp từng trường. Ở chế độ `mock`, handler trong `features/*/mock` trả đúng các kiểu này và áp đúng các quy tắc ở §3. Bảng, enum: `06-THIET-KE-CSDL.md`.

---

## 1. Mã quyền nghiệp vụ

Theo `02-SRS.md` §7, thêm `orders.view-all` để tách "xem hóa đơn của mình" và "xem mọi hóa đơn". Quyền nền `dashboard.view` chỉ cấp `ADMIN`, `MANAGER`; `CASHIER` không có nên không thấy trang Tổng quan (TC-27).

| Nhóm | Mã quyền | Tên hiển thị | ADMIN | MANAGER | CASHIER |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Thực đơn | `menu-items.view` | Xem thực đơn | ✓ | ✓ | ✓ |
| Thực đơn | `menu-items.create` | Thêm danh mục, món, topping | ✓ | ✓ | |
| Thực đơn | `menu-items.update` | Sửa, ẩn/hiện, sắp xếp | ✓ | ✓ | |
| Thực đơn | `menu-items.delete` | Xóa món chưa bán, danh mục trống, topping chưa bán | ✓ | ✓ | |
| Thực đơn | `menu-items.availability` | Báo tạm hết, bán lại | ✓ | ✓ | ✓ |
| Bán hàng | `orders.create` | Bán hàng, giữ đơn, thanh toán | ✓ | ✓ | ✓ |
| Bán hàng | `orders.view` | Tra cứu hóa đơn của mình | ✓ | ✓ | ✓ |
| Bán hàng | `orders.view-all` | Tra cứu hóa đơn của mọi thu ngân | ✓ | ✓ | |
| Bán hàng | `orders.discount` | Giảm giá trong hạn mức, nhập voucher | ✓ | ✓ | ✓ |
| Bán hàng | `orders.discount-override` | Xác nhận giảm giá vượt hạn mức | ✓ | ✓ | |
| Bán hàng | `orders.reprint` | In lại hóa đơn | ✓ | ✓ | ✓ |
| Bán hàng | `orders.cancel` | Hủy hóa đơn | ✓ | ✓ | |
| Ca làm | `shifts.operate` | Mở ca, chốt ca của mình | ✓ | ✓ | ✓ |
| Ca làm | `shifts.view` | Xem mọi ca | ✓ | ✓ | |
| Ca làm | `shifts.review` | Ghi chú xử lý ca cần kiểm tra | ✓ | ✓ | |
| Khuyến mãi | `promotions.view` | Xem khuyến mãi, voucher | ✓ | ✓ | |
| Khuyến mãi | `promotions.create` | Thêm khuyến mãi, voucher | ✓ | ✓ | |
| Khuyến mãi | `promotions.update` | Sửa, tạm dừng | ✓ | ✓ | |
| Khuyến mãi | `promotions.delete` | Xóa | ✓ | ✓ | |
| Báo cáo | `reports.view` | Xem tổng quan doanh thu, báo cáo | ✓ | ✓ | |
| Khách hàng | `customers.view` | Tra cứu khách, xem danh sách, lịch sử | ✓ | ✓ | ✓ |
| Khách hàng | `customers.create` | Thêm nhanh khách | ✓ | ✓ | ✓ |

`orders.reprint` không có endpoint riêng: FE kiểm tra quyền rồi mở `/pos/receipt/[id]?reprint=1` bằng `GET /api/orders/{id}`. Màn bán hàng đọc thực đơn và khuyến mãi đang chạy bằng `orders.create` (không cần `menu-items.view`, `promotions.view`).

---

## 2. API nghiệp vụ

Bảng tra enum dùng chung cho mọi DTO (chuỗi PascalCase, khớp `06` §4):

```ts
type MenuItemStatus = 'DangBan' | 'TamHet' | 'An'
type OrderStatus = 'DangGiu' | 'DaThanhToan' | 'DaHuy'
type ServiceType = 'MangDi' | 'TaiCho'
type PaymentMethod = 'TienMat' | 'ChuyenKhoan'
type DiscountType = 'PhanTram' | 'SoTien'
type IceLevel = 'KhongDa' | 'It' | 'Vua' | 'Nhieu'
type SugarLevel = 0 | 30 | 50 | 70 | 100
type ShiftStatus = 'DangMo' | 'DaChot' | 'CanKiemTra' | 'DaKiemTra'
type PromotionScope = 'HoaDon' | 'DanhMuc' | 'Mon'
type PromotionStatus = 'SapChay' | 'DangChay' | 'DaHet' | 'TamDung'
type VoucherStatus = 'HoatDong' | 'HetLuot' | 'HetHan' | 'TamDung'
```

Tham số ngày `from`, `to` dạng `yyyy-MM-dd`, hiểu theo giờ Việt Nam (từ 00:00 `from` đến 23:59:59 `to`). Khoảng dài hơn 366 ngày → 400 `errors.from` "Khoảng ngày tối đa 366 ngày" (TC-30). `to` nhỏ hơn `from` → 400 `errors.to` "Ngày kết thúc phải sau ngày bắt đầu".

### 2.1. Thực đơn gộp cho màn bán hàng — `/api/menu`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/menu` | `orders.create` hoặc `menu-items.view` | Toàn bộ danh mục, món, topping chưa ẩn trong một lần gọi → `MenuBundle`. Món tạm hết vẫn trả để hiện mờ (FR-06) |

```ts
type MenuBundle = {
  categories: CategoryDto[]        // chưa ẩn, theo sortOrder
  items: MenuItemDto[]             // chưa ẩn, theo (categoryId, sortOrder)
  toppings: ToppingDto[]           // chưa ẩn, theo sortOrder
}
```

### 2.2. Danh mục — `/api/categories`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/categories` | `menu-items.view` | Tất cả (kể cả ẩn), theo `sortOrder`, kèm số món → `CategoryDto[]` |
| GET | `/api/categories/{id}` | `menu-items.view` | → `CategoryDto` |
| POST | `/api/categories` | `menu-items.create` | → `CategoryDto` (201) |
| PUT | `/api/categories/{id}` | `menu-items.update` | Tên, màu, ẩn/hiện → `CategoryDto` |
| PUT | `/api/categories/order` | `menu-items.update` | `{ ids: string[] }` toàn bộ danh mục theo thứ tự mới, đánh lại 10, 20, 30… → 204; thiếu/thừa id → 400 `errors.ids` |
| DELETE | `/api/categories/{id}` | `menu-items.delete` | Chỉ khi không còn món → 204; còn món → 400 "Danh mục đang có N món, chuyển món sang danh mục khác trước" kèm `itemCount` |

```ts
type CategoryDto = {
  id: string; code: string; name: string; color: string
  sortOrder: number; isHidden: boolean
  itemCount: number                // món chưa xóa, kể cả ẩn
}
type SaveCategoryRequest = { code: string; name: string; color: string; isHidden: boolean }
// Trùng code → 409 errors.code "Mã danh mục đã tồn tại"; color sai #RRGGBB → 400 errors.color
```

### 2.3. Món — `/api/menu-items`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/menu-items?page&pageSize&search&categoryId&status` | `menu-items.view` | Phân trang, `search` theo mã, tên (không dấu); `status` lọc `DangBan`/`TamHet`/`An`; mặc định `sortBy=sortOrder&sortDir=asc` → `PaginatedResult<MenuItemDto>` |
| GET | `/api/menu-items/{id}` | `menu-items.view` | → `MenuItemDto` |
| POST | `/api/menu-items` | `menu-items.create` | → `MenuItemDto` (201) |
| PUT | `/api/menu-items/{id}` | `menu-items.update` | Thay cả bộ size và danh sách topping → `MenuItemDto`; hóa đơn cũ giữ giá lúc bán (UC-01 1c) |
| PATCH | `/api/menu-items/{id}/availability` | `menu-items.availability` | `{ isSoldOut: boolean }` → 204 (UC-02) |
| PATCH | `/api/menu-items/{id}/hidden` | `menu-items.update` | `{ isHidden: boolean }` → 204 |
| POST | `/api/menu-items/{id}/image` | `menu-items.update` | Tải ảnh (multipart, field `file`, JPG/PNG/WebP tối đa 2 MB) → 200 `{ imageUrl }`; lưu `/uploads/menu/{yyyy}/{MM}/{guid}.{ext}` |
| DELETE | `/api/menu-items/{id}` | `menu-items.delete` | Chưa từng bán → 204; đã bán → 400 "Món đã có trong hóa đơn, chỉ có thể ẩn" (BR-18, TC-03) |

```ts
type MenuItemSizeDto = { id: string; name: string; price: number; isDefault: boolean; sortOrder: number }

type MenuItemDto = {
  id: string
  code: string
  name: string
  categoryId: string
  categoryName: string
  imageUrl?: string
  description?: string
  hasSugarOption: boolean
  hasIceOption: boolean
  isSoldOut: boolean
  isHidden: boolean
  status: MenuItemStatus           // An > TamHet > DangBan
  sortOrder: number
  sizes: MenuItemSizeDto[]         // theo sortOrder, đúng 1 isDefault
  minPrice: number                 // giá size thấp nhất, hiện trên thẻ món
  toppingIds: string[]             // topping được phép, kể cả topping đang tạm hết
  everSold: boolean                // đã có trong hóa đơn (BR-18) → FE vô hiệu nút Xóa, gợi ý Ẩn
  updatedAt: string
}

type SaveMenuItemRequest = {
  code: string
  name: string
  categoryId: string
  description?: string
  hasSugarOption: boolean
  hasIceOption: boolean
  sizes: { name: string; price: number; isDefault: boolean }[]   // ≥ 1; price > 0 bội số 1.000
  toppingIds: string[]
  sortOrder?: number               // bỏ trống khi tạo → cuối danh mục
}
```

Lỗi: trùng `code` → 409 `errors.code` "Mã món đã tồn tại" (TC-02); không có size → 400 `errors.sizes` "Cần ít nhất một size"; giá không phải bội số 1.000 → 400 `errors.sizes[i].price` "Giá phải là bội số 1.000 ₫"; nhiều hơn một `isDefault` → 400 `errors.sizes`; `categoryId` không có → 400 `errors.categoryId`. Thứ tự kiểm tra: định dạng (400) → danh mục (400) → trùng mã (409).

### 2.4. Topping — `/api/toppings`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/toppings` | `menu-items.view` | Tất cả, theo `sortOrder` → `ToppingDto[]` |
| POST | `/api/toppings` | `menu-items.create` | → `ToppingDto` (201) |
| PUT | `/api/toppings/{id}` | `menu-items.update` | → `ToppingDto` |
| PATCH | `/api/toppings/{id}/availability` | `menu-items.availability` | `{ isSoldOut: boolean }` → 204 (TC-04) |
| PATCH | `/api/toppings/{id}/hidden` | `menu-items.update` | `{ isHidden: boolean }` → 204 |
| DELETE | `/api/toppings/{id}` | `menu-items.delete` | Chưa từng bán → 204; đã bán → 400 "Topping đã có trong hóa đơn, chỉ có thể ẩn" |

```ts
type ToppingDto = {
  id: string; code: string; name: string; price: number
  isSoldOut: boolean; isHidden: boolean; status: MenuItemStatus
  sortOrder: number; everSold: boolean
}
type SaveToppingRequest = { code: string; name: string; price: number; sortOrder?: number }
// Trùng code → 409 errors.code "Mã topping đã tồn tại"; price không phải bội số 1.000 → 400 errors.price
```

### 2.5. Bán hàng, hóa đơn — `/api/orders`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/orders?page&pageSize&search&from&to&status&paymentMethod&shiftId&cashierId` | `orders.view` | Tra cứu (FR-19). `search` theo mã hóa đơn. Người không có `orders.view-all` chỉ thấy hóa đơn của mình (`cashierId` bị bỏ qua). Không trả đơn giữ. Mặc định `sortBy=paidAt&sortDir=desc` → `PaginatedResult<OrderListItem>` |
| GET | `/api/orders/{id}` | `orders.view` | Chi tiết để xem và in → `OrderDto`; hóa đơn của người khác mà không có `orders.view-all` → 403 |
| GET | `/api/orders/next-code` | `orders.create` | Mã hóa đơn dự kiến cho nội dung QR (UC-07 2a) → `{ code: string }`. Mã thật gán lúc thanh toán, có thể khác nếu máy khác thanh toán trước |
| POST | `/api/orders` | `orders.create` | **Thanh toán** (UC-07): nhận giỏ, tính lại tiền, kiểm tra ca, voucher, hạn mức, tạo hóa đơn `DaThanhToan` → `OrderDto` (201). Cùng `clientRequestId` gửi lại → trả hóa đơn đã tạo với **200** (TC-24) |
| POST | `/api/orders/{id}/cancel` | `orders.cancel` | `{ reason: string }` (bắt buộc, tối đa 200 ký tự) → `OrderDto` (UC-08). Chỉ hóa đơn `DaThanhToan` thuộc ca `DangMo` (BR-13) |
| GET | `/api/orders/held` | `orders.create` | Đơn giữ của thu ngân hiện tại trong ca đang mở, mới nhất trước → `HeldOrderDto[]` |
| POST | `/api/orders/held` | `orders.create` | Giữ đơn (UC-05) → `HeldOrderDto` (201). Quá 10 đơn → 400 "Tối đa 10 đơn giữ, thanh toán hoặc xóa bớt" (BR-15) |
| PUT | `/api/orders/held/{id}` | `orders.create` | Cập nhật đơn giữ (sau khi mở lại rồi giữ tiếp) → `HeldOrderDto` |
| DELETE | `/api/orders/held/{id}` | `orders.create` | Xóa đơn giữ → 204 |
| POST | `/api/orders/discount-approvals` | `orders.discount` | Quản lý xác nhận giảm giá vượt hạn mức ngay trên tablet (FR-15) → `DiscountApprovalDto` |

**Giỏ hàng gửi lên** (dùng chung cho giữ đơn và thanh toán):

```ts
type CartLineInput = {
  menuItemId: string
  sizeName: string                 // phải là size hiện có của món
  quantity: number                 // 1–99
  toppingIds: string[]             // phải nằm trong toppingIds của món, chưa ẩn, chưa tạm hết
  sugarLevel?: SugarLevel          // bắt buộc khi hasSugarOption
  iceLevel?: IceLevel              // bắt buộc khi hasIceOption
  note?: string                    // ≤ 200 ký tự
  discount?: { type: DiscountType; value: number; reason: string }   // giảm giá dòng (FR-12)
}

type CartInput = {
  serviceType: ServiceType
  tableTag?: string                // bắt buộc khi TaiCho (TC-15) → 400 errors.tableTag "Nhập số thẻ bàn"
  items: CartLineInput[]           // ≥ 1
  orderDiscount?: { type: DiscountType; value: number; reason: string }   // giảm giá hóa đơn thủ công
  voucherCode?: string
  customerId?: string
}

type HoldOrderRequest = CartInput & { holdName?: string }       // mặc định "Đơn N"

type CheckoutRequest = CartInput & {
  clientRequestId: string          // uuid FE sinh khi mở hộp thanh toán; giữ nguyên khi bấm lại
  heldOrderId?: string             // thanh toán từ đơn giữ: cập nhật chính bản ghi đó
  payment: {
    method: PaymentMethod
    cashReceived?: number          // bắt buộc khi TienMat, ≥ total (BR-08, TC-22)
    qrContent?: string             // chuỗi QR đã hiển thị, lưu để in lại
  }
  discountApprovalToken?: string   // từ POST /api/orders/discount-approvals khi vượt hạn mức
  expectedTotal: number            // tổng FE đã hiển thị; khác tổng BE tính → 409 (xem lỗi bên dưới)
}
```

**DTO trả về:**

```ts
type OrderItemToppingDto = { toppingId: string; name: string; price: number }

type OrderItemDto = {
  id: string
  menuItemId: string
  itemCode: string
  itemName: string
  categoryId: string
  sizeName: string
  sizePrice: number
  toppings: OrderItemToppingDto[]
  sugarLevel?: SugarLevel
  iceLevel?: IceLevel
  note?: string
  quantity: number
  unitPrice: number                // sizePrice + Σ topping
  lineTotal: number                // unitPrice × quantity (BR-01)
  discount?: { type: DiscountType; value: number; amount: number; reason: string }
  promotion?: { promotionId: string; name: string; amount: number }   // khuyến mãi cấp món
  lineNet: number                  // lineTotal − discount.amount − promotion.amount
  unavailable: boolean             // chỉ có ý nghĩa ở HeldOrderDto: món hoặc topping đã tạm hết/ẩn (BR-14, TC-05)
}

type OrderDto = {
  id: string
  code?: string                    // null khi DangGiu
  status: OrderStatus
  shiftId: string
  shiftCode: string
  cashierId: string
  cashierName: string
  serviceType: ServiceType
  tableTag?: string
  items: OrderItemDto[]
  subtotal: number                 // Σ lineTotal
  lineDiscountTotal: number
  itemPromotionDiscount: number
  orderDiscount?: { type: DiscountType; value: number; amount: number; reason: string; approvedByName?: string }
  promotion?: { promotionId: string; name: string; amount: number }   // khuyến mãi cấp hóa đơn
  voucher?: { voucherId: string; code: string; amount: number }
  discountTotal: number
  total: number                    // BR-02
  customer?: { id: string; phone: string; name: string }
  pointsEarned: number             // BR-17
  payment?: { method: PaymentMethod; amount: number; cashReceived?: number; changeAmount?: number; qrContent?: string }
  paidAt?: string
  cancelledAt?: string
  cancelledByName?: string
  cancelReason?: string
  createdAt: string
}

type OrderListItem = {
  id: string; code: string; status: OrderStatus
  paidAt: string; cashierName: string; serviceType: ServiceType; tableTag?: string
  itemCount: number                // Σ quantity
  total: number; discountTotal: number
  paymentMethod: PaymentMethod
  voucherCode?: string; cancelReason?: string
}

type HeldOrderDto = OrderDto & {
  holdName: string
  hasUnavailableItems: boolean     // có dòng unavailable → FE cảnh báo và khóa Thanh toán (TC-05)
}

type DiscountApprovalRequest = { username: string; password: string }
type DiscountApprovalDto = {
  token: string                    // chuỗi ngẫu nhiên, BE giữ trong bộ nhớ (IMemoryCache) 5 phút, dùng một lần
  approvedById: string
  approvedByName: string           // tên đăng nhập, ghi vào hóa đơn (TC-17 "quanly")
  expiresAt: string
}
```

**Lỗi của thanh toán và giữ đơn** (400 trừ khi ghi khác):

| Tình huống | `detail` | Ghi chú |
| :--- | :--- | :--- |
| Thu ngân chưa mở ca | "Chưa mở ca, mở ca trước khi bán hàng" | BR-10, TC-07 |
| Giỏ trống | "Đơn chưa có món" | `errors.items` |
| `TaiCho` không có số thẻ bàn | "Nhập số thẻ bàn" | `errors.tableTag`, TC-15 |
| Món, size, topping không tồn tại hoặc đã ẩn | "Món {tên} không còn trong thực đơn" | `errors["items[i].menuItemId"]` |
| Món hoặc topping tạm hết | "{tên} đang tạm hết" | `errors["items[i].menuItemId"]` hoặc `errors["items[i].toppingIds"]`, BR-14 |
| Số lượng ngoài 1–99 | "Số lượng từ 1 đến 99" | `errors["items[i].quantity"]` |
| Voucher không hợp lệ | Câu đúng như §2.7 | `errors.voucherCode` |
| Giảm giá vượt 10% mà không có `discountApprovalToken` | "Giảm giá vượt hạn mức 10%, cần quản lý xác nhận" | BR-04; kèm `discountLimit` (số tiền tối đa thu ngân tự giảm) và `requestedDiscount` |
| Token duyệt sai, hết hạn hoặc đã dùng | "Mã xác nhận của quản lý không hợp lệ, xác nhận lại" | |
| Tiền mặt không đủ | "Còn thiếu {n} ₫" | `errors["payment.cashReceived"]`, TC-22 |
| Tổng BE tính ≠ `expectedTotal` | **409** "Tổng tiền đã thay đổi (khuyến mãi hoặc giá), kiểm tra lại đơn" | Kèm `serverTotal`; FE tính lại giỏ, hiển thị tổng mới và cho bấm lại |
| Cùng `clientRequestId` đã tạo hóa đơn | **200** trả `OrderDto` cũ | Không phải lỗi; FE xử lý như thành công (TC-24) |
| `heldOrderId` không phải của mình hoặc không còn | **404** "Đơn giữ không còn" | |
| Hủy hóa đơn không thuộc ca đang mở | "Chỉ hủy được hóa đơn trong ca đang mở" | BR-13 |
| Hủy hóa đơn đã hủy | "Hóa đơn đã hủy trước đó" | |
| Hủy thiếu lý do | "Nhập lý do hủy" | `errors.reason` |

**Xác nhận giảm giá vượt hạn mức** (`POST /api/orders/discount-approvals`): người gọi là thu ngân đang đăng nhập (có `orders.discount`); body là tài khoản quản lý. BE kiểm tra mật khẩu như đăng nhập nhưng **không** tạo phiên, không ghi `LastLoginAt`, vẫn đếm sai mật khẩu theo BR-SYS-03. Sai tên hoặc mật khẩu → **400** "Tên đăng nhập hoặc mật khẩu không đúng" (không dùng 401 để `lib/axios.ts` không làm mới token của thu ngân). Tài khoản đúng nhưng không có `orders.discount-override` → **403** "Tài khoản không có quyền xác nhận giảm giá" (TC-18). Tài khoản bị khóa → 400 "Tài khoản đã bị khóa, liên hệ quản trị viên". Thành công → token 5 phút, dùng một lần; FE gửi kèm `CheckoutRequest.discountApprovalToken`, BE ghi `DiscountApprovedById/Name` vào hóa đơn (TC-17). Chế độ mock: handler kiểm tra mật khẩu demo và quyền của tài khoản trong mock-db, token là chuỗi ngẫu nhiên lưu trong bộ nhớ của tab.

### 2.6. Ca làm — `/api/shifts`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/shifts/current` | `shifts.operate` | Ca `DangMo` của người gọi → `ShiftDto`; chưa có → **204** (FE hiện hộp Mở ca, TC-07) |
| POST | `/api/shifts` | `shifts.operate` | Mở ca `{ openingCash: number }` → `ShiftDto` (201). Đã có ca đang mở → trả ca đó với **200** (UC-03 E2). `openingCash` âm hoặc trống → 400 `errors.openingCash` "Nhập tiền đầu ca" |
| GET | `/api/shifts/current/summary` | `shifts.operate` | Tổng hợp tạm thời của ca đang mở (FR-22) → `ShiftSummary`; không có ca → 204 |
| POST | `/api/shifts/current/close` | `shifts.operate` | Chốt ca `CloseShiftRequest` → `ShiftDto` (UC-10) |
| GET | `/api/shifts?page&pageSize&from&to&cashierId&status` | `shifts.view` | Mặc định 7 ngày gần nhất, `sortBy=openedAt desc` → `PaginatedResult<ShiftListItem>` (FR-24) |
| GET | `/api/shifts/{id}` | `shifts.view` hoặc ca của mình | Chi tiết kèm tổng hợp và hóa đơn → `ShiftDetail`; ca người khác mà không có `shifts.view` → 403 |
| PATCH | `/api/shifts/{id}/review` | `shifts.review` | `{ note: string }` → **200** `ShiftDto` (FR-25, TC-11). Ca không ở `CanKiemTra` → 400 "Chỉ ghi chú xử lý cho ca Cần kiểm tra"; thiếu ghi chú → 400 `errors.note` |

```ts
type ShiftDto = {
  id: string; code: string; status: ShiftStatus
  cashierId: string; cashierName: string
  openedAt: string; closedAt?: string
  openingCash: number
  orderCount: number; cancelledOrderCount: number
  cashSales: number; transferSales: number; cashCancelled: number
  expectedCash?: number; countedCash?: number; difference?: number
  note?: string
  reviewNote?: string; reviewedByName?: string; reviewedAt?: string
}

type ShiftSummary = {
  shiftId: string; code: string; openedAt: string; openingCash: number
  orderCount: number               // DaThanhToan
  cancelledOrderCount: number
  cashSales: number                // tiền mặt của hóa đơn DaThanhToan
  transferSales: number
  cashCancelled: number            // tiền mặt của hóa đơn DaHuy (thông tin)
  revenue: number                  // cashSales + transferSales
  expectedCash: number             // BR-11
  heldOrders: { id: string; holdName: string; total: number }[]   // BR-15
}

type CloseShiftRequest = { countedCash: number; note?: string }
// Còn đơn giữ → 400 "Còn N đơn giữ, thanh toán hoặc xóa trước khi chốt ca" kèm heldOrders (TC-10)
// |countedCash − expectedCash| > 50.000 mà không có note → 400 errors.note "Chênh lệch quá 50.000 ₫, cần ghi chú" (TC-09)
// countedCash âm hoặc trống → 400 errors.countedCash

type ShiftListItem = {
  id: string; code: string; status: ShiftStatus
  cashierName: string; openedAt: string; closedAt?: string
  orderCount: number; revenue: number           // cashSales + transferSales; ca đang mở tính tạm thời
  expectedCash?: number; countedCash?: number; difference?: number
}

type ShiftDetail = ShiftDto & {
  revenue: number
  orders: OrderListItem[]          // mọi hóa đơn của ca, gồm đã hủy, theo paidAt
}
```

Công thức: `cashSales` = Σ `payment.amount` của hóa đơn `DaThanhToan` thanh toán tiền mặt trong ca; `cashCancelled` = Σ tiền mặt của hóa đơn `DaHuy` trong ca; **`expectedCash = openingCash + cashSales`** (bằng BR-11 "tiền đầu ca + tiền mặt thu − tiền mặt hóa đơn hủy", vì tiền mặt thu gồm cả hóa đơn sau đó bị hủy; TC-08: 1.000.000 + 120.000 = 1.120.000; TC-25: hủy 88.000 tiền mặt thì giảm 88.000). `difference = countedCash − expectedCash`; `|difference| > 50.000` → `CanKiemTra`, ngược lại `DaChot` (BR-12, TC-09: 1.050.000 − 1.120.000 = −70.000).

Mã ca `CA` + `yyMMdd` + 2 số thứ tự ca mở trong ngày (TC-06). Số tổng hợp ghi vào `Pos_Shifts` lúc chốt; hủy hóa đơn sau khi chốt không xảy ra (BR-13).

### 2.7. Khuyến mãi — `/api/promotions`, voucher — `/api/vouchers`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/promotions?page&pageSize&search&status` | `promotions.view` | `status` lọc `PromotionStatus`; mặc định `sortBy=startDate desc` → `PaginatedResult<PromotionDto>` |
| GET | `/api/promotions/active` | `orders.create` | Khuyến mãi `DangChay` hôm nay (chưa xét khung giờ) để màn bán hàng tự áp tại máy (FR-14) → `PromotionDto[]` |
| GET | `/api/promotions/{id}` | `promotions.view` | → `PromotionDto` |
| POST | `/api/promotions` | `promotions.create` | → `PromotionDto` (201); BE sinh `code` `KM` + 2 số |
| PUT | `/api/promotions/{id}` | `promotions.update` | → `PromotionDto` |
| PATCH | `/api/promotions/{id}/pause` | `promotions.update` | `{ isPaused: boolean }` → 204 |
| DELETE | `/api/promotions/{id}` | `promotions.delete` | Xóa mềm → 204; hóa đơn cũ giữ tên đã chụp |
| GET | `/api/vouchers?page&pageSize&search&status` | `promotions.view` | → `PaginatedResult<VoucherDto>` |
| GET | `/api/vouchers/{id}` | `promotions.view` | → `VoucherDto` |
| POST | `/api/vouchers` | `promotions.create` | → `VoucherDto` (201) |
| PUT | `/api/vouchers/{id}` | `promotions.update` | → `VoucherDto` |
| PATCH | `/api/vouchers/{id}/pause` | `promotions.update` | `{ isPaused: boolean }` → 204 |
| DELETE | `/api/vouchers/{id}` | `promotions.delete` | `usedCount = 0` → 204; đã dùng → 400 "Voucher đã được dùng, chỉ có thể tạm dừng" |
| POST | `/api/vouchers/check` | `orders.discount` | `{ code: string; subtotal: number }` kiểm tra BR-06 khi thu ngân nhập mã (UC-06 1b) → `VoucherCheckResult`; không hợp lệ → 400 `errors.code` với câu bên dưới |

```ts
type PromotionDto = {
  id: string; code: string; name: string; description?: string
  discountType: DiscountType; discountValue: number; maxDiscount?: number
  scope: PromotionScope
  categoryId?: string; categoryName?: string
  menuItemIds: string[]            // khi scope = Mon
  minOrderAmount: number
  startTime?: string; endTime?: string          // "14:00", "16:00"
  daysOfWeek: number[]             // 1 = Thứ Hai … 7 = Chủ nhật; rỗng = mọi ngày
  startDate: string; endDate: string            // yyyy-MM-dd theo giờ Việt Nam
  isPaused: boolean
  status: PromotionStatus
  updatedAt: string
}
type SavePromotionRequest = Omit<PromotionDto, 'id' | 'code' | 'categoryName' | 'status' | 'updatedAt' | 'isPaused'>
// scope = DanhMuc thiếu categoryId → 400 errors.categoryId; scope = Mon mà menuItemIds rỗng → 400 errors.menuItemIds
// endDate < startDate → 400 errors.endDate; endTime ≤ startTime → 400 errors.endTime
// discountType = PhanTram mà discountValue ngoài 1–100 → 400 errors.discountValue; SoTien không bội số 1.000 → 400 errors.discountValue

type VoucherDto = {
  id: string; code: string; description?: string
  discountType: DiscountType; discountValue: number; maxDiscount?: number
  minOrderAmount: number
  maxUses?: number; usedCount: number
  expiresAt?: string               // ISO UTC
  isPaused: boolean
  status: VoucherStatus
  updatedAt: string
}
type SaveVoucherRequest = Omit<VoucherDto, 'id' | 'usedCount' | 'status' | 'updatedAt' | 'isPaused'>
// code 4–12 ký tự A–Z0–9 (BE viết hoa) → sai 400 errors.code "Mã 4–12 ký tự chữ in hoa và số"; trùng → 409 errors.code "Mã voucher đã tồn tại"

type VoucherCheckResult = {
  voucherId: string; code: string
  discountType: DiscountType; discountValue: number; maxDiscount?: number
  minOrderAmount: number
  estimatedDiscount: number        // tính trên subtotal gửi lên, theo §3; FE hiển thị, BE tính lại khi thanh toán
}
```

Thứ tự kiểm tra voucher và câu báo lỗi (`errors.code`, `detail` cùng câu; dùng ở cả `/api/vouchers/check` và thanh toán, TC-20):

| Thứ tự | Điều kiện | `detail` |
| :---: | :--- | :--- |
| 1 | Mã không tồn tại (đã xóa) | "Voucher không tồn tại" |
| 2 | `isPaused` | "Voucher đang tạm dừng" |
| 3 | Quá `expiresAt` | "Voucher đã hết hạn" |
| 4 | `usedCount ≥ maxUses` | "Voucher đã hết lượt" |
| 5 | `subtotal < minOrderAmount` | "Đơn tối thiểu {minOrderAmount} ₫" (định dạng `60.000 ₫`) |

### 2.8. Báo cáo — `/api/reports`

Mọi báo cáo chỉ tính hóa đơn `DaThanhToan` theo `paidAt` (BR-16), doanh thu = Σ `total`. Quyền `reports.view`. Xuất Excel làm ở FE (`write-excel-file`) từ dữ liệu các DTO này (FR-32).

| Method | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| GET | `/api/reports/dashboard` | Tổng quan hôm nay (FR-01, FR-02) → `DashboardReport` |
| GET | `/api/reports/revenue?from&to` | Doanh thu theo ngày và kỳ liền trước cùng độ dài (FR-28) → `RevenueReport` |
| GET | `/api/reports/top-items?from&to&categoryId&limit` | Món bán chạy (FR-29), `limit` mặc định 20 → `TopItemsReport` |
| GET | `/api/reports/heatmap?from&to` | Bảng nhiệt giờ × thứ (FR-30) → `HeatmapReport` |
| GET | `/api/reports/payment-methods?from&to` | Theo phương thức (FR-31) → `PaymentMethodReport` |
| GET | `/api/reports/cashiers?from&to` | Theo thu ngân (FR-31) → `CashierReport` |
| GET | `/api/reports/cancelled-orders?from&to&page&pageSize` | Hóa đơn hủy (SRS §6) → `PaginatedResult<CancelledOrderItem>` |

```ts
type DashboardReport = {
  date: string                     // hôm nay yyyy-MM-dd
  asOf: string                     // thời điểm tính (ISO)
  revenue: number; orderCount: number
  avgOrderValue: number            // 0 khi chưa có hóa đơn
  yesterdaySameTime: { revenue: number; orderCount: number }   // hôm qua tới cùng giờ:phút
  revenueChangePercent?: number    // (revenue − hôm qua) / hôm qua × 100, 1 chữ số; null khi hôm qua = 0
  hourly: { hour: number; revenue: number; orderCount: number }[]   // 24 phần tử, 0–23
  topItems: { menuItemId: string; code: string; name: string; quantity: number; revenue: number }[]   // 5, theo quantity
  openShifts: { id: string; code: string; cashierName: string; openedAt: string }[]
}

type RevenueReport = {
  from: string; to: string
  totals: { revenue: number; orderCount: number; discount: number; avgOrderValue: number }
  previous: { from: string; to: string; revenue: number; orderCount: number; discount: number }
  revenueChangePercent?: number
  daily: { date: string; revenue: number; orderCount: number; discount: number; previousRevenue: number }[]
  // đủ mọi ngày trong khoảng (TC-28: 30 ngày → 30 điểm); previousRevenue là ngày cùng vị trí ở kỳ trước
}

type TopItemsReport = {
  totalQuantity: number; totalRevenue: number
  items: { menuItemId: string; code: string; name: string; categoryId: string; categoryName: string
           quantity: number; revenue: number; share: number }[]   // share = % doanh thu, 1 chữ số; theo quantity giảm dần
}
// revenue của một món = Σ lineNet (thành tiền sau giảm giá dòng và khuyến mãi cấp món), không phân bổ giảm giá hóa đơn

type HeatmapReport = {
  cells: { dayOfWeek: number; hour: number; revenue: number; orderCount: number }[]   // 7 × 24, dayOfWeek 1 = Thứ Hai … 7 = Chủ nhật
  maxRevenue: number
}

type PaymentMethodReport = {
  items: { method: PaymentMethod; amount: number; orderCount: number; share: number }[]   // luôn đủ 2 phương thức
}

type CashierReport = {
  items: { cashierId: string; cashierName: string; shiftCount: number; orderCount: number; revenue: number
           totalDifference: number; shiftsNeedingReview: number }[]
  // shiftCount, totalDifference tính theo ca có openedAt trong khoảng (gồm ca đang mở, difference null coi là 0)
}

type CancelledOrderItem = {
  id: string; code: string; paidAt: string; cancelledAt: string
  cashierName: string; cancelledByName: string; cancelReason: string
  total: number; paymentMethod: PaymentMethod
}
```

### 2.9. Khách hàng — `/api/customers` (P3)

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/customers?page&pageSize&search` | `customers.view` | `search` theo SĐT, tên; mặc định `sortBy=lastOrderAt desc` → `PaginatedResult<CustomerDto>` |
| GET | `/api/customers/lookup?phone=` | `customers.view` | Tra nhanh ở màn bán hàng (FR-33) → `CustomerDto`; không có → 404 |
| GET | `/api/customers/{id}` | `customers.view` | Kèm 20 hóa đơn gần nhất → `CustomerDetail` |
| POST | `/api/customers` | `customers.create` | Thêm nhanh → `CustomerDto` (201); trùng SĐT → 409 `errors.phone` "Số điện thoại đã có khách"; sai định dạng → 400 `errors.phone` |
| PUT | `/api/customers/{id}` | `customers.create` | Sửa tên, ghi chú → `CustomerDto` |

```ts
type CustomerDto = {
  id: string; phone: string; name: string; note?: string
  points: number; orderCount: number; totalSpent: number
  lastOrderAt?: string; createdAt: string
}
type SaveCustomerRequest = { phone: string; name: string; note?: string }
type CustomerDetail = CustomerDto & { recentOrders: OrderListItem[] }
```

### 2.10. Thông tin quán cho bill — `/api/store-profile`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/store-profile` | Đã đăng nhập | Khóa cài đặt `Store.*` (xem `project.json`) → `StoreProfile`, để bill và QR không cần `settings.view` |

```ts
type StoreProfile = {
  name: string                     // Store.Name "Mộc Cafe"
  address: string                  // Store.Address
  phone: string                    // Store.Phone
  receiptFooter: string            // Store.ReceiptFooter
  bankBin: string                  // Store.BankBin, mã ngân hàng VietQR
  bankAccount: string              // Store.BankAccount
  bankAccountName: string          // Store.BankAccountName
}
```

Quản trị viên sửa các khóa này ở Cài đặt chung (`PUT /api/settings`, nhóm "Quán").

---

## 3. Công thức tính tiền (nguồn sự thật chung của BE, FE và mock)

FE tính tại máy để giỏ phản hồi ngay (NFR-02) bằng `features/pos/lib/pricing.ts`; handler mock dùng lại chính hàm đó; BE tính lại trong `OrderPricingService` khi giữ đơn và thanh toán. Hai bên phải ra cùng số với cùng đầu vào; số tổng BE trả là chính thức (`expectedTotal` lệch → 409).

Ký hiệu `roundDown(x)` = làm tròn **xuống** tới bội số 1.000 ₫ (BR-03): `Math.floor(x / 1000) * 1000`.

1. **Dòng** (BR-01): `unitPrice = sizePrice + Σ toppingPrice`; `lineTotal = unitPrice × quantity`.
2. **Giảm giá dòng thủ công** (FR-12): `PhanTram` → `roundDown(lineTotal × value / 100)`; `SoTien` → `min(value, lineTotal)`. `value` phần trăm trong 1–100, số tiền bội số 1.000.
3. **Khuyến mãi cấp món** (phạm vi `DanhMuc`, `Mon`; BR-07 xét theo thời điểm thanh toán): với mỗi dòng thuộc phạm vi của một khuyến mãi đang hiệu lực, `base = lineTotal − lineDiscount`; `PhanTram` → `roundDown(base × value / 100)`; `SoTien` → `min(value, base)` **cho mỗi đơn vị** nhân `quantity`, không vượt `base`. Nhiều khuyến mãi cấp món cùng áp một dòng → chọn mức giảm lớn nhất. `maxDiscount` của khuyến mãi áp trên tổng giảm của khuyến mãi đó trong hóa đơn (cắt bớt từ dòng cuối). `lineNet = lineTotal − lineDiscount − itemPromotion`.
4. **Tổng tiền hàng**: `subtotal = Σ lineTotal`; `lineDiscountTotal = Σ lineDiscount`; `itemPromotionDiscount = Σ itemPromotion`; `remaining = subtotal − lineDiscountTotal − itemPromotionDiscount`.
5. **Giảm giá hóa đơn thủ công**: `PhanTram` → `roundDown(remaining × value / 100)`; `SoTien` → `min(value, remaining)`. `remaining -= orderDiscountAmount`. TC-16: 108.000 × 10% = 10.800 → 10.000; TC-17: 20% = 21.600 → 21.000.
6. **Hạn mức thu ngân** (BR-04): `limit = roundDown(subtotal × 10 / 100)`; nếu `lineDiscountTotal + orderDiscountAmount > limit` thì cần `discountApprovalToken`, nếu không → 400 (§2.5). Khuyến mãi và voucher không tính vào hạn mức. TC-16: 10.000 ≤ 10.000 → không cần; TC-17: 21.000 > 10.000 → cần.
7. **Voucher** (BR-06, xét `subtotal` ≥ `minOrderAmount`): `PhanTram` → `min(roundDown(remaining × value / 100), maxDiscount ?? ∞)`; `SoTien` → `min(value, remaining)`. TC-19: 108.000 → giảm 20.000 → 88.000.
8. **Khuyến mãi cấp hóa đơn** (phạm vi `HoaDon`, điều kiện: `DangChay`, trong khung giờ và ngày trong tuần theo thời điểm thanh toán, `subtotal ≥ minOrderAmount`): tính như voucher trên `remaining`; nhiều khuyến mãi hợp lệ → chọn lớn nhất.
9. **Không cộng dồn** (BR-05): `orderLevel = max(voucherAmount, promotionAmount)`; bằng nhau thì giữ voucher. Mức bị bỏ không ghi vào hóa đơn; FE báo cho thu ngân "Khuyến mãi {tên} không áp vì voucher giảm nhiều hơn" (hoặc ngược lại) dựa trên kết quả hàm tính. Voucher bị bỏ vì khuyến mãi lớn hơn **không** tăng `usedCount`, hóa đơn không ghi `voucher`.
10. **Tổng thanh toán** (BR-02): `discountTotal = lineDiscountTotal + itemPromotionDiscount + orderDiscountAmount + voucherAmount + promotionAmount`; `total = max(0, subtotal − discountTotal)`.
11. **Tiền mặt** (BR-08): `cashReceived ≥ total`, `changeAmount = cashReceived − total`. Nút mệnh giá nhanh: đủ tiền, 50.000, 100.000, 200.000, 500.000; nút nhỏ hơn `total` bị vô hiệu.
12. **Điểm** (BR-17): `pointsEarned = floor(total / 10000)`; hủy hóa đơn trừ lại đúng số này.

Khuyến mãi "đang hiệu lực" tại thời điểm `t` (giờ Việt Nam): không `isPaused`; `startDate ≤ ngày(t) ≤ endDate`; `daysOfWeek` rỗng hoặc chứa thứ của `t`; `startTime` null hoặc `startTime ≤ giờ(t) < endTime`. FE dùng `GET /api/promotions/active` rồi tự xét khung giờ tại máy mỗi lần giỏ đổi (FR-14, 1c); BE xét lại theo giờ máy chủ lúc thanh toán (BR-07). Lệch nhau (vd bấm thanh toán đúng 16:00:00) → 409 `expectedTotal`, FE tính lại và hiện tổng mới.

Hủy hóa đơn (BR-13): trạng thái `DaHuy`, `pointsEarned` giữ nguyên trên hóa đơn để tra cứu nhưng khách bị trừ lại điểm, `usedCount` voucher giảm 1, số tổng hợp ca đang mở tính lại tự động (do tính từ hóa đơn `DaThanhToan`).

---

## 4. Quy ước riêng cho FE

- **Trang sau đăng nhập**: `homeAfterLogin` trong `project.json` là `/dashboard`. `app/page.tsx` và bước chuyển sau đăng nhập/đổi vai trò chọn theo quyền: có `dashboard.view` → `/dashboard`; không có nhưng có `orders.create` → `/pos`; còn lại → mục menu đầu tiên có quyền. Thu ngân vì vậy vào thẳng Bán hàng (TC-27).
- **Menu sidebar** (`config/routes/`): Tổng quan (`dashboard.view`), Bán hàng `/pos` (`orders.create`), Hóa đơn `/orders` (`orders.view`), Ca làm `/shifts` (`shifts.view`), Ca của tôi `/shifts/current` (`shifts.operate`, ẩn với người có `shifts.view`), Thực đơn `/menu-items` (`menu-items.view`, thu ngân không thấy vì mục này gắn thêm `menu-items.update`), Khuyến mãi `/promotions` (`promotions.view`), Báo cáo `/reports` (`reports.view`), Khách hàng `/customers` (`customers.view`, chỉ hiện với `orders.view-all`). `/shifts` với thu ngân → `/forbidden` (TC-12).
- **Màn bán hàng** `/pos`: giỏ hàng là state Zustand lưu `sessionStorage` của tab (NFR-05); gộp dòng giống hệt (cùng món, size, topping đã sắp xếp, đường, đá, ghi chú) bằng cách cộng số lượng (TC-14). Khi tải trang gọi `GET /api/shifts/current`; 204 → hộp Mở ca, đóng hộp thì lưới món khóa (TC-07). `clientRequestId` sinh bằng `crypto.randomUUID()` lúc mở hộp thanh toán và chỉ đổi sau khi thanh toán thành công hoặc giỏ đổi; bấm Hoàn tất khi đang chờ thì nút khóa; lỗi mạng giữ giỏ và cho bấm lại với cùng mã (TC-24).
- **Tạm hết tại màn bán hàng**: nhấn giữ thẻ món 500 ms (hoặc chuột phải trên desktop) mở menu "Tạm hết"/"Bán lại"; topping có nút biểu tượng cạnh tên trong hộp tùy chọn (UC-02).
- **Đơn giữ** lưu phía máy chủ (`/api/orders/held`) để nhiều tablet và chế độ api thấy nhau; mở lại đơn có `hasUnavailableItems` thì đánh dấu dòng đỏ, khóa Thanh toán tới khi xóa dòng hoặc món được bán lại (TC-05).
- **QR chuyển khoản**: FE tự vẽ bằng gói `qrcode` từ chuỗi VietQR giả lập `000201010211…` (hoặc đơn giản là chuỗi `VIETQR|{bankBin}|{bankAccount}|{amount}|{code}`), không gọi dịch vụ ngoài; nội dung chuyển khoản là `code` từ `GET /api/orders/next-code`. Chuỗi đã hiển thị gửi trong `payment.qrContent` để in lại giống lúc bán.
- **Bản in** `/pos/receipt/[id]` (hóa đơn) và `/shifts/receipt/[id]` (phiếu chốt ca): trang không có sidebar, CSS `@page { size: 80mm auto }`, chữ ≥ 12 px (NFR-04), tự gọi `window.print()` khi mở từ luồng thanh toán (`?print=1`), có dòng "IN LẠI" khi `?reprint=1` (UC-09).
- **Báo cáo**: khoảng ngày mặc định 30 ngày; bộ chọn nhanh Hôm nay, 7 ngày, 30 ngày, Tháng này, Tháng trước, Tùy chọn; FE chặn khoảng > 366 ngày trước khi gọi (TC-30). Xuất Excel bằng `write-excel-file` từ DTO đang hiển thị.
- **Định dạng**: tiền `formatVnd` (`108.000 ₫`), chênh lệch ca âm hiển thị `−70.000 ₫` màu `danger` khi vượt 50.000 ₫, ngược lại `success` (TC-09).
- **Mock**: collection `categories`, `menu-items`, `toppings`, `shifts`, `orders` (gồm đơn giữ), `promotions`, `vouchers`, `customers`; seed nạp từ `src/mock/seed/demo-data.json` qua `resolveRelativeDates` và tính lại tiền bằng `pricing.ts` (quy ước suy ra trường: `06` §5.2). Mã hóa đơn, mã ca sinh trong handler theo BR-09 từ số bản ghi trong ngày. Token duyệt giảm giá giữ trong biến module, 5 phút.

---

## 5. Ngoại lệ có chủ đích và quyết định của BE (FE khớp theo)

Những điểm tài liệu trên chưa nói rõ hoặc BE làm khác có lý do; FE mock làm giống để hai chế độ ra cùng kết quả.

| # | Chỗ | BE làm | Lý do |
| :---: | :--- | :--- | :--- |
| 1 | `POST /api/orders` | Ngoài `orders.create`, khi giỏ có giảm giá dòng, giảm giá hóa đơn hoặc `voucherCode` thì người gọi cần thêm `orders.discount` (thiếu → 403) | §1: giảm giá, voucher thuộc quyền `orders.discount` |
| 2 | `POST /api/orders` lỗi 409 | ProblemDetails 409 có trường mở rộng `serverTotal` (số) | Như §2.5; ghi rõ kiểu |
| 3 | Thứ tự kiểm tra thanh toán | Trùng `clientRequestId` (trả 200) → chưa mở ca → `heldOrderId` → món, size, topping, tạm hết → voucher → khách → `expectedTotal` (409) → tiền mặt thiếu → hạn mức, token | Lỗi dữ liệu giỏ báo trước lỗi tổng tiền |
| 4 | Giỏ hàng thiếu `sugarLevel`/`iceLevel` | BE điền `100` và `Vua` cho món có tùy chọn, `null` cho món không có (không báo lỗi) | Giống quy ước seed 06 §5.2 |
| 5 | `PUT /api/vouchers/{id}` | Không đổi mã: `code` khác mã hiện có → 400 `errors.code` "Không đổi được mã voucher, tạo voucher mới" | Hóa đơn đã chụp mã voucher |
| 6 | `PUT /api/customers/{id}` | Sửa được cả SĐT (vẫn kiểm tra trùng → 409 `errors.phone`) | `SaveCustomerRequest` có `phone` |
| 7 | `GET /api/shifts/{id}` | Quyền `shifts.view` hoặc `shifts.operate`; ca người khác mà không có `shifts.view` → 403 | Thu ngân xem lại ca của mình, in phiếu chốt ca |
| 8 | `GET /api/shifts` | Không gửi cả `from` lẫn `to` thì lấy 7 ngày gần nhất theo `openedAt`; gửi một trong hai thì chỉ lọc theo cái đó | §2.6 "mặc định 7 ngày" |
| 9 | `GET /api/reports/cancelled-orders` | Lọc theo **ngày hủy** (`cancelledAt`), mới nhất trước | Tab "Hóa đơn hủy" xem theo lúc hủy |
| 10 | Báo cáo khi thiếu `from`/`to` | Thiếu cả hai: 30 ngày tới hôm nay; chỉ có `from`: 30 ngày từ `from`; chỉ có `to`: 30 ngày tới `to` | §4 mặc định 30 ngày |
| 11 | `avgOrderValue` | Làm tròn tới đồng (`Math.Round(…, 0)`); `share`, `revenueChangePercent` 1 chữ số | |
| 12 | `TopItemsReport.share` | Tỉ trọng trên tổng doanh thu mọi món trong bộ lọc, không chỉ `limit` món đầu | |
| 13 | `DashboardReport` | Doanh thu hôm nay gồm mọi hóa đơn đã thanh toán trong ngày (giờ Việt Nam), kể cả hóa đơn mẫu có giờ sau thời điểm xem (seed ghi giờ cố định 06:31–11:45) | Dữ liệu mẫu; dữ liệu thật không có giờ tương lai |
| 14 | `POST /api/toppings` | 201 kèm body `ToppingDto`, không có header `Location` (không có `GET /api/toppings/{id}`) | |
| 15 | Số tiền trong JSON | Postgres trả `numeric(18,2)` nên JSON có thể là `20000.00`; FE đọc như số | |
| 16 | Khóa lỗi trường | Dòng giỏ: `items[i].menuItemId`, `items[i].toppingIds`, `items[i].quantity`, `items[i].discount`; tiền mặt: `payment.cashReceived`; voucher khi thanh toán: `voucherCode`, khi kiểm tra: `code` | §2.5, §2.7 |
| 17 | Seed `KM03` | Đổi hiệu lực từ −90…−61 sang −120…−91 ngày (vẫn "đã hết") | Bản cũ chồng 40 hóa đơn có voucher, BR-05 bỏ voucher nên lượt dùng không khớp 06 §5.4 (`GIAM20K` 35 thay vì 40) |

