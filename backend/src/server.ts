import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';
import { connectDb, closeDb } from './db/sqlServer';
import { ensureDatabaseSchema } from './db/ensureSchema';
import { ensureDefaultAdminUser } from './controllers/auth';

type LanAddress = {
  address: string;
  label?: string;
};

type NetworkAddress = {
  family: string | number;
  internal: boolean;
  address: string;
};

function uniqueLanAddresses(addresses: LanAddress[]) {
  const seen = new Set<string>();
  return addresses.filter((item) => {
    if (!item.address || seen.has(item.address)) {
      return false;
    }
    seen.add(item.address);
    return true;
  });
}

function getWindowsPreferredLanAddresses(): LanAddress[] {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const script = [
      '$items = Get-NetIPAddress -AddressFamily IPv4 |',
      "  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } |",
      '  Select-Object IPAddress, InterfaceAlias',
      "if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }",
    ].join(' ');

    const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as
      | { IPAddress: string; InterfaceAlias?: string }
      | Array<{ IPAddress: string; InterfaceAlias?: string }>;

    const entries = Array.isArray(parsed) ? parsed : [parsed];

    return uniqueLanAddresses(
      entries.map((entry) => ({
        address: entry.IPAddress,
        label: entry.InterfaceAlias,
      }))
    );
  } catch {
    return [];
  }
}

function getFallbackLanAddresses(): LanAddress[] {
  const entries: LanAddress[] = [];
  const networkInterfaces = os.networkInterfaces() as Record<string, NetworkAddress[] | undefined>;

  for (const [label, addresses] of Object.entries(networkInterfaces)) {
    for (const item of addresses ?? []) {
      const family = item.family === 4 || item.family === 'IPv4' ? 'IPv4' : 'IPv6';

      if (
        family !== 'IPv4' ||
        item.internal ||
        item.address.startsWith('127.') ||
        item.address.startsWith('169.254.')
      ) {
        continue;
      }

      entries.push({
        address: item.address,
        label,
      });
    }
  }

  return uniqueLanAddresses(entries);
}

function getLanAddresses() {
  const windowsAddresses = getWindowsPreferredLanAddresses();
  return windowsAddresses.length > 0 ? windowsAddresses : getFallbackLanAddresses();
}

function buildFrontendLanUrl(address: string) {
  try {
    const url = new URL(FRONTEND_URL);
    url.hostname = address;
    return url.toString();
  } catch {
    return `http://${address}:5173/`;
  }
}

function logLanHints(port: number) {
  const lanAddresses = getLanAddresses();

  if (lanAddresses.length === 0) {
    return;
  }

  console.log('📡 LAN URLs đang dùng được:');
  for (const item of lanAddresses) {
    const label = item.label ? ` (${item.label})` : '';
    console.log(`   Frontend${label}: ${buildFrontendLanUrl(item.address)}`);
    console.log(`   Backend${label}: http://${item.address}:${port}/api/health`);
  }
  console.log('   Dùng URL Frontend ở trên khi mở từ máy khác trong cùng mạng.');
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

import authRoutes from './routes/auth';
import employeesRoutes from './routes/employees';
import timekeepingRoutes from './routes/timekeeping';
import uploadRoutes from './routes/upload';
import statisticsRoutes from './routes/statistics';
import notificationsRoutes from './routes/notifications';
import departmentsRoutes from './routes/departments';
import hrExcelRoutes from './routes/hrExcel';
import hrTemplatesRoutes from './routes/hrTemplates';
import vendorAssignmentsRoutes from './routes/vendorAssignments';

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/timekeeping', timekeepingRoutes);
// Log mọi request upload để xác định request có vào đúng backend này không (PID in ra lúc start)
app.use('/api/upload', (req, res, next) => {
  if (req.path === '/timekeeping') {
    console.log(`[BACKEND PID=${process.pid}] ${req.method} /api/upload/timekeeping`);
  }
  next();
});
app.use('/api/upload', uploadRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/hr-excel', hrExcelRoutes);
app.use('/api/hr-templates', hrTemplatesRoutes);
app.use('/api/vendor-assignments', vendorAssignmentsRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    db: 'sqlserver',
    backend: 'mssql',
    pid: process.pid,
    lan: getLanAddresses(),
  });
});

const frontendDistPath = path.join(process.cwd(), '..', 'dist');
const distExists = fs.existsSync(frontendDistPath);
if (distExists) {
  app.use(express.static(frontendDistPath));
  console.log('✅ Serving frontend from:', frontendDistPath);
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  console.warn('⚠️ Frontend dist folder not found at:', frontendDistPath);
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err?.message ?? String(err);
  const stack = err?.stack;
  console.error('[Express] LỖI:', msg);
  if (stack) console.error('[Express] Stack:', stack);
  try {
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: msg || 'Internal server error',
        detail: process.env.NODE_ENV !== 'production' ? stack : undefined,
      });
    }
  } catch (_) {
    /* ignore */
  }
});

async function start() {
  try {
    await connectDb();
    console.log('✅ SQL Server connected');
    await ensureDatabaseSchema();
    await ensureDefaultAdminUser();
    console.log('✅ Đã kiểm tra schema DB (employees, chấm công, thông báo, HR Excel, …)');
  } catch (e: any) {
    console.error('❌ SQL Server:', e.message);
    process.exit(1);
  }
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server http://0.0.0.0:${PORT}`);
    console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
    console.log(`📌 Backend PID = ${process.pid}`);
    logLanHints(Number(PORT));
    console.log(`   Kiểm tra: mở http://localhost:${PORT}/api/upload/timekeeping phải thấy JSON có "backend":"mssql" và "pid". Nếu thấy "Cannot GET" thì đang chạy nhầm server khác.`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} đang bị process khác dùng. Tắt process đó rồi chạy lại.`);
      console.error(`   Windows: chạy file kill-port-3000.bat trong thư mục backend, hoặc: netstat -ano | findstr :${PORT} rồi taskkill /F /PID <số_cột_cuối>\n`);
      process.exit(1);
    }
    throw err;
  });
}

start();

process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});
