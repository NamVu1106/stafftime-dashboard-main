/**
 * Công cụ audit «Số lượng đi làm» (TT SX): kiểm tra công thức + in snapshot JSON.
 *
 * Usage:
 *   npx ts-node src/scripts/auditAttendanceCountSnapshot.ts --start 2026-03-01 --end 2026-03-31
 *   npm run audit:attendance-snapshot -- --start 2026-03-01 --end 2026-03-31
 *
 * Optional: --json  (chỉ in JSON snapshot + validation)
 *           --xlsx "path\\file.xlsx"  (in 25 dòng đầu sheet đầu để đối chiếu tay)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { connectDb, closeDb } from '../db/sqlServer';
import { runAttendanceCountSnapshotAudit } from '../controllers/hrTemplates';
import { formatAuditReportText, validateAttendanceProductionSnapshot } from '../lib/attendanceCountFormulas';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const start = arg('--start') || '';
  const end = arg('--end') || '';
  const xlsxPath = arg('--xlsx');
  const jsonOnly = hasFlag('--json');

  if (!start || !end) {
    console.error('Thiếu --start YYYY-MM-DD và --end YYYY-MM-DD');
    process.exit(1);
  }

  await connectDb();
  try {
    const { productionSnapshot, sheets } = await runAttendanceCountSnapshotAudit(start, end);
    const validation = validateAttendanceProductionSnapshot(productionSnapshot);

    if (jsonOnly) {
      console.log(
        JSON.stringify(
          {
            validation,
            productionSnapshot,
            overviewSheetName: sheets[0]?.name,
          },
          null,
          2
        )
      );
    } else {
      console.log(formatAuditReportText(productionSnapshot));
      console.log('');
      if (!validation.ok) {
        console.log('Chi tiết lỗi:');
        validation.errors.forEach((e) => console.log(' ', e));
        console.log('');
      }
      console.log('--- productionSnapshot (rút gọn) ---');
      console.log(JSON.stringify(productionSnapshot, null, 2));
    }

    if (xlsxPath) {
      const abs = path.resolve(xlsxPath);
      if (!fs.existsSync(abs)) {
        console.error('Không đọc được file:', abs);
        process.exit(2);
      }
      const wb = XLSX.readFile(abs, { cellDates: true });
      const sn = wb.SheetNames[0];
      const ws = wb.Sheets[sn];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
      console.log('\n--- XLSX preview (sheet đầu, 25 dòng) ---', sn);
      console.log(JSON.stringify(rows.slice(0, 25), null, 2));
    }

    if (!validation.ok) process.exit(3);
  } finally {
    await closeDb();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
