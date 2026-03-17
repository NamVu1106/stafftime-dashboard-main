# Hệ thống Chấm công Nhân sự — Trình bày Dashboard

*Nội dung dùng để tạo file PowerPoint gửi sếp. Mỗi phần "---" hoặc tiêu đề cấp 2 (##) có thể là 1 slide.*

---

## Slide 1: Bìa

**HỆ THỐNG QUẢN LÝ CHẤM CÔNG NHÂN SỰ**  
**StaffTime Dashboard**

- Giới thiệu tổng quan & định hướng redesign
- [Ngày / Phòng ban nếu cần]

---

## Slide 2: Mục đích buổi trình bày

- Giới thiệu **dashboard hiện tại** (tính năng, màn hình chính).
- Lấy ý kiến sếp để **thiết kế lại trang dashboard** cho sát nhu cầu sử dụng.
- Thống nhất hướng phát triển tiếp (đồng bộ dữ liệu chấm công lên HR, báo cáo, v.v.).

---

## Slide 3: Dashboard là gì?

**Dashboard** = Màn hình tổng quan hiển thị:

- Số liệu chấm công theo **thời gian** (hôm nay, tháng này, năm này).
- **Tỷ lệ đi làm**, số nhân viên đi làm, đi trễ, tổng giờ làm.
- Biểu đồ và bảng tóm tắt để **xem nhanh** tình hình, **ra quyết định** (phòng ban, ca, loại hợp đồng…).

---

## Slide 4: Cấu trúc hệ thống hiện tại (menu chính)

| Nhóm | Nội dung |
|------|----------|
| **Trang chủ / Tổng quan** | Dashboard chính, Real-time |
| **Nhân viên** | Danh sách, Thêm mới |
| **Báo cáo** | Theo ngày / tháng / năm / giai đoạn, So sánh, Công nhân thời vụ 1 ngày |
| **Nhân sự (HR)** | Tỉ lệ đi làm, Số lượng đi làm, Chốt công TV/CT, Tiền công, BHXH, Lương/Thuế, Thuốc, Phòng y tế, Truy thu… |
| **Phòng ban** | Thống kê theo phòng ban |
| **Upload Data** | Upload Excel nhân viên, chấm công |
| **Lịch sử** | Dữ liệu chấm công đã lưu trữ (archive) |

---

## Slide 5: Trang Tổng quan (Dashboard) — Nội dung hiện tại

- **Bộ lọc thời gian:** Hôm nay / Tháng này / Năm này / 1 ngày / Giai đoạn.
- **3 cột tóm tắt:** Hôm nay | Tháng này | Năm này (tổng NV, đi làm, tỷ lệ %, tổng giờ).
- **Thẻ chỉ số:** Tổng nhân viên, tỷ lệ đi làm Chính thức/Thời vụ, nhân viên đi trễ, tổng giờ làm.
- **Thẻ HR (Excel):** Tỉ lệ đi làm, công TV/CT, BHXH, thuế, tiền công… (khi đã upload file HR).
- **Phân bổ:** Nam/Nữ – Chính thức/Thời vụ.
- **Biểu đồ:** Tỷ lệ Chính thức–Thời vụ, Nam–Nữ, theo lứa tuổi, tỷ lệ đi làm theo phòng ban, 7 ngày gần nhất.
- **Bảng:** Hoạt động chấm công gần đây.

---

## Slide 6: Luồng dữ liệu hiện tại

1. **Upload file chấm công** (Excel) → Lưu vào hệ thống (bảng chấm công).
2. **Upload file nhân viên** (Excel) → Cập nhật danh sách nhân viên.
3. Dashboard & Báo cáo **đọc từ dữ liệu đã upload** → Tính tỷ lệ, giờ, đi trễ…
4. **Trang HR** (Tỉ lệ đi làm, Số lượng đi làm…) hiện tại: upload **file Excel riêng** của từng biểu mẫu → Chỉ xem file, chưa tự điền từ dữ liệu chấm công.

---

## Slide 7: Định hướng sếp đề xuất (tóm tắt)

- **Upload 1 file chấm công** → Hệ thống **tự đồng bộ** và **hiển thị số liệu** lên các trang liên quan (ví dụ: Tỉ lệ đi làm, Số lượng đi làm, Chốt công…).
- **Không** phụ thuộc vào file Excel đã điền sẵn; số liệu **sinh ra từ dữ liệu chấm công** trong hệ thống.
- Đang chờ **mẫu biểu Excel** từ Nhân sự để map đúng format → Sau đó triển khai đồng bộ và redesign dashboard nếu cần.

---

## Slide 8: Các trang có thể đồng bộ từ chấm công (đề xuất kỹ thuật)

| Trang HR | Đồng bộ từ chấm công |
|----------|----------------------|
| Tỉ lệ đi làm (Excel) | Có thể tính từ chấm công (theo ngày/tuần/tháng, bộ phận). |
| Số lượng đi làm (Excel) | Có thể tạo bảng từ mã NV, ngày, có đi làm. |
| TV làm 1 công/tuần | Có thể tính từ chấm công (NV thời vụ, đi 1 ngày/tuần). |
| Chốt công thời vụ / Chính thức | Có thể sinh bảng công từ chấm công (theo ngày, giờ). |
| Tiền công hàng ngày | Phần công/giờ từ chấm công; phần tiền có thể từ master khác. |
| Tỉ lệ nhân lực | Có thể tính từ chấm công + danh sách NV. |

*Lương/Thuế/BHXH, Danh sách BHXH: đồng bộ một phần (công/ngày). Thuốc, Phòng y tế: không liên quan chấm công.*

---

## Slide 9: Bước tiếp theo (sau khi có ý kiến sếp)

1. **Nhận mẫu biểu Excel** từ Nhân sự (Tỉ lệ đi làm, Số lượng đi làm, Chốt công…).
2. **Thiết kế lại trang dashboard** theo góp ý (bố cục, chỉ số ưu tiên, biểu đồ).
3. **Triển khai đồng bộ:** Upload chấm công → Tự điền số liệu lên các trang HR theo đúng mẫu.
4. **Test & bàn giao** với Nhân sự / Sếp.

---

## Slide 10: Kết & Cảm ơn

- Tóm tắt: Dashboard hiện tại đã có đầy đủ tổng quan, báo cáo, HR, upload; định hướng là **tự đồng bộ từ file chấm công** và **redesign** theo ý sếp.
- Rất mong nhận **ý kiến và mẫu biểu** để triển khai đúng nhu cầu.

**Cảm ơn sếp đã xem và góp ý.**

---

*File này nằm trong thư mục `docs/`. Có thể copy từng phần vào PowerPoint (mỗi ## = 1 slide) hoặc dùng add-in/công cụ chuyển Markdown → PPT.*
