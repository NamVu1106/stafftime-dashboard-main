import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = await prisma.user.findUnique({
      where: { username },
    });
    
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
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/auth/register
export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, role = 'admin' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const password_hash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        username,
        password_hash,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/auth/me
export const getMe = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /api/auth/forgot-password - Reset password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const user = await prisma.user.findUnique({
      where: { username },
    });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'Nếu tài khoản tồn tại, mật khẩu đã được reset về mặc định.',
        newPassword: 'admin123',
        warning: 'Vui lòng đổi mật khẩu sau khi đăng nhập!'
      });
    }
    
    // Generate a temporary password (or use default)
    const tempPassword = 'admin123'; // Default password
    const password_hash = await bcrypt.hash(tempPassword, 10);
    
    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        updated_at: new Date().toISOString(),
      },
    });
    
    res.json({
      success: true,
      message: 'Mật khẩu đã được reset thành công!',
      username: user.username,
      newPassword: tempPassword,
      warning: '⚠️ Vui lòng đổi mật khẩu ngay sau khi đăng nhập để bảo mật!'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET/POST /api/auth/create-default - Create default admin user
export const createDefaultUser = async (req: Request, res: Response) => {
  try {
    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (existingUser) {
      return res.json({ 
        message: 'Admin user already exists',
        username: 'admin',
        password: 'admin123',
        note: 'You can use these credentials to login'
      });
    }

    // Create default admin user
    const password_hash = await bcrypt.hash('admin123', 10);
    
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        password_hash,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      message: '✅ Default admin user created successfully!',
      credentials: {
        username: 'admin',
        password: 'admin123'
      },
      warning: '⚠️ Please change the password after first login!',
      nextStep: 'Go to http://localhost:8080/login and login with the credentials above'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


