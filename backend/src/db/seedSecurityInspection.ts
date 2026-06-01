import { queryOne, exec } from './sqlServer';

/** Dữ liệu mẫu: Department > Category > Item + tài sản QR */
export async function seedSecurityInspectionIfEmpty(): Promise<void> {
  const row = await queryOne<{ n: number }>(
    'SELECT COUNT(1) AS n FROM dbo.sec_departments'
  );
  if (row && row.n > 0) return;

  await exec(`
INSERT INTO dbo.sec_departments (code, name, color, sort_order, is_active) VALUES
('AN', N'An ninh vật lý', '#2563eb', 1, 1),
('BV', N'Bảo vệ cổng', '#16a34a', 2, 1),
('PCCN', N'PCCN / PCCC', '#ea580c', 3, 1),
('SX', N'Xưởng sản xuất', '#7c3aed', 4, 1);
`);

  const deptAn = await queryOne<{ id: number }>(
    "SELECT id FROM dbo.sec_departments WHERE code = 'AN'"
  );
  const deptBv = await queryOne<{ id: number }>(
    "SELECT id FROM dbo.sec_departments WHERE code = 'BV'"
  );
  if (!deptAn?.id || !deptBv?.id) return;

  await exec(`
INSERT INTO dbo.sec_categories (department_id, name, sort_order) VALUES
(${deptAn.id}, N'Thiết bị an ninh', 1),
(${deptAn.id}, N'Khu vực kiểm soát', 2),
(${deptBv.id}, N'Cổng & nhật ký', 1);
`);

  const cat1 = await queryOne<{ id: number }>(
    `SELECT TOP 1 id FROM dbo.sec_categories WHERE department_id = @dept ORDER BY sort_order`,
    { dept: deptAn.id }
  );
  const cat2 = await queryOne<{ id: number }>(
    `SELECT id FROM dbo.sec_categories WHERE department_id = @dept AND name LIKE N'%Khu vực%'`,
    { dept: deptAn.id }
  );
  const catBv = await queryOne<{ id: number }>(
    `SELECT TOP 1 id FROM dbo.sec_categories WHERE department_id = @dept`,
    { dept: deptBv.id }
  );
  if (!cat1?.id) return;

  await exec(`
INSERT INTO dbo.sec_check_items (category_id, label, requires_photo_on_fail, sort_order, input_type, min_value, max_value, unit) VALUES
(${cat1.id}, N'Camera hoạt động bình thường', 1, 1, N'boolean', NULL, NULL, NULL),
(${cat1.id}, N'Đèn báo động / còi', 1, 2, N'boolean', NULL, NULL, NULL),
(${cat1.id}, N'Tủ điện khóa an toàn', 1, 3, N'boolean', NULL, NULL, NULL),
(${cat1.id}, N'Nhiệt độ bề mặt tủ điện', 1, 4, N'number', 0, 80, N'°C'),
(${cat1.id}, N'Áp suất khí nén (đường ống)', 1, 5, N'number', 0.5, 8, N'bar');
`);

  if (cat2?.id) {
    await exec(`
INSERT INTO dbo.sec_check_items (category_id, label, requires_photo_on_fail, sort_order) VALUES
(${cat2.id}, N'Rào chắn / cửa thoát hiểm', 1, 1),
(${cat2.id}, N'Biển báo an toàn đầy đủ', 1, 2);
`);
  }
  if (catBv?.id) {
    await exec(`
INSERT INTO dbo.sec_check_items (category_id, label, requires_photo_on_fail, sort_order) VALUES
(${catBv.id}, N'Sổ nhật ký cổng', 1, 1),
(${catBv.id}, N'Thẻ ra vào khách', 0, 2);
`);
  }

  await exec(`
INSERT INTO dbo.sec_assets (department_id, qr_code, name, asset_type) VALUES
(${deptAn.id}, 'YS-AN-CAM-01', N'Camera khu A1', 'equipment'),
(${deptAn.id}, 'YS-AN-PANEL-02', N'Tủ điện an ninh B2', 'equipment'),
(${deptBv.id}, 'YS-BV-GATE-01', N'Cổng chính', 'equipment'),
(${deptAn.id}, 'YS-AN-GOODS-99', N'Lô hàng kiểm tra #99', 'goods');
`);
}
