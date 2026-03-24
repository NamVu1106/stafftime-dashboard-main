import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { query, queryOne, exec } from '../db/sqlServer';

/** Tạo bảng dbo.users nếu chưa có (tránh lỗi "Invalid object name 'users'"). */
export async function ensureUsersTable(): Promise<void> {
  await exec(`
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [username] NVARCHAR(1000) NOT NULL,
    [password_hash] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [users_role_df] DEFAULT 'admin',
    [created_at] NVARCHAR(1000) NOT NULL CONSTRAINT [users_created_at_df] DEFAULT '',
    [updated_at] NVARCHAR(1000) NOT NULL CONSTRAINT [users_updated_at_df] DEFAULT '',
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_username_key] UNIQUE NONCLUSTERED ([username])
  );
END
`);
}

/** Sau khi có bảng users: tạo admin/admin123 nếu chưa có tài khoản nào. */
export async function ensureDefaultAdminUser(): Promise<void> {
  const count = await queryOne<{ n: number }>(
    'SELECT COUNT(*) AS n FROM users',
    {}
  );
  const n = Number(count?.n ?? 0);
  if (n > 0) return;
  const password_hash = await bcrypt.hash('admin123', 10);
  const now = new Date().toISOString();
  await exec(
    `INSERT INTO users (username, password_hash, role, created_at, updated_at)
     VALUES (@u, @p, @r, @c1, @c2)`,
    { u: 'admin', p: password_hash, r: 'admin', c1: now, c2: now }
  );
  console.log('✅ Đã tạo tài khoản mặc định: admin / admin123 (đổi mật khẩu sau khi đăng nhập)');
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const user = await queryOne<{
      id: number;
      username: string;
      password_hash: string;
      role: string;
    }>('SELECT id, username, password_hash, role FROM users WHERE username = @u', { u: username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, role = 'admin' } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const existing = await queryOne('SELECT id FROM users WHERE username = @u', { u: username });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const rows = await query<{ id: number }>(
      `INSERT INTO users (username, password_hash, role, created_at, updated_at)
       OUTPUT INSERTED.id AS id
       VALUES (@username, @password_hash, @role, @created_at, @updated_at)`,
      { username, password_hash, role, created_at: now, updated_at: now }
    );
    const id = rows[0]?.id;
    const token = jwt.sign(
      { userId: id, username, role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );
    res.status(201).json({ token, user: { id, username, role } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await queryOne<{ id: number; username: string; role: string }>(
      'SELECT id, username, role FROM users WHERE id = @id',
      { id: decoded.userId }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const user = await queryOne<{ id: number; username: string }>(
      'SELECT id, username FROM users WHERE username = @u',
      { u: username }
    );
    if (!user) {
      return res.json({
        success: true,
        message: 'Nếu tài khoản tồn tại, mật khẩu đã được reset về mặc định.',
        newPassword: 'admin123',
        warning: 'Vui lòng đổi mật khẩu sau khi đăng nhập!',
      });
    }
    const tempPassword = 'admin123';
    const password_hash = await bcrypt.hash(tempPassword, 10);
    await exec(
      'UPDATE users SET password_hash = @p, updated_at = @t WHERE id = @id',
      { p: password_hash, t: new Date().toISOString(), id: user.id }
    );
    res.json({
      success: true,
      message: 'Mật khẩu đã được reset thành công!',
      username: user.username,
      newPassword: tempPassword,
      warning: '⚠️ Vui lòng đổi mật khẩu ngay sau khi đăng nhập để bảo mật!',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDefaultUser = async (req: Request, res: Response) => {
  try {
    const existingUser = await queryOne('SELECT id FROM users WHERE username = @u', { u: 'admin' });
    if (existingUser) {
      return res.json({
        message: 'Admin user already exists',
        username: 'admin',
        password: 'admin123',
        note: 'You can use these credentials to login',
      });
    }
    const password_hash = await bcrypt.hash('admin123', 10);
    const now = new Date().toISOString();
    await exec(
      `INSERT INTO users (username, password_hash, role, created_at, updated_at)
       VALUES (@u, @p, @r, @c1, @c2)`,
      { u: 'admin', p: password_hash, r: 'admin', c1: now, c2: now }
    );
    res.json({
      success: true,
      message: '✅ Default admin user created successfully!',
      credentials: { username: 'admin', password: 'admin123' },
      warning: '⚠️ Please change the password after first login!',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
