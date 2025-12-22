import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';

// Import routes
import employeesRoutes from './routes/employees';
import timekeepingRoutes from './routes/timekeeping';
import uploadRoutes from './routes/upload';
import statisticsRoutes from './routes/statistics';
import authRoutes from './routes/auth';
import notificationsRoutes from './routes/notifications';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Middleware - CORS configuration
// In production, frontend is served from same origin, so CORS is less strict
const FRONTEND_URL = process.env.FRONTEND_URL;
const isProduction = process.env.NODE_ENV === 'production';

// Always allow localhost:8080 in development, or use FRONTEND_URL if set
const allowedOrigins = FRONTEND_URL 
  ? [FRONTEND_URL]
  : isProduction 
    ? undefined // Same origin in production
    : ['http://localhost:8080', 'http://127.0.0.1:8080'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' })); // Increase limit to 10MB for large payloads (e.g., base64 images)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve frontend static files (after API routes)
// In production, dist folder is at root level (../dist from backend folder)
// In development, it's also at root level
const frontendDistPath = path.join(process.cwd(), '..', 'dist');
const distExists = fs.existsSync(frontendDistPath);
if (distExists) {
  app.use(express.static(frontendDistPath));
  console.log('✅ Serving frontend from:', frontendDistPath);
} else {
  console.warn('⚠️ Frontend dist folder not found at:', frontendDistPath);
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/timekeeping', timekeepingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve frontend for all non-API routes (SPA routing)
if (distExists) {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    // Don't serve index.html for uploads
    if (req.path.startsWith('/uploads')) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Auto-create default admin user on server start
async function ensureDefaultUser() {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (!existingUser) {
      const password_hash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          password_hash,
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
      console.log('✅ Default admin user created!');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('✓ Admin user already exists');
    }
  } catch (error: any) {
    console.error('⚠️ Error creating default user:', error.message);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Ensure default user exists
  await ensureDefaultUser();
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});


