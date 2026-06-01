-- Tin học hóa kiểm tra an ninh — schema tham chiếu (tự tạo qua ensureSecurityInspectionSchema khi backend khởi động)
-- Department > Category > Item | Asset (QR) | Inspection + Results

/*
  sec_departments
  sec_categories (department_id)
  sec_check_items (category_id)
  sec_assets (department_id, qr_code UNIQUE)
  sec_inspections (client_id, status draft|submitted)
  sec_inspection_results
*/
