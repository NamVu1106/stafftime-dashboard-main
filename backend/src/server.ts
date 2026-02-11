import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Initialize Prisma Client
export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? FRONTEND_URL
    : (origin, callback) => {
        // Allow requests with no origin (e.g., curl, Postman)
        if (!origin) return callback(null, true);

        // Allow any localhost/127.0.0.1 port in development to avoid Vite port conflicts (5173 -> 5174, ...)
        const isLocalhost =
          /^https?:\/\/localhost:\d+$/.test(origin) ||
          /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin);

        if (isLocalhost) return callback(null, true);

        // Fallback: allow configured frontend URL
        if (origin === FRONTEND_URL) return callback(null, true);

        return callback(new Error(`Not allowed by CORS: ${origin}`));
      },
  credentials: true,
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const uploadsPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Import routes
import authRoutes from './routes/auth';
import employeesRoutes from './routes/employees';
import timekeepingRoutes from './routes/timekeeping';
import uploadRoutes from './routes/upload';
import statisticsRoutes from './routes/statistics';
import notificationsRoutes from './routes/notifications';
import departmentsRoutes from './routes/departments';
import hrExcelRoutes from './routes/hrExcel';

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/timekeeping', timekeepingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/hr-excel', hrExcelRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve frontend (for production)
const frontendDistPath = path.join(process.cwd(), '..', 'dist');
const distExists = fs.existsSync(frontendDistPath);
if (distExists) {
  app.use(express.static(frontendDistPath));
  console.log('✅ Serving frontend from:', frontendDistPath);
  
  // SPA routing - serve index.html for non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  console.warn('⚠️ Frontend dist folder not found at:', frontendDistPath);
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

