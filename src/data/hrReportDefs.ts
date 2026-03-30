/** Tiêu đề / mô tả từng loại báo cáo HR (tách file để Vite Fast Refresh không báo lỗi) */
export const HR_REPORT_DEFS: Record<
  string,
  { title: string; description: string; defaultRowLimit?: number; defaultColLimit?: number }
> = {
  payroll: {
    title: 'HR - Lương / Thuế / BHXH',
    description: 'Upload và xem các sheet về lương, thuế, BHXH…',
  },
  'payroll-kpi': {
    title: 'HR - Báo cáo KPI nhân sự',
    description: 'KPI phòng nhân sự theo ngày: số NV đi làm, OT, tỉ lệ… Tự tính từ dữ liệu chấm công.',
    defaultRowLimit: 50,
    defaultColLimit: 45,
  },
  'workforce-summary': {
    title: 'HR - Báo cáo tổng hợp nhân lực',
    description:
      '근태 현황 보고서: tổng hợp nhân lực, 출근인원, 출근율, 퇴사인원, 부서별 출근 현황. Tự tính từ dữ liệu chấm công.',
    defaultRowLimit: 100,
    defaultColLimit: 60,
  },
  'temp-timesheet': {
    title: 'HR - Bảng chốt công Thời vụ',
    description: 'Tự tính từ dữ liệu chấm công theo kỳ lọc. Có thể upload file Excel bổ sung thêm.',
    defaultRowLimit: 200,
    defaultColLimit: 60,
  },
  'daily-wage': {
    title: 'HR - Báo cáo tiền công hàng ngày',
    description: 'Tự tính từ dữ liệu chấm công theo kỳ lọc. Có thể upload file Excel bổ sung.',
  },
  'drug-inventory': {
    title: 'HR - Xuất nhập tồn thuốc',
    description: 'Upload và xem báo cáo xuất/nhập/tồn thuốc theo tháng.',
  },
  'medical-room-usage': {
    title: 'HR - Hiện trạng sử dụng phòng y tế',
    description: 'Upload và xem báo cáo phòng y tế (ưu tiên các sheet báo cáo).',
  },
  'attendance-count': {
    title: 'HR - Số lượng đi làm',
    description:
      'Tự tính từ chấm công theo kỳ lọc: mỗi ngày CT/TV = số người ca ngày + ca đêm (theo shift/giờ vào). NV mới: ngày vào làm trùng ngày công (ưu tiên ngày vào trong DS CT/TV đã import).',
    defaultRowLimit: 100,
    defaultColLimit: 200,
  },
  'weekly-one-day-workers': {
    title: 'HR - Thời vụ làm 1 công/tuần',
    description: 'Tự tính từ dữ liệu chấm công — NV thời vụ chỉ có 1 ngày công trong tuần.',
  },
  'labor-rate': {
    title: 'HR - Tỉ lệ nhân lực',
    description: 'Tự tính từ dữ liệu chấm công — tỉ lệ đi làm so với tổng biên chế.',
  },
  'official-timesheet': {
    title: 'HR - Chốt công Chính thức',
    description: 'Tự tính từ dữ liệu chấm công — bảng chốt công nhân viên chính thức theo kỳ.',
  },
  'bhxh-list': {
    title: 'HR - Danh sách tham gia BHXH',
    description: 'Upload và xem danh sách tham gia BHXH (tăng/giảm…).',
  },
  'insurance-master': {
    title: 'HR - Biểu mẫu bảo hiểm',
    description: 'Upload và xem các sheet dữ liệu/bảng kê/tổng hợp bảo hiểm.',
  },
  'attendance-rate': {
    title: 'HR - Tỉ lệ đi làm',
    description:
      'Báo cáo nhóm theo NCC từ dữ liệu chấm công trong kỳ lọc. Khung gán Vendor (Mã NV → NCC) được quản lý trực tiếp ngay trong trang này.',
    defaultRowLimit: 60,
    defaultColLimit: 200,
  },
  'arrears-collection': {
    title: 'HR - Truy thu',
    description: 'Upload và xem biểu mẫu truy thu theo tháng.',
  },
};
