/**
 * Đánh dấu ô timeline trong sheet "IT lap trinh" - phân màu theo thời gian
 * Chạy: node scripts/mark-it-timeline.js
 */
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Màu theo thời gian (월간 | 분기 | 상반기 | 하반기 | 연간)
const COLORS = {
  monthly: 'F8CBAD',     // Hàng tháng - cam
  quarterly: 'BDD7EE',   // Hàng quý - xanh dương
  firstHalf: 'C6EFCE',   // Nửa đầu năm - xanh lá nhạt
  secondHalf: '92D050',  // Nửa cuối năm - xanh lá đậm
  annual: 'E4DFEC',      // Tổng kết năm - tím
};

// 20 tasks: row 4-23, weeks cần đánh dấu, màu
// Cột E(5)=W1, F(6)=W2, ... đến cột BC(55)=W51, BD(56)=W52
const TASKS = [
  { row: 4, weeks: 'all', type: 'annual' },                                    // 1. System check
  { row: 5, weeks: [5,9,13,17,21,25,29,33,37,41,45,49], type: 'monthly' },    // 2. Backup
  { row: 6, weeks: 'all', type: 'annual' },                                    // 3. User support
  { row: 7, weeks: [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26], type: 'firstHalf' }, // 4. Training
  { row: 8, weeks: 'all', type: 'annual' },                                    // 5. Sync
  { row: 9, weeks: 'all', type: 'annual' },                                    // 6. Upload/history
  { row: 10, weeks: [3,4,5,6,7,8,9,10,11,12], type: 'firstHalf' },            // 7. Excel guide
  { row: 11, weeks: [14,15,16,17,18,19,20,21,22,23,24,25,26], type: 'secondHalf' }, // 8. Công vụ
  { row: 12, weeks: [18,19,20,21,22,23,24,25,26,27], type: 'secondHalf' },    // 9. Mua hàng
  { row: 13, weeks: [27,28,29,30,31,32,33,34,35,36,37,38,39], type: 'secondHalf' }, // 10. EHS
  { row: 14, weeks: [2,3,4,5,6,7,8], type: 'firstHalf' },                     // 11. Mobile UI
  { row: 15, weeks: [5,9,13,17,21,25,29,33,37,41,45,49], type: 'monthly' },   // 12. Stats
  { row: 16, weeks: 'all', type: 'annual' },                                   // 13. HR Excel
  { row: 17, weeks: [1,2,3,4,5], type: 'firstHalf' },                         // 14. Doc update
  { row: 18, weeks: 'all', type: 'annual' },                                    // 15. API doc
  { row: 19, weeks: 'all', type: 'annual' },                                    // 16. Bug fix
  { row: 20, weeks: [18,19,20,21,22], type: 'quarterly' },                     // 17. Performance
  { row: 21, weeks: [2,3,4,5,6], type: 'firstHalf' },                          // 18. Translation
  { row: 22, weeks: [45,46,47,48,49,50,51,52], type: 'annual' },               // 19. Year-end
  { row: 23, weeks: 'all', type: 'annual' },                                    // 20. Revision history
];

async function run() {
  const files = fs.readdirSync(root).filter(f => f.endsWith('.xlsx') && f.includes('260227') && !f.startsWith('~$'));
  const preferred = files.find(f => f.includes('(2)')) || files.find(f => f.includes('(1)')) || files[0];
  const filePath = path.join(root, preferred);
  
  if (!fs.existsSync(filePath)) {
    console.error('Không tìm thấy file Excel');
    process.exit(1);
  }
  console.log('Đọc file:', filePath);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  
  const ws = wb.getWorksheet('IT lap trinh');
  if (!ws) {
    console.error('Không tìm thấy sheet "IT lap trinh"');
    process.exit(1);
  }

  const setFill = (cell, hex) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
  };

  // Cột 5 = W1, 6 = W2, ... 56 = W52
  const weekColStart = 5;
  
  TASKS.forEach(({ row, weeks, type }) => {
    const color = COLORS[type];
    const weekList = weeks === 'all' ? Array.from({ length: 52 }, (_, i) => i + 1) : weeks;
    
    weekList.forEach(w => {
      const col = weekColStart + w - 1;
      const cell = ws.getCell(row, col);
      cell.value = '●';
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      setFill(cell, color);
    });
  });

  const outPath = filePath;
  try {
    await wb.xlsx.writeFile(outPath);
    console.log('✅ Đã đánh dấu timeline vào file:', outPath);
  } catch (e) {
    if (e.code === 'EBUSY') {
      const alt = path.join(root, 'docs', `IT_lap_trinh_marked_${Date.now()}.xlsx`);
      fs.mkdirSync(path.dirname(alt), { recursive: true });
      await wb.xlsx.writeFile(alt);
      console.log('✅ File đang mở. Đã ghi ra:', alt);
    } else throw e;
  }
  console.log('   Cam(hàng tháng) | Xanh dương(hàng quý) | Xanh lá nhạt(상반기) | Xanh lá đậm(하반기) | Tím(연간)');
}

run().catch(e => { console.error(e); process.exit(1); });
