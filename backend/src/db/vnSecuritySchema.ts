import { exec, queryOne } from './sqlServer';

/** Tạo bảng CSDL tiếng Việt + migrate từ sec_* nếu có */
export async function ensureVnSecuritySchema(): Promise<void> {
  await exec(`
IF OBJECT_ID(N'dbo.BoPhan', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[BoPhan] (
    [id] INT NOT NULL IDENTITY(1,1),
    [ma_bo_phan] NVARCHAR(50) NULL,
    [ten_bo_phan] NVARCHAR(100) NOT NULL,
    [mau_sac] NVARCHAR(50) NOT NULL CONSTRAINT [BoPhan_mau_df] DEFAULT N'#2563eb',
    [thu_tu] INT NOT NULL CONSTRAINT [BoPhan_thu_tu_df] DEFAULT 0,
    [dang_hoat_dong] BIT NOT NULL CONSTRAINT [BoPhan_hoat_dong_df] DEFAULT 1,
    CONSTRAINT [BoPhan_pkey] PRIMARY KEY CLUSTERED ([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.NhomHangMuc', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[NhomHangMuc] (
    [id] INT NOT NULL IDENTITY(1,1),
    [bo_phan_id] INT NOT NULL,
    [ten_nhom] NVARCHAR(200) NOT NULL,
    [thu_tu] INT NOT NULL CONSTRAINT [NhomHangMuc_thu_tu_df] DEFAULT 0,
    CONSTRAINT [NhomHangMuc_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [NhomHangMuc_bo_phan_fk] FOREIGN KEY ([bo_phan_id]) REFERENCES [dbo].[BoPhan]([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.HangMucKiemTra', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[HangMucKiemTra] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nhom_id] INT NOT NULL,
    [noi_dung] NVARCHAR(500) NOT NULL,
    [kieu_du_lieu] NVARCHAR(20) NOT NULL CONSTRAINT [HangMuc_kieu_df] DEFAULT N'boolean',
    [nguong_min] FLOAT NULL,
    [nguong_max] FLOAT NULL,
    [don_vi] NVARCHAR(20) NULL,
    [bat_buoc] BIT NOT NULL CONSTRAINT [HangMuc_bat_buoc_df] DEFAULT 1,
    [yeu_cau_an_loi] BIT NOT NULL CONSTRAINT [HangMuc_an_loi_df] DEFAULT 1,
    [thu_tu] INT NOT NULL CONSTRAINT [HangMuc_thu_tu_df] DEFAULT 0,
    CONSTRAINT [HangMuc_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [HangMuc_nhom_fk] FOREIGN KEY ([nhom_id]) REFERENCES [dbo].[NhomHangMuc]([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.ThietBi', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[ThietBi] (
    [id] INT NOT NULL IDENTITY(1,1),
    [bo_phan_id] INT NOT NULL,
    [ma_qr] NVARCHAR(200) NOT NULL,
    [ten_thiet_bi] NVARCHAR(500) NOT NULL,
    [loai_thiet_bi] NVARCHAR(50) NOT NULL CONSTRAINT [ThietBi_loai_df] DEFAULT N'equipment',
    [dang_hoat_dong] BIT NOT NULL CONSTRAINT [ThietBi_hoat_dong_df] DEFAULT 1,
    CONSTRAINT [ThietBi_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ThietBi_qr_uk] UNIQUE NONCLUSTERED ([ma_qr]),
    CONSTRAINT [ThietBi_bo_phan_fk] FOREIGN KEY ([bo_phan_id]) REFERENCES [dbo].[BoPhan]([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.PhienKiemTra', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[PhienKiemTra] (
    [id] INT NOT NULL IDENTITY(1,1),
    [client_id] NVARCHAR(100) NULL,
    [bo_phan_id] INT NOT NULL,
    [thiet_bi_id] INT NOT NULL,
    [nguoi_kiem_tra] NVARCHAR(200) NULL,
    [ca_truc] NVARCHAR(200) NULL,
    [trang_thai_phien] NVARCHAR(50) NOT NULL CONSTRAINT [Phien_trang_thai_df] DEFAULT N'nhap',
    [chu_ky] NVARCHAR(MAX) NULL,
    [ghi_chu_phien] NVARCHAR(MAX) NULL,
    [tao_luc] NVARCHAR(50) NOT NULL,
    [cap_nhat_luc] NVARCHAR(50) NOT NULL,
    [gui_luc] NVARCHAR(50) NULL,
    CONSTRAINT [Phien_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Phien_bo_phan_fk] FOREIGN KEY ([bo_phan_id]) REFERENCES [dbo].[BoPhan]([id]),
    CONSTRAINT [Phien_thiet_bi_fk] FOREIGN KEY ([thiet_bi_id]) REFERENCES [dbo].[ThietBi]([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.KetQuaKiemTra', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[KetQuaKiemTra] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [phien_kiem_tra_id] INT NOT NULL,
    [thiet_bi_id] INT NOT NULL,
    [hang_muc_id] INT NOT NULL,
    [thoi_gian_check] DATETIME NOT NULL CONSTRAINT [KetQua_thoi_gian_df] DEFAULT GETDATE(),
    [trang_thai] NVARCHAR(20) NOT NULL,
    [gia_tri_do] FLOAT NULL,
    [url_anh] NVARCHAR(500) NULL,
    [ghi_chu] NVARCHAR(MAX) NULL,
    [thoi_gian_xu_ly] NVARCHAR(50) NULL,
    [nguoi_xu_ly] NVARCHAR(100) NULL,
    CONSTRAINT [KetQua_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [KetQua_phien_fk] FOREIGN KEY ([phien_kiem_tra_id]) REFERENCES [dbo].[PhienKiemTra]([id]),
    CONSTRAINT [KetQua_thiet_bi_fk] FOREIGN KEY ([thiet_bi_id]) REFERENCES [dbo].[ThietBi]([id]),
    CONSTRAINT [KetQua_hang_muc_fk] FOREIGN KEY ([hang_muc_id]) REFERENCES [dbo].[HangMucKiemTra]([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.NguoiDungBoPhan', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[NguoiDungBoPhan] (
    [user_id] INT NOT NULL,
    [bo_phan_id] INT NOT NULL,
    CONSTRAINT [NguoiDungBoPhan_pkey] PRIMARY KEY CLUSTERED ([user_id], [bo_phan_id]),
    CONSTRAINT [NguoiDungBoPhan_bo_phan_fk] FOREIGN KEY ([bo_phan_id]) REFERENCES [dbo].[BoPhan]([id])
  );
END
`);

  await exec(`
IF OBJECT_ID(N'dbo.LichSuMaQrThietBi', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[LichSuMaQrThietBi] (
    [id] INT NOT NULL IDENTITY(1,1),
    [thiet_bi_id] INT NOT NULL,
    [ma_qr_cu] NVARCHAR(200) NOT NULL,
    [ma_qr_moi] NVARCHAR(200) NOT NULL,
    [thoi_diem] NVARCHAR(50) NOT NULL,
    [nguoi_doi] NVARCHAR(200) NULL,
    CONSTRAINT [LichSuQr_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LichSuQr_thiet_bi_fk] FOREIGN KEY ([thiet_bi_id]) REFERENCES [dbo].[ThietBi]([id])
  );
END
`);

  await exec(`
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Phien_client_id_idx' AND object_id = OBJECT_ID(N'dbo.PhienKiemTra'))
  CREATE NONCLUSTERED INDEX [Phien_client_id_idx] ON [dbo].[PhienKiemTra]([client_id]);
`);

  await exec(`
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Phien_bo_phan_trang_thai_idx' AND object_id = OBJECT_ID(N'dbo.PhienKiemTra'))
  CREATE NONCLUSTERED INDEX [Phien_bo_phan_trang_thai_idx] ON [dbo].[PhienKiemTra]([bo_phan_id], [trang_thai_phien]);
`);

  await migrateFromSecTablesIfNeeded();
}

async function migrateFromSecTablesIfNeeded(): Promise<void> {
  const hasVn = await queryOne<{ n: number }>('SELECT COUNT(1) AS n FROM dbo.BoPhan');
  if (hasVn && hasVn.n > 0) return;

  const hasSec = await queryOne<{ n: number }>(
    `SELECT COUNT(1) AS n FROM sys.tables WHERE name = N'sec_departments'`
  );
  if (!hasSec?.n) return;

  await exec(`
SET IDENTITY_INSERT dbo.BoPhan ON;
INSERT INTO dbo.BoPhan (id, ma_bo_phan, ten_bo_phan, mau_sac, thu_tu, dang_hoat_dong)
SELECT id, code, name, color, sort_order, CAST(is_active AS BIT) FROM dbo.sec_departments;
SET IDENTITY_INSERT dbo.BoPhan OFF;
`);

  await exec(`
SET IDENTITY_INSERT dbo.NhomHangMuc ON;
INSERT INTO dbo.NhomHangMuc (id, bo_phan_id, ten_nhom, thu_tu)
SELECT id, department_id, name, sort_order FROM dbo.sec_categories;
SET IDENTITY_INSERT dbo.NhomHangMuc OFF;
`);

  await exec(`
SET IDENTITY_INSERT dbo.HangMucKiemTra ON;
INSERT INTO dbo.HangMucKiemTra (id, nhom_id, noi_dung, kieu_du_lieu, nguong_min, nguong_max, don_vi, bat_buoc, yeu_cau_an_loi, thu_tu)
SELECT id, category_id, label,
  ISNULL(input_type, N'boolean'), min_value, max_value, unit,
  CAST(1 AS BIT), CAST(ISNULL(requires_photo_on_fail, 1) AS BIT), sort_order
FROM dbo.sec_check_items;
SET IDENTITY_INSERT dbo.HangMucKiemTra OFF;
`);

  await exec(`
SET IDENTITY_INSERT dbo.ThietBi ON;
INSERT INTO dbo.ThietBi (id, bo_phan_id, ma_qr, ten_thiet_bi, loai_thiet_bi, dang_hoat_dong)
SELECT id, department_id, qr_code, name, asset_type, CAST(is_active AS BIT) FROM dbo.sec_assets;
SET IDENTITY_INSERT dbo.ThietBi OFF;
`);

  await exec(`
SET IDENTITY_INSERT dbo.PhienKiemTra ON;
INSERT INTO dbo.PhienKiemTra (id, client_id, bo_phan_id, thiet_bi_id, nguoi_kiem_tra, ca_truc, trang_thai_phien, chu_ky, ghi_chu_phien, tao_luc, cap_nhat_luc, gui_luc)
SELECT id, client_id, department_id, asset_id, inspector_username, shift_label,
  CASE WHEN status = N'submitted' THEN N'da_gui' ELSE N'nhap' END,
  signature_data, notes, created_at, updated_at, submitted_at
FROM dbo.sec_inspections;
SET IDENTITY_INSERT dbo.PhienKiemTra OFF;
`);

  await exec(`
SET IDENTITY_INSERT dbo.KetQuaKiemTra ON;
INSERT INTO dbo.KetQuaKiemTra (id, phien_kiem_tra_id, thiet_bi_id, hang_muc_id, thoi_gian_check, trang_thai, gia_tri_do, url_anh, ghi_chu, thoi_gian_xu_ly, nguoi_xu_ly)
SELECT r.id, r.inspection_id, i.asset_id, r.item_id,
  TRY_CAST(i.created_at AS DATETIME),
  CASE r.status WHEN N'fail' THEN N'NOT_OK' WHEN N'skip' THEN N'NA' ELSE N'OK' END,
  r.numeric_value, COALESCE(r.photo_url, NULL), r.note, r.resolved_at, r.resolved_by
FROM dbo.sec_inspection_results r
INNER JOIN dbo.sec_inspections i ON i.id = r.inspection_id;
SET IDENTITY_INSERT dbo.KetQuaKiemTra OFF;
`);

  await exec(`
INSERT INTO dbo.NguoiDungBoPhan (user_id, bo_phan_id)
SELECT user_id, department_id FROM dbo.sec_user_departments
WHERE NOT EXISTS (SELECT 1 FROM dbo.NguoiDungBoPhan n WHERE n.user_id = sec_user_departments.user_id AND n.bo_phan_id = sec_user_departments.department_id);
`);

  await exec(`
SET IDENTITY_INSERT dbo.LichSuMaQrThietBi ON;
INSERT INTO dbo.LichSuMaQrThietBi (id, thiet_bi_id, ma_qr_cu, ma_qr_moi, thoi_diem, nguoi_doi)
SELECT id, asset_id, old_qr_code, new_qr_code, changed_at, changed_by FROM dbo.sec_asset_qr_history;
SET IDENTITY_INSERT dbo.LichSuMaQrThietBi OFF;
`);
}
