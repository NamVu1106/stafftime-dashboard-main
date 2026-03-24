import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { connectDb, closeDb, queryOne, exec } from '../db/sqlServer';

dotenv.config();

async function main() {
  await connectDb();
  const existing = await queryOne('SELECT id FROM users WHERE username = @u', { u: 'admin' });
  if (existing) {
    console.log('User admin already exists');
    await closeDb();
    return;
  }
  const password_hash = await bcrypt.hash('admin123', 10);
  const now = new Date().toISOString();
  await exec(
    `INSERT INTO users (username, password_hash, role, created_at, updated_at)
     VALUES ('admin', @p, 'admin', @t, @t2)`,
    { p: password_hash, t: now, t2: now }
  );
  console.log('Created admin / admin123');
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
