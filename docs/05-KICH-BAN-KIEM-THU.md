# Kịch bản kiểm thử nghiệm thu — POS Quán Cafe

> Test case theo use case trong `03-USE-CASE.md`. Phần nền (đăng nhập, phân quyền, đặt lại dữ liệu) dùng TC-SYS-01 đến TC-SYS-10 trong `ZDOCS/03-KIEN-TRUC/USE-CASE-NEN.md` §8.

---

## 1. Cách chạy

| Mục | Nội dung |
| :--- | :--- |
| Môi trường | Chạy cả hai chế độ: dữ liệu mẫu (`mock`) và BE thật (`api`) |
| Dữ liệu | Đặt lại dữ liệu demo trước mỗi lượt test |
| Tài khoản | Theo cột "Vai trò" của từng test case, dùng "Đăng nhập nhanh" |
| Thiết bị | Test case vai trò Thu ngân chạy ở cửa sổ 1280×800 |
| Đạt | Kết quả thực tế khớp toàn bộ cột "Kết quả mong đợi" |

Dữ liệu mẫu dùng trong test: món "Trà sữa trân châu" (size M 35.000 ₫, size L 42.000 ₫), topping "Trân châu" 5.000 ₫, "Thạch dừa" 7.000 ₫; voucher `GIAM20K` (giảm 20.000 ₫, đơn tối thiểu 60.000 ₫, còn lượt); voucher `HETHAN` (đã hết hạn).

---

## 2. Test case

### 2.1. Thực đơn

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-01 | UC-01 | Thêm món mới có 2 size và topping | Quản lý | 1. Thực đơn → Thêm món 2. Nhập mã `M099`, tên "Trà đào cam sả", danh mục Trà trái cây, size M 39.000 ₫, size L 45.000 ₫, chọn topping Thạch dừa 3. Lưu 4. Đổi sang Thu ngân, mở Bán hàng | Món xuất hiện ở danh mục Trà trái cây, giá thấp nhất 39.000 ₫; hộp tùy chọn có 2 size và Thạch dừa |
| TC-02 | UC-01 | Thêm món trùng mã | Quản lý | 1. Thêm món với mã `M001` đã có 2. Lưu | Báo lỗi tại ô mã, không lưu |
| TC-03 | UC-01 | Xóa món đã từng bán | Quản lý | 1. Chọn "Trà sữa trân châu" 2. Bấm Xóa | Hệ thống từ chối, gợi ý dùng "Ẩn" |
| TC-04 | UC-02 | Báo topping tạm hết | Thu ngân | 1. Mở hộp tùy chọn "Trà sữa trân châu" 2. Đánh dấu "Trân châu" tạm hết 3. Mở một món khác có Trân châu | Trân châu mờ, nhãn "Tạm hết", không chọn được ở mọi món |
| TC-05 | UC-02 | Mở lại đơn giữ có món vừa tạm hết | Thu ngân | 1. Tạo đơn có "Bạc xỉu", giữ đơn 2. Báo "Bạc xỉu" tạm hết 3. Mở lại đơn giữ | Dòng "Bạc xỉu" có cảnh báo; không thanh toán được cho tới khi xóa dòng hoặc bán lại món |

### 2.2. Ca làm

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-06 | UC-03 | Mở ca | Thu ngân | 1. Vào Bán hàng khi chưa có ca 2. Nhập tiền đầu ca 1.000.000 ₫ 3. Mở ca | Ca mới mã `CA{yyMMdd}{nn}` trạng thái Đang mở; màn bán hàng dùng được |
| TC-07 | UC-03 | Bán khi chưa mở ca | Thu ngân | 1. Vào Bán hàng khi chưa có ca 2. Đóng hộp Mở ca | Lưới món bị khóa, chỉ còn nút "Mở ca" |
| TC-08 | UC-10 | Chốt ca khớp tiền | Thu ngân | 1. Mở ca 1.000.000 ₫ 2. Bán 2 hóa đơn tiền mặt tổng 120.000 ₫, 1 hóa đơn chuyển khoản 45.000 ₫ 3. Chốt ca, nhập tiền đếm 1.120.000 ₫ | Tổng hợp: 3 hóa đơn, tiền mặt 120.000 ₫, chuyển khoản 45.000 ₫, tiền mặt lý thuyết 1.120.000 ₫, chênh lệch 0 ₫; ca "Đã chốt" |
| TC-09 | UC-10 | Chốt ca lệch quá 50.000 ₫ | Thu ngân | 1. Như TC-08 nhưng nhập tiền đếm 1.050.000 ₫ 2. Bấm xác nhận không ghi chú 3. Nhập ghi chú, xác nhận | Bước 2 bị chặn, yêu cầu ghi chú; sau bước 3 ca "Cần kiểm tra", chênh lệch −70.000 ₫ màu đỏ |
| TC-10 | UC-10 | Chốt ca còn đơn giữ | Thu ngân | 1. Giữ 1 đơn 2. Bấm Chốt ca | Hệ thống liệt kê đơn giữ, yêu cầu xử lý trước khi chốt |
| TC-11 | UC-11 | Quản lý xử lý ca lệch | Quản lý | 1. Sau TC-09, mở Danh sách ca 2. Lọc "Cần kiểm tra" 3. Mở ca, nhập ghi chú, bấm "Đã kiểm tra" | Ca vừa chốt có nhãn đỏ; sau bước 3 chuyển "Đã kiểm tra", ghi chú lưu lại |
| TC-12 | UC-11 | Thu ngân xem danh sách ca | Thu ngân | 1. Gõ thẳng URL `/shifts` | Chuyển tới `/forbidden` |

### 2.3. Bán hàng và giảm giá

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-13 | UC-04 | Tính tiền món có size và topping | Thu ngân | 1. Chọn "Trà sữa trân châu" size L, thêm Trân châu, Thạch dừa, số lượng 2 2. Thêm vào đơn | Dòng thành tiền (42.000 + 5.000 + 7.000) × 2 = 108.000 ₫ |
| TC-14 | UC-04 | Gộp dòng giống nhau | Thu ngân | 1. Thêm "Cà phê sữa đá" M, 50% đường 2. Thêm lại đúng tùy chọn đó | Giỏ có 1 dòng số lượng 2, không tạo dòng mới |
| TC-15 | UC-04 | Chọn tại chỗ không nhập thẻ bàn | Thu ngân | 1. Tạo đơn 2. Chọn "Tại chỗ", để trống số thẻ | Nút Thanh toán khóa, ô số thẻ bàn báo đỏ |
| TC-16 | UC-06 | Giảm giá trong hạn mức | Thu ngân | 1. Đơn tổng 108.000 ₫ 2. Giảm hóa đơn 10%, lý do Khách quen | Giảm 10.000 ₫ (10.800 làm tròn xuống), tổng 98.000 ₫, không cần xác nhận |
| TC-17 | UC-06 | Giảm giá vượt hạn mức | Thu ngân, Quản lý | 1. Đơn 108.000 ₫ 2. Giảm 20% 3. Hộp xác nhận hiện, nhập tài khoản `quanly` | Giảm 21.000 ₫, tổng 87.000 ₫; hóa đơn ghi người duyệt "quanly" |
| TC-18 | UC-06 | Xác nhận bằng tài khoản không đủ quyền | Thu ngân | 1. Như TC-17, bước 3 nhập tài khoản `thungan` | Từ chối, đơn giữ nguyên giá |
| TC-19 | UC-06 | Voucher hợp lệ | Thu ngân | 1. Đơn 108.000 ₫ 2. Nhập `GIAM20K` | Giảm 20.000 ₫, tổng 88.000 ₫, hiện tên voucher |
| TC-20 | UC-06 | Voucher hết hạn hoặc chưa đủ đơn tối thiểu | Thu ngân | 1. Nhập `HETHAN` 2. Đơn 42.000 ₫, nhập `GIAM20K` | Bước 1 báo "Voucher đã hết hạn"; bước 2 báo "Đơn tối thiểu 60.000 ₫" |

### 2.4. Thanh toán

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-21 | UC-07 | Thanh toán tiền mặt | Thu ngân | 1. Đơn 88.000 ₫ 2. Thanh toán → Tiền mặt → bấm 100.000 ₫ 3. Hoàn tất | Tiền thối 12.000 ₫; hóa đơn mã `HD{yyMMdd}{nnnn}`; bản in có đủ món, tùy chọn, giảm giá, tiền khách đưa, tiền thối; giỏ trống |
| TC-22 | UC-07 | Tiền khách đưa không đủ | Thu ngân | 1. Đơn 88.000 ₫ 2. Nhập tiền khách đưa 50.000 ₫ | Nút Hoàn tất khóa, hiện "Còn thiếu 38.000 ₫" |
| TC-23 | UC-07 | Thanh toán chuyển khoản | Thu ngân | 1. Đơn 45.000 ₫ 2. Chọn Chuyển khoản 3. Bấm "Đã nhận tiền" | QR hiện số tiền 45.000 ₫, nội dung là mã hóa đơn; hóa đơn lưu phương thức Chuyển khoản |
| TC-24 | UC-07 | Bấm Hoàn tất hai lần liên tiếp (chế độ `api`) | Thu ngân | 1. Bấm Hoàn tất hai lần thật nhanh | Chỉ một hóa đơn được tạo |
| TC-25 | UC-08 | Hủy hóa đơn trong ca | Quản lý | 1. Hủy hóa đơn tiền mặt 88.000 ₫ vừa bán, lý do "Nhập nhầm" 2. Đổi sang Thu ngân, chốt ca | Hóa đơn "Đã hủy"; tiền mặt lý thuyết của ca giảm 88.000 ₫; voucher `GIAM20K` được trả lượt |

### 2.5. Tổng quan và báo cáo

| Mã | UC | Tình huống | Vai trò | Các bước | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-26 | UC-12 | Tổng quan cập nhật theo hóa đơn mới | Quản lý | 1. Ghi lại doanh thu hôm nay 2. Đổi sang Thu ngân bán một hóa đơn 50.000 ₫ 3. Quay lại Tổng quan | Doanh thu tăng đúng 50.000 ₫, số hóa đơn tăng 1 |
| TC-27 | UC-12 | Thu ngân không thấy Tổng quan doanh thu | Thu ngân | 1. Đăng nhập nhanh vai trò Thu ngân | Không có thẻ doanh thu; vào thẳng màn Bán hàng |
| TC-28 | UC-14 | Báo cáo doanh thu 30 ngày | Quản lý | 1. Mở Báo cáo, chọn 30 ngày | Biểu đồ đủ 30 điểm, có đường kỳ trước; tổng bảng khớp tổng biểu đồ |
| TC-29 | UC-14 | Hóa đơn hủy không tính doanh thu | Quản lý | 1. Sau TC-25, xem báo cáo hôm nay | Doanh thu không gồm hóa đơn đã hủy; hóa đơn đó có trong tab Hóa đơn hủy |
| TC-30 | UC-14 | Khoảng ngày quá dài | Quản lý | 1. Chọn Tùy chọn từ 01/01/2024 tới hôm nay | Báo lỗi khoảng tối đa 366 ngày |

---

## 3. Biên bản chạy thử

| Ngày | Người test | Chế độ | Số TC đạt / tổng | Lỗi ghi nhận |
| :--- | :--- | :--- | :---: | :--- |
| | | | | |
