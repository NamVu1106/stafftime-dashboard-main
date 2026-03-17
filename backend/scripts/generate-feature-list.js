/**
 * Script tạo file Excel danh sách chức năng chi tiết
 * Chạy: node scripts/generate-feature-list.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const features = [
  ['STT', 'Nhóm chức năng', 'Chức năng', 'Mô tả chi tiết', 'Trạng thái', 'Đường dẫn/Route', 'Ghi chú'],
  [1, 'Đăng nhập & Xác thực', 'Đăng nhập', 'Form đăng nhập với username/password', 'Hoàn thành', '/login', ''],
  [2, 'Đăng nhập & Xác thực', 'Remember me', 'Lưu tên đăng nhập khi tick Remember', 'Hoàn thành', '/login', ''],
  [3, 'Đăng nhập & Xác thực', 'Quên mật khẩu', 'Reset mật khẩu về mặc định qua username', 'Hoàn thành', '/login', ''],
  [4, 'Đăng nhập & Xác thực', 'Bảo vệ route', 'Chỉ cho phép truy cập khi đã đăng nhập', 'Hoàn thành', 'ProtectedRoute', ''],
  [5, 'Đăng nhập & Xác thực', 'Đăng xuất', 'Nút đăng xuất trên TopBar', 'Hoàn thành', '', ''],
  [6, 'Đa ngôn ngữ', 'Chuyển đổi Tiếng Việt / Tiếng Hàn', 'Dropdown chọn ngôn ngữ với cờ VN và KR', 'Hoàn thành', 'TopBar', ''],
  [7, 'Đa ngôn ngữ', 'Lưu ngôn ngữ', 'Lưu lựa chọn ngôn ngữ vào localStorage', 'Hoàn thành', '', ''],
  [8, 'Trang chủ', 'Dashboard tổng quan', 'Trang chủ với thống kê tổng hợp', 'Hoàn thành', '/', ''],
  [9, 'Trang chủ', 'Bộ lọc thời gian', 'Hôm nay / Tháng này / Năm này / 1 ngày / Giai đoạn', 'Hoàn thành', 'Sidebar', ''],
  [10, 'Trang chủ', 'Popup chọn phòng ban', 'Hover vào Kế toán Hành chính Nhân sự... hiện popup chọn chức năng', 'Hoàn thành', 'TopBar', ''],
  [11, 'Trang chủ', 'Notice', 'Danh sách thông báo (đồng bộ upload, nhân viên đi trễ...)', 'Hoàn thành', '/', ''],
  [12, 'Trang chủ', 'Favorites & Recent', 'Khung Favorites và Recent links', 'Hoàn thành', '/', ''],
  [13, 'Trang chủ', 'Thống kê chấm công', 'Tổng NV, đi làm, tỷ lệ đi làm, đi trễ, giờ làm', 'Hoàn thành', '/', ''],
  [14, 'Trang chủ', 'Thống kê HR Excel', 'Tỉ lệ đi làm, Số lượng đi làm, Người mới, Bảo hiểm, Công TV, Công CT', 'Hoàn thành', '/', ''],
  [15, 'Trang chủ', 'Phân bổ Nam/Nữ', 'Chính thức / Thời vụ theo giới tính', 'Hoàn thành', '/', ''],
  [16, 'Trang chủ', 'Biểu đồ tỷ lệ đi làm theo bộ phận', 'Chart theo phòng ban', 'Hoàn thành', '/', ''],
  [17, 'Trang chủ', 'Biểu đồ 7 ngày gần nhất', 'Số lượng đi làm 7 ngày', 'Hoàn thành', '/', ''],
  [18, 'Trang chủ', 'Hoạt động chấm công gần đây', 'Bảng gần đây', 'Hoàn thành', '/', ''],
  [19, 'Kế toán', 'Tổng quan Kế toán', 'Dashboard BHXH, Thuế, Tiền công, Truy thu', 'Hoàn thành', '/ (tab Kế toán)', ''],
  [20, 'Kế toán', 'BHXH', 'Thẻ BHXH phải nộp từ Excel', 'Hoàn thành', '/', ''],
  [21, 'Kế toán', 'Lương/Thuế/BHXH', 'Báo cáo lương thuế bảo hiểm', 'Hoàn thành', '/', ''],
  [22, 'Kế toán', 'Tiền công hàng ngày', 'Thẻ tiền công hàng ngày', 'Hoàn thành', '/', ''],
  [23, 'Kế toán', 'Truy thu', 'Thẻ truy thu', 'Hoàn thành', '/', ''],
  [24, 'Hành chính', 'Tổng quan Hành chính', 'Dashboard Thuốc, Phòng y tế', 'Hoàn thành', '/ (tab Hành chính)', ''],
  [25, 'Hành chính', 'Thuốc', 'Xuất nhập tồn thuốc (xuất qty)', 'Hoàn thành', '/', ''],
  [26, 'Hành chính', 'Phòng y tế', 'Tổng tiền sử dụng phòng y tế', 'Hoàn thành', '/', ''],
  [27, 'Hành chính', 'Phòng ban', 'Danh sách phòng ban', 'Hoàn thành', '/departments', ''],
  [28, 'Hành chính', 'Upload Data', 'Upload file nhân viên và chấm công', 'Hoàn thành', '/upload', ''],
  [29, 'Hành chính', 'Lịch sử', 'Lịch sử chấm công đã lưu', 'Hoàn thành', '/history', ''],
  [30, 'Nhân sự', 'Tổng quan Nhân sự', 'Dashboard HR', 'Hoàn thành', '/ (tab Nhân sự)', ''],
  [31, 'Nhân sự', 'Danh sách nhân viên', 'Xem danh sách, thêm sửa xóa nhân viên', 'Hoàn thành', '/employees', ''],
  [32, 'Nhân sự', 'Thêm nhân viên', 'Form thêm nhân viên mới', 'Hoàn thành', '/employees/new', ''],
  [33, 'Nhân sự', 'Báo cáo theo ngày', 'Báo cáo chấm công theo ngày', 'Hoàn thành', '/reports/day', ''],
  [34, 'Nhân sự', 'Báo cáo theo tháng', 'Báo cáo chấm công theo tháng', 'Hoàn thành', '/reports/month', ''],
  [35, 'Nhân sự', 'Báo cáo theo năm', 'Báo cáo chấm công theo năm', 'Hoàn thành', '/reports/year', ''],
  [36, 'Nhân sự', 'Báo cáo theo giai đoạn', 'Báo cáo theo khoảng thời gian', 'Hoàn thành', '/reports/range', ''],
  [37, 'Nhân sự', 'So sánh báo cáo', 'So sánh giữa các phòng ban hoặc giai đoạn', 'Hoàn thành', '/reports/compare', ''],
  [38, 'Nhân sự', 'Công nhân thời vụ 1 ngày', 'Báo cáo theo ngày', 'Hoàn thành', '/reports/weekly-temporary-workers', ''],
  [39, 'Nhân sự', 'Tỉ lệ đi làm (Excel)', 'Upload và xem báo cáo tỉ lệ đi làm', 'Hoàn thành', 'Inline', ''],
  [40, 'Nhân sự', 'Chốt công thời vụ', 'Upload và xem bảng chốt công thời vụ', 'Hoàn thành', 'Inline', ''],
  [41, 'Nhân sự', 'Chốt công chính thức', 'Upload và xem bảng chốt công chính thức', 'Hoàn thành', 'Inline', ''],
  [42, 'Nhân sự', 'Bảo hiểm', 'Upload và xem biểu mẫu bảo hiểm', 'Hoàn thành', 'Inline', ''],
  [43, 'Nhân sự', 'Số lượng đi làm', 'Upload và xem báo cáo số lượng đi làm', 'Hoàn thành', 'Inline', ''],
  [44, 'Nhân sự', 'Công nhân 1 ngày/tuần', 'Upload và xem báo cáo 1 công/tuần', 'Hoàn thành', 'Inline', ''],
  [45, 'Nhân sự', 'Tiền công', 'Upload và xem báo cáo tiền công hàng ngày', 'Hoàn thành', 'Inline', ''],
  [46, 'Nhân sự', 'Tỷ lệ lao động', 'Upload và xem báo cáo tỉ lệ nhân lực', 'Hoàn thành', 'Inline', ''],
  [47, 'Nhân sự', 'Danh sách BHXH', 'Upload và xem danh sách tham gia BHXH', 'Hoàn thành', 'Inline', ''],
  [48, 'Nhân sự', 'Bảng lương', 'Upload và xem bảng lương', 'Hoàn thành', 'Inline', ''],
  [49, 'Nhân sự', 'Kho thuốc', 'Upload và xem xuất nhập tồn thuốc', 'Hoàn thành', 'Inline', ''],
  [50, 'Nhân sự', 'Sử dụng phòng y tế', 'Upload và xem báo cáo phòng y tế', 'Hoàn thành', 'Inline', ''],
  [51, 'Nhân sự', 'Truy thu', 'Upload và xem biểu mẫu truy thu', 'Hoàn thành', 'Inline', ''],
  [52, 'Công vụ', 'Mục', 'Công vụ', 'Đang phát triển', 'Popup', ''],
  [53, 'Mua hàng', 'Mục', 'Mua hàng', 'Đang phát triển', 'Popup', ''],
  [54, 'EHS', 'Mục', 'EHS', 'Đang phát triển', 'Popup', ''],
  [55, 'Upload', 'Upload nhân viên chính thức', 'Upload Excel nhân viên chính thức', 'Hoàn thành', '/upload', ''],
  [56, 'Upload', 'Upload nhân viên thời vụ', 'Upload Excel nhân viên thời vụ', 'Hoàn thành', '/upload', ''],
  [57, 'Upload', 'Upload nhân viên (chung)', 'Upload Excel không phân biệt chính thức/thời vụ', 'Hoàn thành', '/upload', ''],
  [58, 'Upload', 'Upload chấm công', 'Upload Excel dữ liệu chấm công', 'Hoàn thành', '/upload', ''],
  [59, 'Upload', 'Upload HR Excel', 'Upload từng loại báo cáo HR (14 loại)', 'Hoàn thành', 'Inline', ''],
  [60, 'Nhân viên', 'Danh sách nhân viên', 'Bảng danh sách với filter tìm kiếm', 'Hoàn thành', '/employees', ''],
  [61, 'Nhân viên', 'Thêm nhân viên', 'Form thêm với thông tin cá nhân, gia đình', 'Hoàn thành', '/employees/new', ''],
  [62, 'Nhân viên', 'Sửa nhân viên', 'Form sửa thông tin', 'Hoàn thành', '/employees', ''],
  [63, 'Nhân viên', 'Xóa nhân viên', 'Xóa 1 hoặc xóa tất cả', 'Hoàn thành', '/employees', ''],
  [64, 'Nhân viên', 'Export Excel', 'Xuất danh sách ra Excel', 'Hoàn thành', '/employees', ''],
  [65, 'Nhân viên', 'Filter phòng ban', 'Lọc theo phòng ban', 'Hoàn thành', '/employees', ''],
  [66, 'Nhân viên', 'Thông tin gia đình', 'Quan hệ, nghề nghiệp', 'Hoàn thành', '/employees', ''],
  [67, 'Lịch sử', 'Lịch sử chấm công', 'Xem, xóa dữ liệu chấm công đã lưu', 'Hoàn thành', '/history', ''],
  [68, 'Lịch sử', 'Filter theo thời gian', 'Từ ngày đến ngày', 'Hoàn thành', '/history', ''],
  [69, 'Lịch sử', 'Filter theo phòng ban', 'Chọn phòng ban', 'Hoàn thành', '/history', ''],
  [70, 'Lịch sử', 'Xóa từng bản ghi', 'Xóa 1 bản ghi', 'Hoàn thành', '/history', ''],
  [71, 'Lịch sử', 'Xóa tất cả', 'Xóa toàn bộ lịch sử', 'Hoàn thành', '/history', ''],
  [72, 'Lịch sử sửa đổi', 'Lịch sử sửa đổi', 'Bảng lịch sử sửa đổi YS-Smart', 'Hoàn thành', '/revision-history', ''],
  [73, 'Real-time', 'Real-time Dashboard', 'Theo dõi chấm công theo thời gian thực', 'Hoàn thành', '/realtime', ''],
  [74, 'Real-time', 'Bộ lọc thời gian', 'Từ giờ đến giờ', 'Hoàn thành', '/realtime', ''],
  [75, 'Real-time', 'Tự động làm mới', 'Interval refresh', 'Hoàn thành', '/realtime', ''],
  [76, 'Phòng ban', 'Danh sách phòng ban', 'Chọn phòng ban xem thống kê', 'Hoàn thành', '/departments', ''],
  [77, 'Phòng ban', 'Chi tiết phòng ban', 'Thống kê, biểu đồ theo phòng ban', 'Hoàn thành', '/departments/:dept', ''],
  [78, 'Báo cáo', 'So sánh báo cáo', 'So sánh phòng ban hoặc giai đoạn', 'Hoàn thành', '/reports/compare', ''],
  [79, 'Thông báo', 'Danh sách thông báo', 'Xem thông báo trong TopBar', 'Hoàn thành', 'TopBar', ''],
  [80, 'Thông báo', 'Đánh dấu đã đọc', 'Mark as read', 'Hoàn thành', 'TopBar', ''],
  [81, 'Thông báo', 'Xóa thông báo', 'Xóa 1 hoặc xóa tất cả', 'Hoàn thành', 'TopBar', ''],
  [82, 'Thông báo', 'Badge số chưa đọc', 'Hiển thị số thông báo chưa đọc', 'Hoàn thành', 'TopBar', ''],
  [83, 'Tìm kiếm', 'Tìm kiếm nhanh', 'Ô tìm kiếm trên TopBar', 'Hoàn thành', 'TopBar', ''],
  [84, 'Giao diện', 'Sidebar thu gọn', 'Thu gọn, mở rộng sidebar', 'Hoàn thành', '', ''],
  [85, 'Giao diện', 'Responsive', 'Giao diện mobile/tablet', 'Hoàn thành', '', ''],
  [86, 'Giao diện', 'Download Excel menu', 'Xuất cấu trúc menu ra Excel', 'Hoàn thành', 'Popup', ''],
  [87, 'Login', 'Carousel ảnh', '3 ảnh chuyển mỗi 2s', 'Hoàn thành', '/login', ''],
  [88, 'Login', '3 chấm', 'Animation chọn slide', 'Hoàn thành', '/login', ''],
  [89, 'Login', 'Layout', 'Panel trái xanh, panel phải form', 'Hoàn thành', '/login', ''],
];

const apiEndpoints = [
  ['STT', 'Module', 'Method', 'Endpoint', 'Mô tả'],
  [1, 'Auth', 'POST', '/api/auth/login', 'Đăng nhập'],
  [2, 'Auth', 'POST', '/api/auth/forgot-password', 'Quên mật khẩu'],
  [3, 'Employees', 'GET', '/api/employees', 'Lấy danh sách nhân viên'],
  [4, 'Employees', 'GET', '/api/employees/official', 'Nhân viên chính thức'],
  [5, 'Employees', 'GET', '/api/employees/seasonal', 'Nhân viên thời vụ'],
  [6, 'Employees', 'GET', '/api/employees/:id', 'Chi tiết nhân viên'],
  [7, 'Employees', 'POST', '/api/employees', 'Tạo nhân viên'],
  [8, 'Employees', 'PUT', '/api/employees/:id', 'Cập nhật nhân viên'],
  [9, 'Employees', 'DELETE', '/api/employees/:id', 'Xóa nhân viên'],
  [10, 'Timekeeping', 'GET', '/api/timekeeping', 'Lấy dữ liệu chấm công'],
  [11, 'Upload', 'POST', '/api/upload/employees', 'Upload nhân viên (chung)'],
  [12, 'Upload', 'POST', '/api/upload/employees/official', 'Upload nhân viên chính thức'],
  [13, 'Upload', 'POST', '/api/upload/employees/seasonal', 'Upload nhân viên thời vụ'],
  [14, 'Upload', 'POST', '/api/upload/timekeeping', 'Upload chấm công'],
  [15, 'Statistics', 'GET', '/api/statistics/dashboard', 'Thống kê dashboard'],
  [16, 'Statistics', 'GET', '/api/statistics/department', 'Thống kê theo phòng ban'],
  [17, 'Statistics', 'GET', '/api/statistics/realtime', 'Real-time'],
  [18, 'Statistics', 'GET', '/api/statistics/range', 'Thống kê theo khoảng'],
  [19, 'Statistics', 'GET', '/api/statistics/compare', 'So sánh'],
  [20, 'Statistics', 'GET', '/api/departments', 'Danh sách phòng ban'],
  [21, 'Statistics', 'GET', '/api/departments/:dept/stats', 'Thống kê 1 phòng ban'],
  [22, 'Notifications', 'GET', '/api/notifications', 'Danh sách thông báo'],
  [23, 'Notifications', 'PUT', '/api/notifications/:id/read', 'Đánh dấu đã đọc'],
  [24, 'Notifications', 'DELETE', '/api/notifications', 'Xóa thông báo'],
  [25, 'HR Excel', 'POST', '/api/hr-excel/upload', 'Upload file HR Excel'],
  [26, 'HR Excel', 'GET', '/api/hr-excel/stats', 'Thống kê theo report_type'],
];

const tech = [
  ['Hạng mục', 'Công nghệ', 'Ghi chú'],
  ['Frontend', 'React 18 + TypeScript', ''],
  ['Frontend', 'Vite 5', 'Build tool'],
  ['Frontend', 'React Router 6', ''],
  ['Frontend', 'TanStack React Query', 'Data fetching'],
  ['Frontend', 'Tailwind CSS + Radix UI', 'UI'],
  ['Frontend', 'Recharts', 'Biểu đồ'],
  ['Frontend', 'XLSX', 'Xuất Excel'],
  ['Backend', 'Node.js + Express', ''],
  ['Backend', 'Prisma + PostgreSQL', 'Database'],
  ['Backend', 'JWT', 'Xác thực'],
];

const wb = XLSX.utils.book_new();
const ws1 = XLSX.utils.aoa_to_sheet(features);
const ws2 = XLSX.utils.aoa_to_sheet(apiEndpoints);
const ws3 = XLSX.utils.aoa_to_sheet(tech);

XLSX.utils.book_append_sheet(wb, ws1, 'Danh sách chức năng');
XLSX.utils.book_append_sheet(wb, ws2, 'API Endpoints');
XLSX.utils.book_append_sheet(wb, ws3, 'Công nghệ');

const outPath = path.join(__dirname, '..', 'docs', 'YS-Smart_DanhSachChucNang.xlsx');
XLSX.writeFile(wb, outPath);
console.log('✅ Đã tạo file:', outPath);
