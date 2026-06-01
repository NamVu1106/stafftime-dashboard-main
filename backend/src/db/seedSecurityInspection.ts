import { queryOne, exec } from './sqlServer';

/** Dữ liệu mẫu: BoPhan > NhomHangMuc > HangMucKiemTra + ThietBi */
export async function seedSecurityInspectionIfEmpty(): Promise<void> {
  const row = await queryOne<{ n: number }>('SELECT COUNT(1) AS n FROM dbo.BoPhan');
  if (row && row.n > 0) return;

  await exec(`
INSERT INTO dbo.BoPhan (ma_bo_phan, ten_bo_phan, mau_sac, thu_tu, dang_hoat_dong) VALUES
(N'AN', N'An ninh vật lý', N'#2563eb', 1, 1),
(N'BV', N'Bảo vệ cổng', N'#16a34a', 2, 1),
(N'PCCN', N'PCCN / PCCC', N'#ea580c', 3, 1),
(N'SX', N'Xưởng sản xuất', N'#7c3aed', 4, 1);
`);

  const deptAn = await queryOne<{ id: number }>(
    "SELECT id FROM dbo.BoPhan WHERE ma_bo_phan = N'AN'"
  );
  const deptBv = await queryOne<{ id: number }>(
    "SELECT id FROM dbo.BoPhan WHERE ma_bo_phan = N'BV'"
  );
  if (!deptAn?.id || !deptBv?.id) return;

  await exec(`
INSERT INTO dbo.NhomHangMuc (bo_phan_id, ten_nhom, thu_tu) VALUES
(${deptAn.id}, N'Thiết bị an ninh', 1),
(${deptAn.id}, N'Khu vực kiểm soát', 2),
(${deptBv.id}, N'Cổng & nhật ký', 1);
`);

  const cat1 = await queryOne<{ id: number }>(
    `SELECT TOP 1 id FROM dbo.NhomHangMuc WHERE bo_phan_id = @dept ORDER BY thu_tu`,
    { dept: deptAn.id }
  );
  const cat2 = await queryOne<{ id: number }>(
    `SELECT id FROM dbo.NhomHangMuc WHERE bo_phan_id = @dept AND ten_nhom LIKE N'%Khu vực%'`,
    { dept: deptAn.id }
  );
  const catBv = await queryOne<{ id: number }>(
    `SELECT TOP 1 id FROM dbo.NhomHangMuc WHERE bo_phan_id = @dept`,
    { dept: deptBv.id }
  );
  if (!cat1?.id) return;

  await exec(`
INSERT INTO dbo.HangMucKiemTra (nhom_id, noi_dung, kieu_du_lieu, nguong_min, nguong_max, don_vi, bat_buoc, yeu_cau_an_loi, thu_tu) VALUES
(${cat1.id}, N'Camera hoạt động bình thường', N'boolean', NULL, NULL, NULL, 1, 1, 1),
(${cat1.id}, N'Đèn báo động / còi', N'boolean', NULL, NULL, NULL, 1, 1, 2),
(${cat1.id}, N'Tủ điện khóa an toàn', N'boolean', NULL, NULL, NULL, 1, 1, 3),
(${cat1.id}, N'Nhiệt độ bề mặt tủ điện', N'number', 0, 80, N'°C', 1, 1, 4),
(${cat1.id}, N'Áp suất khí nén (đường ống)', N'number', 0.5, 8, N'bar', 1, 1, 5);
`);

  if (cat2?.id) {
    await exec(`
INSERT INTO dbo.HangMucKiemTra (nhom_id, noi_dung, kieu_du_lieu, bat_buoc, yeu_cau_an_loi, thu_tu) VALUES
(${cat2.id}, N'Rào chắn / cửa thoát hiểm', N'boolean', 1, 1, 1),
(${cat2.id}, N'Biển báo an toàn đầy đủ', N'boolean', 1, 1, 2);
`);
  }
  if (catBv?.id) {
    await exec(`
INSERT INTO dbo.HangMucKiemTra (nhom_id, noi_dung, kieu_du_lieu, bat_buoc, yeu_cau_an_loi, thu_tu) VALUES
(${catBv.id}, N'Sổ nhật ký cổng', N'boolean', 1, 1, 1),
(${catBv.id}, N'Thẻ ra vào khách', N'boolean', 1, 0, 2);
`);
  }

  await exec(`
INSERT INTO dbo.ThietBi (bo_phan_id, ma_qr, ten_thiet_bi, loai_thiet_bi) VALUES
(${deptAn.id}, N'YS-AN-CAM-01', N'Camera khu A1', N'equipment'),
(${deptAn.id}, N'YS-AN-PANEL-02', N'Tủ điện an ninh B2', N'equipment'),
(${deptBv.id}, N'YS-BV-GATE-01', N'Cổng chính', N'equipment'),
(${deptAn.id}, N'YS-AN-GOODS-99', N'Lô hàng kiểm tra #99', N'goods');
`);
}
