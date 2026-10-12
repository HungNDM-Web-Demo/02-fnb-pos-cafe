# Kịch bản demo — POS Quán Cafe

> Dùng khi trình bày cho chủ quán cafe, trà sữa. Thời lượng 12–15 phút. Đi theo một ngày làm việc của quán: mở ca, bán giờ cao điểm, xử lý sự cố, chốt ca, xem báo cáo.

---

## 1. Chuẩn bị trước buổi demo

- [ ] Mở sẵn link demo, thử "Đăng nhập nhanh" cả 3 vai trò
- [ ] Đặt lại dữ liệu demo (thanh công cụ demo → Đặt lại dữ liệu) để có số liệu 90 ngày tính tới hôm nay
- [ ] Đổi tên quán, logo, màu theo thương hiệu khách (Cài đặt → Thương hiệu) nếu đã biết
- [ ] Mở tablet hoặc thu nhỏ trình duyệt về 1280×800 để chiếu màn bán hàng như thật
- [ ] Chuẩn bị điện thoại có app ngân hàng để quét thử mã QR (chỉ để xem, không chuyển tiền)
- [ ] Ghi nhớ voucher mẫu `GIAM20K` và khung giờ khuyến mãi đang chạy trong dữ liệu mẫu

| Link | Ghi chú |
| :--- | :--- |
| FE | `http://localhost:3102` hoặc link online |
| Swagger | `https://localhost:7102/swagger` (khi khách hỏi về tích hợp) |

| Tài khoản | Vai trò | Dùng để cho xem |
| :--- | :--- | :--- |
| `admin` | Quản trị viên | Phân quyền, thương hiệu |
| `quanly` | Quản lý quán | Tổng quan, thực đơn, khuyến mãi, kiểm tra ca, báo cáo |
| `thungan` | Thu ngân | Mở ca, bán hàng, thanh toán, chốt ca |

Mật khẩu: giá trị `DEMO_PASSWORD` trong `.env`, hoặc bấm "Đăng nhập nhanh".

---

## 2. Câu chuyện demo

> Mở đầu: "Anh/chị hình dung sáng nay quán mình mở cửa. Em đi đúng một ngày làm việc của quán để anh/chị thấy phần mềm giúp gì."

| # | Vai trò | Thao tác | Điểm cần nhấn mạnh |
| :---: | :--- | :--- | :--- |
| 1 | Quản lý | Đăng nhập, mở Tổng quan | Vừa mở máy là thấy doanh thu hôm nay, so với hôm qua, giờ nào đông, món nào bán chạy |
| 2 | Thu ngân | Đổi vai trò sang Thu ngân trên thanh công cụ demo; vào Bán hàng, hệ thống bắt mở ca, nhập tiền đầu ca 1.000.000 ₫ | Không mở ca thì không bán được, cuối ngày mới đối soát được |
| 3 | Thu ngân | Bán 1 trà sữa size L, thêm trân châu và thạch, 50% đường, ít đá; 1 cà phê sữa đá size M mang đi | Chạm vài lần là xong một đơn có đủ size, topping, đường, đá; giá tự cộng, không nhầm |
| 4 | Thu ngân | Thanh toán tiền mặt, bấm nút 200.000 ₫, xem tiền thối, in bill | Tiền thối tự tính, bill in ra rõ từng tùy chọn để pha chế làm đúng |
| 5 | Thu ngân | Đơn thứ hai: khách đưa voucher `GIAM20K`, thanh toán chuyển khoản bằng QR | Voucher kiểm tra hạn, lượt tự động; QR có sẵn số tiền, khách không gõ sai |
| 6 | Thu ngân | Hết trân châu: nhấn giữ topping, báo tạm hết; mở món khác thấy trân châu mờ | Báo hết một chạm, cả quầy biết ngay, không nhận nhầm order |
| 7 | Thu ngân | Khách quen xin giảm 20%: hệ thống đòi quản lý xác nhận; đăng nhập quản lý ngay trên hộp thoại | Thu ngân không tự giảm quá 10%, mọi khoản giảm đều có tên người duyệt |
| 8 | Thu ngân | Đang bán thì có khách gọi thêm: giữ đơn, bán khách khác, mở lại đơn giữ | Giờ cao điểm không phải xóa đơn làm lại |
| 9 | Thu ngân | Chốt ca: nhập tiền đếm thực tế thiếu 70.000 ₫ | Hệ thống tự tính tiền phải có, lệch quá 50.000 ₫ tự gắn cờ đỏ |
| 10 | Quản lý | Đổi sang Quản lý, mở Danh sách ca, xem ca vừa chốt, ghi chú xử lý | Chủ quán biết ca nào lệch, ai lệch, mà không cần ngồi quán |
| 11 | Quản lý | Mở Báo cáo: doanh thu 30 ngày, món bán chạy, bảng nhiệt khung giờ | Biết giờ nào cần thêm người, món nào nên đẩy, món nào nên bỏ |
| 12 | Quản trị viên | Đổi sang Quản trị viên, bỏ quyền "Xem báo cáo" của một vai trò; đổi màu thương hiệu | Phân quyền tới từng nút; giao diện mang thương hiệu của quán |

> Kết: "Toàn bộ dữ liệu anh/chị vừa thấy là dữ liệu mẫu. Bản triển khai thật sẽ nhập thực đơn của quán mình, in ra máy in bill của quán."

---

## 3. Câu hỏi khách hay hỏi

| Câu hỏi | Trả lời gợi ý |
| :--- | :--- |
| Có in được ra máy in bill nhiệt không? | Có. Demo in qua trình duyệt khổ 80 mm; bản triển khai kết nối trực tiếp máy in bill và in phiếu pha chế riêng cho quầy bar. |
| Có quản lý nhiều chi nhánh không? | Bản triển khai có: mỗi chi nhánh dữ liệu riêng, chủ quán xem gộp. Demo đang chạy một chi nhánh. |
| Mất mạng có bán được không? | Bản demo cần mạng. Bản triển khai có thể làm chế độ bán offline rồi đồng bộ khi có mạng, cần khảo sát thêm. |
| Có trừ kho nguyên liệu theo công thức không? | Demo chưa có. Có sẵn demo Quản lý kho riêng; bản triển khai có thể nối định lượng từng món để trừ kho tự động. |
| Có kết nối GrabFood, ShopeeFood không? | Có thể tích hợp nhận đơn về chung màn bán hàng, cần khảo sát API của từng nền tảng. |
| Có xuất hóa đơn điện tử không? | Có thể kết nối nhà cung cấp hóa đơn điện tử khách đang dùng. Demo chưa kết nối. |
| QR có tự xác nhận tiền đã về không? | Demo để thu ngân bấm xác nhận. Bản triển khai có thể nối với ngân hàng để tự xác nhận. |
| Nhân viên có xem được doanh thu không? | Không, trừ khi được cấp quyền. Thu ngân chỉ thấy hóa đơn trong ca của mình. |

---

## 4. Sau buổi demo

- [ ] Ghi lại yêu cầu khách nêu thêm vào `01-TONG-QUAN-NGHIEP-VU.md`
- [ ] Ghi lại số chi nhánh, số quầy, loại máy in khách đang dùng
- [ ] Gửi link demo và tài khoản `thungan`, `quanly` cho khách tự trải nghiệm (nếu đồng ý)
