/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter((f) => /\.xlsx$/i.test(f) && !/^~\$/.test(f));

const vina = files.find((f) => /thong tin cnv|tong vina|vina/i.test(f.replace(/[^a-z0-9\s]/gi, '')));
const thoivu = files.find((f) => (f.includes('Thời') || f.includes('thoi')) && f.includes('2024') && !/official|temp|payroll|bhxh|attendance|daily|drug|medical|insurance|arrears/i.test(f));

function inspect(filePath, label) {
  if (!filePath) {
    console.log(label, '- FILE NOT FOUND');
    return;
  }
  const fullPath = path.join(dir, filePath);
  console.log('\n' + '='.repeat(60));
  console.log(label, ':', filePath);
  console.log('='.repeat(60));
  const wb = XLSX.readFile(fullPath, { cellDates: true, sheetStubs: true, sheetRows: 100 });
  console.log('Sheets:', wb.SheetNames.join(' | '));
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    console.log('Sheet empty');
    return;
  }
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  console.log('Total rows (first 100):', raw.length);
  console.log('\nFirst 15 rows (raw):');
  raw.slice(0, 15).forEach((row, i) => {
    console.log((i + 1) + ':', row);
  });
  // Header row
  const firstRow = raw[0] || [];
  console.log('\nFirst row (headers):', firstRow);
  console.log('Number of columns:', firstRow.length);
}

inspect(vina, 'THÔNG TIN CNV TỔNG VINA');
inspect(thoivu, 'THỜI VỤ TỔNG 2024');
