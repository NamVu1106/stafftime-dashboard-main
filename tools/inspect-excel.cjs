/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const cellVal = (cell) => {
  if (!cell) return '';
  const v = cell.w ?? cell.v ?? '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
};

const findTotalHit = (sheet, range, maxScanRows = 150, maxScanCols = 250) => {
  const r0 = range.s.r;
  const c0 = range.s.c;
  const r1 = Math.min(range.e.r, r0 + maxScanRows);
  const c1 = Math.min(range.e.c, c0 + maxScanCols);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const v = cellVal(sheet[addr]);
      const t = normalize(v);
      if (t === 'total' || t === 'tong') {
        return { r: r + 1, c: c + 1, v };
      }
    }
  }
  return null;
};

const printSheet = (workbook, sheetName, opts) => {
  const sh = workbook.Sheets[sheetName];
  if (!sh || !sh['!ref']) {
    console.log(`\n== ${sheetName} EMPTY`);
    return;
  }

  const ref = sh['!ref'] || 'A1';
  const range = XLSX.utils.decode_range(ref);
  const rows = range.e.r - range.s.r + 1;
  const cols = range.e.c - range.s.c + 1;
  const merges = (sh['!merges'] || []).length;

  console.log(`\n== ${sheetName}`);
  console.log(`ref=${ref} rows=${rows} cols=${cols} merges=${merges}`);

  const totalHit = findTotalHit(sh, range, opts.maxScanRows, opts.maxScanCols);
  console.log('totalHit=', totalHit ? `${totalHit.v}@R${totalHit.r}C${totalHit.c}` : '-');

  const r0 = range.s.r;
  const c0 = range.s.c;
  const rMax = Math.min(range.e.r, r0 + opts.previewRows);
  const cMax = Math.min(range.e.c, c0 + opts.previewCols);

  for (let r = r0; r <= rMax; r++) {
    const row = [];
    for (let c = c0; c <= cMax; c++) {
      let v = cellVal(sh[XLSX.utils.encode_cell({ r, c })]);
      if (typeof v === 'string' && v.length > 30) v = `${v.slice(0, 30)}…`;
      row.push(v);
    }
    const has = row.some((x) => String(x).trim() !== '');
    if (has) console.log(String(r + 1).padStart(4, ' '), row);
  }
};

const inspectFile = (filePath, opts) => {
  // Limit parsed rows to keep inspection fast (some templates have 1M+ rows).
  const workbook = XLSX.readFile(filePath, { cellDates: true, sheetStubs: true, sheetRows: 350 });
  console.log('\n======================================================');
  console.log('FILE', path.basename(filePath));
  console.log('sheets', workbook.SheetNames.length, workbook.SheetNames.join(' | '));

  const sheetNames = opts.sheets?.length ? opts.sheets : workbook.SheetNames.slice(0, 6);
  sheetNames.forEach((name) => {
    if (!workbook.SheetNames.includes(name)) return;
    printSheet(workbook, name, opts);
  });
};

const listXlsxFiles = (dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => /\.xlsx$/i.test(f) && !/^~\$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'vi'));

const main = () => {
  const args = process.argv.slice(2);
  const opts = {
    previewRows: 25,
    previewCols: 35,
    maxScanRows: 200,
    maxScanCols: 300,
    sheets: [],
  };

  const all = listXlsxFiles(process.cwd());
  const rawInput = args.length > 0 ? args.join(' ') : '';

  let files;
  if (!rawInput) {
    files = all;
  } else {
    const asPath = path.isAbsolute(rawInput) ? rawInput : path.join(process.cwd(), rawInput);
    if (fs.existsSync(asPath)) {
      files = [rawInput];
    } else {
      const q = normalize(rawInput);
      const matches = all.filter((f) => normalize(f).includes(q));
      if (matches.length === 0) {
        console.error('No match for:', rawInput);
        console.error('Available .xlsx files:', all.join(' | '));
        return;
      }
      console.log('Matched files:', matches.join(' | '));
      files = matches;
    }
  }

  for (const file of files) {
    const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      continue;
    }
    try {
      inspectFile(filePath, opts);
    } catch (e) {
      console.error('ERROR reading', filePath, e.message);
    }
  }
};

main();

