/**
 * Script tạo file Excel "26년 지원팀 업무 계획표" - Bản kế hoạch công việc đội hỗ trợ 2026
 * Chạy: node scripts/generate-work-plan.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 26년 지원팀 업무 계획표 - 2026 Support Team Work Plan
// Cột: 번호 | 업무 분류 | 업무 내용 | 담당자 | 계획 일정 | 완료 여부 | 비고
const workPlan = [
  ['번호', '업무 분류', '업무 내용', '담당자', '계획 일정', '완료 여부', '비고'],
  [1, '시스템 유지보수', 'YS-Smart 출퇴근 관리 시스템 일상 점검', '지원팀', '2026.01~12 (상시)', '진행중', '서버, DB, API 상태 확인'],
  [2, '시스템 유지보수', '데이터 백업 및 복구 절차 점검', '지원팀', '매주 금요일', '진행중', 'PostgreSQL 백업'],
  [3, '시스템 유지보수', '보안 업데이트 (JWT, 패스워드 정책)', '지원팀', '2026.Q1', '예정', ''],
  [4, '시스템 유지보수', '로그 모니터링 및 오류 대응', '지원팀', '2026.01~12 (상시)', '진행중', '에러 알림 설정'],
  [5, '사용자 지원', '사용자 문의 접수 및 처리 (로그인, 업로드, 보고서)', '지원팀', '2026.01~12', '진행중', ''],
  [6, '사용자 지원', '신규 사용자 교육 및 매뉴얼 제공', '지원팀', '2026.01~12', '진행중', 'VN/KR 매뉴얼'],
  [7, '사용자 지원', 'Excel 업로드 형식 가이드 작성 및 배포', '지원팀', '2026.Q1', '예정', '14종 HR Excel 양식'],
  [8, '데이터 관리', '직원 데이터 동기화 (정규직/계약직) 점검', '지원팀', '2026.01~12', '진행중', '업로드 후 검증'],
  [9, '데이터 관리', '출퇴근 데이터 업로드 및 저장 이력 관리', '지원팀', '2026.01~12', '진행중', '/history 페이지'],
  [10, '데이터 관리', '부서별 통계 데이터 정확성 검증', '지원팀', '매월 초', '진행중', ''],
  [11, '기능 개발', '공무(공무) 모듈 개발', '개발팀', '2026.Q2', '미착수', '현재 "개발 예정" 안내'],
  [12, '기능 개발', '구매(구매) 모듈 개발', '개발팀', '2026.Q2', '미착수', '현재 "개발 예정" 안내'],
  [13, '기능 개발', 'EHS 모듈 개발', '개발팀', '2026.Q3', '미착수', '환경/안전/보건'],
  [14, '기능 개발', '모바일 반응형 UI 개선', '개발팀', '2026.Q1', '예정', '태블릿/스마트폰'],
  [15, '기능 개발', '알림 기능 확장 (이메일/SMS)', '개발팀', '2026.Q3', '예정', ''],
  [16, '보고서', '일/월/년별 출퇴근 보고서 검증', '지원팀', '2026.01~12', '진행중', ''],
  [17, '보고서', 'HR Excel 14종 보고서 업로드 지원', '지원팀', '2026.01~12', '진행중', 'BHXH, 급여, 보험 등'],
  [18, '보고서', '부서별 비교 보고서 데이터 검증', '지원팀', '매월', '진행중', ''],
  [19, '문서화', '기능 목록 및 메뉴 구조 문서 업데이트', '지원팀', '2026.Q1', '완료', 'Excel 피라미드 형식'],
  [20, '문서화', 'API 엔드포인트 문서 유지보수', '지원팀', '2026.01~12', '진행중', ''],
  [21, '문서화', '개정 이력(YS-Smart) 기록 관리', '지원팀', '2026.01~12', '진행중', '/revision-history'],
  [22, '품질 관리', '버그 수정 및 패치 배포', '개발팀', '2026.01~12', '진행중', ''],
  [23, '품질 관리', '사용자 피드백 반영 검토', '지원팀', '2026.01~12', '진행중', ''],
  [24, '품질 관리', '성능 최적화 (대시보드 로딩 속도)', '개발팀', '2026.Q2', '예정', ''],
  [25, '기타', '다국어(베트남어/한국어) 번역 점검', '지원팀', '2026.Q1', '예정', ''],
  [26, '기타', '연간 시스템 점검 및 개선 제안', '지원팀', '2026.Q4', '예정', ''],
];

// Sheet 2: Vietnamese version (optional summary)
const workPlanVN = [
  ['STT', 'Nhóm công việc', 'Nội dung công việc', 'Người phụ trách', 'Thời gian', 'Trạng thái', 'Ghi chú'],
  [1, 'Bảo trì hệ thống', 'Kiểm tra hàng ngày hệ thống YS-Smart', 'Đội hỗ trợ', '01~12/2026', 'Đang thực hiện', ''],
  [2, 'Bảo trì hệ thống', 'Sao lưu dữ liệu định kỳ', 'Đội hỗ trợ', 'Hàng tuần', 'Đang thực hiện', ''],
  [3, 'Hỗ trợ người dùng', 'Xử lý yêu cầu hỗ trợ (đăng nhập, upload, báo cáo)', 'Đội hỗ trợ', '01~12/2026', 'Đang thực hiện', ''],
  [4, 'Quản lý dữ liệu', 'Đồng bộ NV chính thức/thời vụ', 'Đội hỗ trợ', '01~12/2026', 'Đang thực hiện', ''],
  [5, 'Phát triển', 'Module Công vụ', 'Đội phát triển', 'Q2/2026', 'Chưa bắt đầu', ''],
  [6, 'Phát triển', 'Module Mua hàng', 'Đội phát triển', 'Q2/2026', 'Chưa bắt đầu', ''],
  [7, 'Phát triển', 'Module EHS', 'Đội phát triển', 'Q3/2026', 'Chưa bắt đầu', ''],
  [8, 'Báo cáo', 'Kiểm tra báo cáo HR Excel 14 loại', 'Đội hỗ trợ', '01~12/2026', 'Đang thực hiện', ''],
  [9, 'Tài liệu', 'Cập nhật danh sách chức năng', 'Đội hỗ trợ', 'Q1/2026', 'Hoàn thành', ''],
  [10, 'Chất lượng', 'Sửa lỗi, tối ưu hiệu năng', 'Đội phát triển', '01~12/2026', 'Đang thực hiện', ''],
];

const wb = XLSX.utils.book_new();
const ws1 = XLSX.utils.aoa_to_sheet(workPlan);
const ws2 = XLSX.utils.aoa_to_sheet(workPlanVN);

ws1['!cols'] = [
  { wch: 5 },   // 번호
  { wch: 14 },  // 업무 분류
  { wch: 42 },  // 업무 내용
  { wch: 10 },  // 담당자
  { wch: 18 },  // 계획 일정
  { wch: 10 },  // 완료 여부
  { wch: 22 },  // 비고
];

ws2['!cols'] = [
  { wch: 5 }, { wch: 16 }, { wch: 38 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
];

XLSX.utils.book_append_sheet(wb, ws1, '26년 지원팀 업무 계획표');
XLSX.utils.book_append_sheet(wb, ws2, 'Kế hoạch (VN)');

const outPath = path.join(__dirname, '..', 'docs', '26년_지원팀_업무_계획표_260227.xlsx');
XLSX.writeFile(wb, outPath);
console.log('✅ Đã tạo file:', outPath);
console.log('   Sheet 1: 26년 지원팀 업무 계획표 (한국어)');
console.log('   Sheet 2: Kế hoạch (Tiếng Việt)');
