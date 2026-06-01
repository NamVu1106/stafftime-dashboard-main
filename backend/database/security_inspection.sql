-- Tin học hóa kiểm tra an ninh — schema tham chiếu
-- Tự áp dụng khi backend khởi động: ensureSecurityInspectionSchema()

-- ========== CẤU TRÚC CHECKLIST (self-service qua Checklist Editor) ==========

-- sec_departments (id, code, name, color, sort_order, is_active)
-- sec_categories (id, department_id, name, sort_order)
-- sec_check_items:
--   id              -- PK (đề xuất: item_id)
--   category_id
--   label           -- đề xuất: item_label
--   input_type      -- 'boolean' | 'number'
--   min_value, max_value, unit
--   requires_photo_on_fail  -- NOT OK bắt buộc ảnh
--   sort_order      -- đề xuất: display_order

-- ========== TÀI SẢN & QR ==========

-- sec_assets (id, department_id, qr_code UNIQUE, name, asset_type, is_active)
-- sec_asset_qr_history (đổi QR)

-- ========== KẾT QUẢ KIỂM TRA ==========

-- sec_inspections:
--   id, client_id (idempotent offline), department_id, asset_id,
--   inspector_username, shift_label, status ('draft'|'submitted'),
--   signature_data, notes, created_at, updated_at, submitted_at

-- sec_inspection_results:
--   id              -- PK (đề xuất: result_id)
--   inspection_id   -- FK (asset_id lấy qua inspection)
--   item_id         -- FK sec_check_items.id
--   status          -- 'pass'|'fail'|'skip'  (UI: OK / NOT OK / N/A)
--   numeric_value, note, photo_url
--   resolved_at, resolved_by  -- đóng cảnh báo (feedback loop)

-- ========== PHÂN QUYỀN ==========

-- sec_user_departments (user_id, department_id) — manager theo bộ phận

-- ========== TRUY VẤN THAM KHẢO ==========

/*
-- Template checklist bộ phận (giống API GET /departments/:id/template):
SELECT c.name AS category, i.id, i.label, i.input_type, i.min_value, i.max_value, i.unit, i.sort_order
FROM dbo.sec_check_items i
INNER JOIN dbo.sec_categories c ON c.id = i.category_id
WHERE c.department_id = @deptId
ORDER BY c.sort_order, i.sort_order;
*/
