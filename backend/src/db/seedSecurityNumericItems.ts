import { queryOne, exec } from './sqlServer';

/** Thêm hạng mục đo số mẫu (nhiệt độ / áp suất) nếu DB đã có seed cũ */
export async function seedSecurityNumericItemsIfMissing(): Promise<void> {
  const col = await queryOne<{ len: number }>(
    `SELECT COL_LENGTH('dbo.sec_check_items', 'input_type') AS len`
  );
  if (!col?.len) return;

  const existing = await queryOne<{ n: number }>(
    `SELECT COUNT(1) AS n FROM dbo.sec_check_items WHERE input_type = N'number'`
  );
  if (existing && existing.n > 0) return;

  const cat = await queryOne<{ id: number }>(`
    SELECT TOP 1 c.id
    FROM dbo.sec_categories c
    INNER JOIN dbo.sec_departments d ON d.id = c.department_id
    WHERE d.code = N'AN'
    ORDER BY c.sort_order
  `);
  if (!cat?.id) return;

  const maxSort = await queryOne<{ m: number }>(
    'SELECT ISNULL(MAX(sort_order), 0) AS m FROM dbo.sec_check_items WHERE category_id = @cat',
    { cat: cat.id }
  );
  const base = (maxSort?.m ?? 0) + 1;

  await exec(`
INSERT INTO dbo.sec_check_items
  (category_id, label, requires_photo_on_fail, sort_order, input_type, min_value, max_value, unit)
VALUES
  (@cat, N'Nhiệt độ bề mặt tủ điện', 1, @s1, N'number', 0, 80, N'°C'),
  (@cat, N'Áp suất khí nén (đường ống)', 1, @s2, N'number', 0.5, 8, N'bar');
`, { cat: cat.id, s1: base, s2: base + 1 });
}
