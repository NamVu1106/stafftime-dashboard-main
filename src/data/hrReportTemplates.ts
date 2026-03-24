/**
 * Map reportType (menu Nhân sự) ↔ file Excel mẫu trong "New folder".
 * `hasBuiltInGrid=true` cho báo cáo tự sinh từ dữ liệu hệ thống.
 * `hasBuiltInGrid=false` cho báo cáo chỉ xem theo file Excel upload riêng.
 */
export type HrTemplateId =
  | 'temp-timesheet'      // Bảng chốt công Thời vụ
  | 'official-timesheet'  // Chốt công Chính thức
  | 'attendance-count'    // Số lượng đi làm
  | 'attendance-rate'     // Tỉ lệ đi làm
  | 'weekly-one-day'      // Công nhân 1 ngày/tuần
  | 'labor-rate'          // Tỉ lệ nhân lực
  | 'daily-wage'          // Tiền công hàng ngày
  | 'bhxh-list'           // Danh sách BHXH
  | 'insurance-master'    // Bảo hiểm
  | 'payroll'             // Bảng lương
  | 'payroll-kpi'         // Báo cáo KPI (01 월 전체 직원 급여 mẫu KPI.xlsx)
  | 'workforce-summary'   // Báo cáo tổng hợp nhân lực (근태 현황 보고서)
  | 'drug-inventory'      // Kho thuốc
  | 'medical-room-usage'   // Phòng y tế
  | 'arrears-collection'; // Truy thu

export interface HrTemplateMapping {
  reportType: string;
  templateId: HrTemplateId;
  excelFileName: string;
  sheetName: string;
  /** Có API grid từ dữ liệu hệ thống chưa */
  hasBuiltInGrid: boolean;
}

export const HR_REPORT_TEMPLATE_MAP: HrTemplateMapping[] = [
  { reportType: 'temp-timesheet', templateId: 'temp-timesheet', excelFileName: 'Bang chôt cong TV mẫu.xlsx', sheetName: 'Data', hasBuiltInGrid: true },
  { reportType: 'official-timesheet', templateId: 'official-timesheet', excelFileName: 'Chốt công chính thức mẫu.xlsx', sheetName: 'Attendance list', hasBuiltInGrid: true },
  { reportType: 'attendance-count', templateId: 'attendance-count', excelFileName: 'BC SO LUONG DI LAM 012026 - mẫu.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: true },
  { reportType: 'attendance-rate', templateId: 'attendance-rate', excelFileName: 'TI LE DI LAM 01.2026.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: true },
  { reportType: 'weekly-one-day-workers', templateId: 'weekly-one-day', excelFileName: 'BC so luong lam 1 cong trong tuan.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: true },
  { reportType: 'labor-rate', templateId: 'labor-rate', excelFileName: 'BC ti le CC nhan luc .xlsx', sheetName: 'Sheet1', hasBuiltInGrid: true },
  { reportType: 'daily-wage', templateId: 'daily-wage', excelFileName: 'Báo cáo tiền công hàng ngày T1.02 mẫu.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: true },
  { reportType: 'bhxh-list', templateId: 'bhxh-list', excelFileName: 'DANH SACH Tham gia BHXH MẪU..xlsx', sheetName: 'Sheet1', hasBuiltInGrid: false },
  { reportType: 'insurance-master', templateId: 'insurance-master', excelFileName: 'file mẫu bảo hiểm.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: false },
  { reportType: 'payroll', templateId: 'payroll', excelFileName: '01 월 전체 직원 급여 mẫu.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: true },
  { reportType: 'payroll-kpi', templateId: 'payroll-kpi', excelFileName: '01 월 전체 직원 급여 mẫu KPI.xlsx', sheetName: '인건비 현황', hasBuiltInGrid: true },
  { reportType: 'workforce-summary', templateId: 'workforce-summary', excelFileName: '근태 현황 보고서_Rev.3 260209 mẫu.xlsx', sheetName: '근태종합(02월)', hasBuiltInGrid: true },
  { reportType: 'drug-inventory', templateId: 'drug-inventory', excelFileName: 'BÁO CÁO XUẤT NHẬP TỒN THUỐC  mẫuy.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: false },
  { reportType: 'medical-room-usage', templateId: 'medical-room-usage', excelFileName: 'BC hiện trạng sử dụng phòng yte hàng ngày mẫu.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: false },
  { reportType: 'arrears-collection', templateId: 'arrears-collection', excelFileName: 'TRUY THU MẪU -.xlsx', sheetName: 'Sheet1', hasBuiltInGrid: false },
];

export function getTemplateByReportType(reportType: string): HrTemplateMapping | undefined {
  return HR_REPORT_TEMPLATE_MAP.find(m => m.reportType === reportType);
}

export function hasBuiltInGrid(reportType: string): boolean {
  return getTemplateByReportType(reportType)?.hasBuiltInGrid ?? false;
}
