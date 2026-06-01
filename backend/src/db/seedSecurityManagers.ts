import bcrypt from 'bcrypt';
import { queryOne, exec } from './sqlServer';

/** Tài khoản demo: manager_an / manager123 — chỉ xem bộ phận An ninh */
export async function seedSecurityDemoManagers(): Promise<void> {
  const linked = await queryOne<{ n: number }>(
    'SELECT COUNT(1) AS n FROM dbo.sec_user_departments'
  );
  if (linked && linked.n > 0) return;

  const deptAn = await queryOne<{ id: number }>(
    "SELECT id FROM dbo.sec_departments WHERE code = 'AN'"
  );
  if (!deptAn?.id) return;

  let manager = await queryOne<{ id: number }>(
    'SELECT id FROM dbo.users WHERE username = @u',
    { u: 'manager_an' }
  );
  if (!manager?.id) {
    const hash = await bcrypt.hash('manager123', 10);
    const now = new Date().toISOString();
    manager = await queryOne<{ id: number }>(
      `INSERT INTO dbo.users (username, password_hash, role, created_at, updated_at)
       OUTPUT INSERTED.id
       VALUES (@u, @p, N'manager', @c, @c)`,
      { u: 'manager_an', p: hash, c: now }
    );
  }
  if (!manager?.id) return;

  await exec(
    `INSERT INTO dbo.sec_user_departments (user_id, department_id) VALUES (@uid, @did)`,
    { uid: manager.id, did: deptAn.id }
  );
  console.log('✅ Demo manager: manager_an / manager123 (bộ phận An ninh vật lý)');
}
