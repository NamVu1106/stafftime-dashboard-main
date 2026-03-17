# BÁO CÁO CÁC HẠNG MỤC ĐÃ LÀM - PHÂN HỆ NHÂN SỰ

## 1) Kết quả đã hoàn thành trên hệ thống

Các màn hình/báo cáo dưới đây đã làm xong theo yêu cầu: hiển thị đúng form Excel mẫu và để template trống (không hiện dữ liệu mẫu).

1. `workforce-summary` - Tổng hợp nhân lực  
   - File mẫu: `근태 현황 보고서_Rev.3 260209 mẫu.xlsx`  
   - Đã làm 2 sheet theo mẫu, giữ layout và xóa dữ liệu thân bảng.

2. `attendance-rate` - Tỷ lệ đi làm  
   - File mẫu: `TI LE DI LAM 01.2026.xlsx`  
   - Đã giữ định dạng hiển thị phần trăm đúng kiểu Excel (không còn lỗi số thập phân).

3. `temp-timesheet` - Công thời vụ  
   - File mẫu: `Bang chôt cong TV mẫu.xlsx`  
   - Đã dựng theo mẫu và để template trống.

4. `official-timesheet` - Công chính thức  
   - File mẫu: `Chốt công chính thức mẫu.xlsx`  
   - Đã dựng theo mẫu và để template trống.

5. `attendance-count` - Số lượng đi làm  
   - File mẫu: `BC SO LUONG DI LAM 012026 - mẫu.xlsx`  
   - Đã xóa dữ liệu và xóa các cột ngày tháng phát sinh trong phần dữ liệu.

6. `weekly-one-day-workers` - Số lượng làm 1 công/tuần  
   - File mẫu: `BC so luong lam 1 cong trong tuan.xlsx`  
   - Đã để template trống, xóa phần ngày/tháng trong tiêu đề tuần theo yêu cầu.

7. `labor-rate` - Tỷ lệ nhân lực  
   - File mẫu: `BC ti le CC nhan luc .xlsx`  
   - Đã chuyển từ dạng tính số sang template trống, xóa toàn bộ số trong vùng dữ liệu.

8. `daily-wage` - Tiền công  
   - File mẫu: `Báo cáo tiền công hàng ngày T1.02 mẫu.xlsx`  
   - Đã bỏ bảng tổng quan tự tính, chỉ giữ template theo mẫu.

9. `bhxh-list` - Danh sách tham gia BHXH  
   - File mẫu: `DANH SÁCH Tham gia BHXH MẪU..xlsx`  
   - Đã bỏ phần tổng quan tự tính, giữ đúng form danh sách và để trống dữ liệu.

10. `insurance-master` - Bảo hiểm  
    - File mẫu: `file mẫu bảo hiểm.xlsx`  
    - Đã map theo mẫu và chuẩn hóa hiển thị dạng template trống.

## 2) Công việc kỹ thuật đã thực hiện ở code

- Đã cập nhật backend `backend/src/controllers/hrTemplates.ts` để đọc trực tiếp template Excel cho từng báo cáo HR.
- Đã thêm logic blank dữ liệu theo từng biểu mẫu (chỉ giữ khung, tiêu đề, merge, style).
- Đã xử lý chọn sheet động theo file mẫu (kể cả file có nhiều sheet).
- Đã cập nhật frontend để ẩn các card không cần thiết với báo cáo dùng template built-in, tránh hiện thông tin gây nhiễu.

## 3) Trạng thái bàn giao hiện tại

- Các báo cáo HR nêu trên đã chạy theo hướng template trống.
- Dùng được để demo giao diện biểu mẫu và sẵn sàng cho bước nối dữ liệu chấm công thật.
- Các chỉnh sửa phản hồi theo ảnh thực tế đã được áp dụng trong từng vòng kiểm tra.

## 4) Nội dung chưa triển khai trong phạm vi này

- Chưa triển khai bộ KPI có công thức nghiệp vụ chi tiết (mới ở mức dàn ý).
- Chưa chốt tài liệu mapping file data đầu vào chuẩn cho tất cả báo cáo.
- Chưa bật lại cơ chế tự tính số liệu production (đang ưu tiên đúng form template trống theo yêu cầu demo).
