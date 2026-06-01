# Checksheet Tablet — 4 trụ cột nghiệp vụ

## 1. Mục tiêu cốt lõi

| Trụ | Triển khai trong app |
|-----|----------------------|
| Số hóa | SQL Server + đồng bộ offline (IndexedDB) |
| Minh bạch | NOT OK → ảnh watermark + ghi chú bắt buộc |
| Giám sát | Dashboard Admin 4 tab (Tiến độ / Cảnh báo / Lịch sử / Tổng hợp) |
| Chuẩn hóa | Template checklist theo bộ phận |

## 2. Luồng vận hành (Tablet)

1. Đăng nhập → Chọn bộ phận (`/security`)
2. Quét QR (`/security/scan/:deptId`)
3. Tick OK / NOT OK + minh chứng (`/security/checklist`)
4. Ký tên + Gửi (đám mây xanh khi online)

## 3. Dashboard Admin

- **Tiến độ:** % theo bộ phận và tổng xưởng
- **Cảnh báo:** NOT OK chưa bấm *Đã xử lý*
- **Lịch sử:** Gallery ảnh + ghi chú
- **Tổng hợp:** Biểu đồ + Excel

## 4. Phản hồi (Feedback loop)

API: `POST /api/security-inspection/reports/results/:id/resolve`

Cột DB: `sec_inspection_results.resolved_at`, `resolved_by`

**Đã xử lý:** chỉ khi có ảnh minh chứng tại hiện trường.

## 5. Self-service checklist

- Màn: `/security/admin/checklist-editor`
- Mẫu JSON: `docs/checklist-editor-schema.json`
- Ảnh NOT OK: tối thiểu ~50KB, ưu tiên camera sau
