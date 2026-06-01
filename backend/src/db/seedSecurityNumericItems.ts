import { queryOne, exec } from './sqlServer';

export async function seedSecurityNumericItemsIfMissing(): Promise<void> {
  const existing = await queryOne<{ n: number }>(
    `SELECT COUNT(1) AS n FROM dbo.HangMucKiemTra WHERE kieu_du_lieu = N'number'`
  );
  if (existing && existing.n > 0) return;

  const cat = await queryOne<{ id: number }>(`
    SELECT TOP 1 c.id
    FROM dbo.NhomHangMuc c
    INNER JOIN dbo.BoPhan d ON d.id = c.bo_phan_id
    WHERE d.ma_bo_phan = N'AN'
    ORDER BY c.thu_tu
  `);
  if (!cat?.id) return;

  const maxSort = await queryOne<{ m: number }>(
    'SELECT ISNULL(MAX(thu_tu), 0) AS m FROM dbo.HangMucKiemTra WHERE nhom_id = @cat',
    { cat: cat.id }
  );
  const base = (maxSort?.m ?? 0) + 1;

  await exec(`
INSERT INTO dbo.HangMucKiemTra (nhom_id, noi_dung, kieu_du_lieu, nguong_min, nguong_max, don_vi, bat_buoc, yeu_cau_an_loi, thu_tu)
VALUES
  (@cat, N'Nhiệt độ bề mặt tủ điện', N'number', 0, 80, N'°C', 1, 1, @s1),
  (@cat, N'Áp suất khí nén (đường ống)', N'number', 0.5, 8, N'bar', 1, 1, @s2);
`, { cat: cat.id, s1: base, s2: base + 1 });
}
