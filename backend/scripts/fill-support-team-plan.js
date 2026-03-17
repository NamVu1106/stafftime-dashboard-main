/**
 * Kế hoạch công việc Đội hỗ trợ 2026 — Project đang phát triển, chưa hoàn thành
 * Chạy: node scripts/fill-support-team-plan.js
 */
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const templatePath = path.join(root, "'26년 지원팀 업무 계획표_260227.xlsx");
const outPath = templatePath;

// Phân loại theo nội dung công việc (bảng mẫu mới)
const COLORS = {
  newDev: 'BDD7EE',      // Công việc mới, phát triển chức năng - xanh dương nhạt
  maintenance: 'C6EFCE',  // Công việc duy trì, sửa lỗi - xanh lá nhạt
  operation: 'E4DFEC',   // Công việc vận hành - tím/hồng nhạt
  pm: 'FFEB9C',          // Công việc quản lý dự án - vàng
  report: 'F8CBAD',      // Tổng hợp, báo cáo - cam nhạt
};

// Kế hoạch 2026 — Phân loại theo nội dung
const supportTeamWork = [
  { no: 1, person: 'IT', dept: '지원팀', work: 'YS-Smart 출퇴근 시스템 점검 (서버, DB, API)\nKiểm tra hệ thống chấm công', weeks: 'all', note: '', type: 'operation' },
  { no: 2, person: 'IT', dept: '지원팀', work: '데이터 백업 및 복구 점검\nKiểm tra sao lưu và khôi phục', weeks: [5,9,13,17,21,25,29,33,37,41,45,49], note: '매주 금요일', type: 'operation' },
  { no: 3, person: 'IT', dept: '지원팀', work: '사용자 문의 접수 및 처리\nTiếp nhận và xử lý yêu cầu hỗ trợ', weeks: 'all', note: '', type: 'operation' },
  { no: 4, person: 'IT', dept: '지원팀', work: '출퇴근/직원 데이터 업로드 지원\nHỗ trợ upload chấm công, nhân viên', weeks: 'all', note: '', type: 'operation' },
  { no: 5, person: 'IT', dept: '지원팀', work: '버그 수정 및 패치 배포\nSửa lỗi và triển khai bản vá', weeks: 'all', note: '', type: 'maintenance' },
  { no: 6, person: 'IT', dept: '지원팀', work: '공무(공무) 모듈 개발 — 현재 "개발 예정"\nModule Công vụ — Hiện báo "Đang phát triển"', weeks: [14,15,16,17,18,19,20,21,22,23], note: 'Q2-Q3', type: 'newDev' },
  { no: 7, person: 'IT', dept: '지원팀', work: '구매(구매) 모듈 개발 — 현재 "개발 예정"\nModule Mua hàng — Hiện báo "Đang phát triển"', weeks: [18,19,20,21,22,23,24,25,26], note: 'Q2-Q3', type: 'newDev' },
  { no: 8, person: 'IT', dept: '지원팀', work: 'EHS 모듈 개발 — 현재 "개발 예정"\nModule EHS — Hiện báo "Đang phát triển"', weeks: [27,28,29,30,31,32,33,34,35,36,37], note: 'Q3-Q4', type: 'newDev' },
  { no: 9, person: 'IT', dept: '지원팀', work: '모바일 반응형 UI 개선\nCải thiện giao diện responsive mobile', weeks: [2,3,4,5,6,7,8], note: 'Q1', type: 'newDev' },
  { no: 10, person: 'IT', dept: '지원팀', work: '성능 최적화 (대시보드 로딩)\nTối ưu hiệu năng tải dashboard', weeks: [18,19,20,21,22], note: 'Q2', type: 'newDev' },
  { no: 11, person: 'IT', dept: '지원팀', work: 'Excel 업로드 가이드 작성 (14종 HR)\nViết hướng dẫn format Excel upload', weeks: [3,4,5,6], note: 'Q1', type: 'report' },
  { no: 12, person: 'IT', dept: '지원팀', work: '기능 목록/메뉴 구조 문서 정리\nCập nhật tài liệu danh sách chức năng', weeks: [1,2,3], note: 'Q1', type: 'report' },
  { no: 13, person: 'IT', dept: '지원팀', work: '신규 사용자 교육 프로그램\nChương trình đào tạo người dùng mới', weeks: [5,6,7,8,9], note: 'Q1-Q2', type: 'pm' },
  { no: 14, person: 'IT', dept: '지원팀', work: '다국어(베트남어/한국어) 번역 점검\nKiểm tra dịch đa ngôn ngữ VN/KR', weeks: [2,3,4], note: 'Q1', type: 'report' },
  { no: 15, person: 'IT', dept: '지원팀', work: '연간 시스템 점검 및 2027 개선 제안\nKiểm tra cuối năm và đề xuất 2027', weeks: [45,46,47,48,49,50], note: 'Q4', type: 'report' },
];

async function run() {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(templatePath)) {
    await wb.xlsx.readFile(templatePath);
  }

  const existing = wb.getWorksheet('지원팀');
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet('지원팀', { properties: { outlineLevelCol: 0 } });

  const setFill = (cell, hex) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
  };

  ws.mergeCells('A1:BC1');
  ws.getCell('A1').value = '26년 지원팀 업무 계획표 (Kế hoạch công việc Đội hỗ trợ 2026) — Project đang phát triển';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.addRow([]);

  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const header1 = ['No','담당자\nNgười phụ trách','부서\nBộ phận','업무 내용\nNội dung công việc'];
  months.forEach(m => { header1.push(m); for(let i=0;i<3;i++) header1.push(''); });
  header1.push('Ghi chú');
  ws.addRow(header1);
  const header2 = ['','','',''];
  for(let w=1;w<=52;w++) header2.push('W'+w);
  header2.push('');
  ws.addRow(header2);

  supportTeamWork.forEach((item) => {
    const row = ws.addRow([
      item.no, item.person, item.dept, item.work,
      ...Array(52).fill(''),
      item.note || ''
    ]);
    const rowNum = row.number;
    const color = COLORS[item.type] || COLORS.operation;
    for (let w = 1; w <= 52; w++) {
      const hasDot = item.weeks === 'all' || (Array.isArray(item.weeks) && item.weeks.includes(w));
      const col = 4 + w;
      const cell = ws.getCell(rowNum, col);
      if (hasDot) {
        cell.value = '●';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        setFill(cell, color);
      }
    }
  });

  ws.addRow(['합계\nTotal', ...Array(56).fill('')]);
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow(['', 'Phân loại theo nội dung công việc', 'Màu biểu thị', 'Ghi chú']);

  const legendTypes = [
    ['', 'Công việc mới, phát triển chức năng', 'Xanh dương nhạt', '', 'newDev'],
    ['', 'Công việc duy trì, sửa lỗi', 'Xanh lá nhạt', '', 'maintenance'],
    ['', 'Công việc vận hành', 'Tím/hồng nhạt', '', 'operation'],
    ['', 'Công việc quản lý dự án', 'Vàng', '', 'pm'],
    ['', 'Tổng hợp, báo cáo', 'Cam nhạt', '', 'report'],
  ];
  legendTypes.forEach((arr) => {
    const r = ws.addRow([arr[0], arr[1], arr[2], arr[3]]);
    setFill(ws.getCell(r.number, 3), COLORS[arr[4]]); // Cột Màu sắc phân biệt
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 48;
  for (let c = 5; c <= 56; c++) ws.getColumn(c).width = 3;
  ws.getColumn(57).width = 18;

  try {
    await wb.xlsx.writeFile(outPath);
    console.log('✅ Đã ghi file:', outPath);
  } catch (e) {
    if (e.code === 'EBUSY') {
      const alt = path.join(root, 'docs', `26년_지원팀_업무_계획표_${Date.now()}.xlsx`);
      fs.mkdirSync(path.dirname(alt), { recursive: true });
      await wb.xlsx.writeFile(alt);
      console.log('✅ File gốc đang mở. Đã ghi ra:', alt);
    } else throw e;
  }
  console.log('   Mới(blue) | Duy trì(green) | Vận hành(purple) | QLDA(vàng) | Báo cáo(cam)');
}

run().catch(e => { console.error(e); process.exit(1); });
