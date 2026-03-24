/**
 * Tạo file Excel ~5000 dòng chấm công mẫu và POST lên POST /api/upload/timekeeping
 *
 * Chạy (backend đang listen, ví dụ :3000):
 *   cd backend
 *   npx ts-node src/scripts/testUploadTimekeeping.ts
 *
 * Biến môi trường (tùy chọn):
 *   UPLOAD_TEST_BASE=http://localhost:3000
 *   UPLOAD_TEST_ROWS=5000
 *   UPLOAD_TEST_TOKEN=eyJ...  (nếu sau này bật JWT cho upload)
 */
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as XLSX from 'xlsx';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE = (process.env.UPLOAD_TEST_BASE || 'http://localhost:3000').replace(/\/$/, '');
const ROWS = Math.min(100_000, Math.max(1, parseInt(process.env.UPLOAD_TEST_ROWS || '5000', 10) || 5000));
const TOKEN = process.env.UPLOAD_TEST_TOKEN || '';

const HEADERS = [
  'TT',
  'Mã nhân viên',
  'Tên nhân viên',
  'Phòng Ban',
  'Ngày',
  'Thứ',
  'Giờ vào',
  'Giờ ra',
  'Trễ',
  'Sớm',
  'Công',
  'Tổng giờ',
  'Tăng ca',
  'Tổng toàn bộ',
  'Ca',
];

const THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function buildSheet(): Buffer {
  const aoa: (string | number)[][] = [HEADERS];
  const uniqueCodes = 250;
  for (let i = 1; i <= ROWS; i++) {
    const emp = (i % uniqueCodes) + 1;
    const code = `TST${String(emp).padStart(5, '0')}`;
    const day = 1 + ((i + emp) % 28);
    const dateStr = `2025-03-${String(day).padStart(2, '0')}`;
    const d = new Date(2025, 2, day);
    const thu = THU[d.getDay()] ?? '';
    aoa.push([
      i,
      code,
      `NV Test ${code}`,
      'Bộ phận QA Script',
      dateStr,
      thu,
      '07:30',
      '17:00',
      0,
      0,
      1,
      8,
      0,
      8,
      'CA NGAY',
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function main(): Promise<void> {
  console.log(`Đang tạo Excel ${ROWS} dòng…`);
  const buf = buildSheet();
  const outDir = path.join(process.cwd(), 'scripts-out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `test-timekeeping-${ROWS}rows.xlsx`);
  fs.writeFileSync(outPath, buf);
  console.log(`Đã ghi: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);

  const url = `${BASE}/api/upload/timekeeping`;
  console.log(`POST ${url} …`);

  const form = new FormData();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('file', blob, `test-${ROWS}.xlsx`);

  const headers: Record<string, string> = {};
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const t0 = Date.now();
  const res = await fetch(url, { method: 'POST', body: form, headers });
  const text = await res.text();
  const ms = Date.now() - t0;

  console.log(`HTTP ${res.status} (${(ms / 1000).toFixed(1)}s)`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text.slice(0, 2000));
  }
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
