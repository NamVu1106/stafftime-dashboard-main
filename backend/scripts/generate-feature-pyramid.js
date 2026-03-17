/**
 * Script tạo file Excel cấu trúc THÁP - chi tiết: làm gì, tác dụng, trạng thái, route, ghi chú
 * Chạy: node scripts/generate-feature-pyramid.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cấu trúc: [Cấp, Phòng ban, Chức năng, Khi click → Làm gì, Tác dụng, Trạng thái, Route, Ghi chú]
const pyramid = [
  ['Cấp', 'Phòng ban / Nhóm', 'Chức năng', 'Khi click vào → Chức năng làm gì', 'Tác dụng', 'Trạng thái', 'Đường dẫn / Route', 'Ghi chú'],
  // === CẤP 1: HỆ THỐNG ===
  [1, 'YS-Smart', 'Hệ thống quản lý chấm công', '—', 'Nền tảng tổng thể You Sung Vina', 'Hoàn thành', '/', ''],
  [2, '', 'Đăng nhập', 'Hiển thị form nhập username/password, gửi API xác thực JWT, lưu token', 'Truy cập vào hệ thống, bảo mật', 'Hoàn thành', '/login', 'Có Remember me'],
  [2, '', 'Quên mật khẩu', 'Nhập username → Gọi API reset về mật khẩu mặc định', 'Khôi phục truy cập khi quên mật khẩu', 'Hoàn thành', '/login', ''],
  [2, '', 'Đăng xuất', 'Xóa token khỏi localStorage, chuyển về /login', 'Thoát phiên làm việc an toàn', 'Hoàn thành', 'TopBar', ''],
  [2, '', 'Đa ngôn ngữ (VN/KR)', 'Dropdown chọn ngôn ngữ → Chuyển toàn bộ giao diện, lưu vào localStorage', 'Phục vụ đa quốc gia', 'Hoàn thành', 'TopBar', ''],
  [2, '', 'Bảo vệ route', 'Chưa đăng nhập → Redirect về /login', 'Chỉ cho phép truy cập khi đã đăng nhập', 'Hoàn thành', 'ProtectedRoute', ''],
  // === CẤP 1: TRANG CHỦ ===
  [1, 'Trang chủ', 'Dashboard tổng quan', '—', 'Màn hình chính sau đăng nhập', 'Hoàn thành', '/', ''],
  [2, '', 'Bộ lọc thời gian', 'Chọn Hôm nay / Tháng này / Năm này / 1 ngày / Giai đoạn → Gọi API lọc, cập nhật toàn bộ thẻ và biểu đồ', 'Xem số liệu theo khoảng thời gian mong muốn', 'Hoàn thành', 'Sidebar', ''],
  [2, '', 'Popup chọn phòng ban', 'Hover vào Kế toán/Hành chính/Nhân sự/Công vụ/Mua hàng/EHS → Hiện popup 4 cột chức năng, click mở trang tương ứng', 'Truy cập nhanh chức năng theo phòng ban', 'Hoàn thành', 'TopBar', ''],
  [2, '', 'Notice', 'Hiển thị danh sách thông báo: đồng bộ NV, đi trễ, upload thành công...', 'Nắm sự kiện gần đây', 'Hoàn thành', '/', ''],
  [2, '', 'Favorites & Recent', 'Khung Favorites (đánh dấu yêu thích) và Recent links (đã truy cập gần đây)', 'Truy cập nhanh trang thường dùng', 'Hoàn thành', '/', ''],
  [2, '', 'Thống kê chấm công', '5 thẻ: Tổng NV, Đi làm, Tỷ lệ đi làm, Đi trễ, Tổng giờ làm', 'Đánh giá nhanh tình hình chấm công', 'Hoàn thành', '/', ''],
  [2, '', 'Thống kê HR Excel', '6 thẻ KPI từ file Excel upload: Tỉ lệ đi làm, Số lượng đi làm, Người mới, Bảo hiểm, Công TV, Công CT', 'Theo dõi chỉ số nhân sự từ Excel', 'Hoàn thành', '/', ''],
  [2, '', 'Phân bổ Nam/Nữ', 'Biểu đồ tròn: Chính thức / Thời vụ theo giới tính', 'Nắm cơ cấu nhân sự', 'Hoàn thành', '/', ''],
  [2, '', 'Biểu đồ tỷ lệ theo bộ phận', 'Chart cột thể hiện tỷ lệ đi làm từng phòng ban', 'So sánh hiệu suất các bộ phận', 'Hoàn thành', '/', ''],
  [2, '', 'Biểu đồ 7 ngày gần nhất', 'Chart số lượng đi làm 7 ngày', 'Xu hướng chấm công tuần', 'Hoàn thành', '/', ''],
  [2, '', 'Hoạt động chấm công gần đây', 'Bảng 15 bản ghi mới nhất: NV, ngày, giờ vào/ra, tổng giờ', 'Kiểm tra chi tiết chấm công', 'Hoàn thành', '/', ''],
  // === CẤP 1: KẾ TOÁN ===
  [1, 'Kế toán', 'Quản lý tài chính nhân sự', '—', 'Module BHXH, Thuế, Lương, Truy thu', 'Hoàn thành', '/', ''],
  [2, '', 'Tổng quan', 'Hiển thị dashboard 4 thẻ: BHXH, Lương/Thuế, Tiền công, Truy thu (dữ liệu từ Excel upload tại Nhân sự)', 'Nắm tổng quan tài chính HR', 'Hoàn thành', '/', 'Tab Kế toán'],
  [2, '', 'BHXH', 'Hiển thị số tiền BHXH phải nộp từ file Excel', 'Theo dõi nghĩa vụ BHXH', 'Hoàn thành', '/', ''],
  [2, '', 'Lương/Thuế/BHXH', 'Hiển thị báo cáo lương, thuế TNCN, BHXH từ Excel', 'Phục vụ kế toán lương', 'Hoàn thành', '/', ''],
  [2, '', 'Tiền công hàng ngày', 'Hiển thị số liệu tiền công từ file upload', 'Theo dõi chi phí nhân công', 'Hoàn thành', '/', ''],
  [2, '', 'Truy thu', 'Hiển thị biểu mẫu truy thu từ Excel', 'Xử lý truy thu lương', 'Hoàn thành', '/', ''],
  // === CẤP 1: HÀNH CHÍNH ===
  [1, 'Hành chính', 'Quản lý hành chính nội bộ', '—', 'Thuốc, Phòng y tế, Phòng ban, Upload', 'Hoàn thành', '/', ''],
  [2, '', 'Tổng quan', 'Hiển thị dashboard Thuốc (xuất qty), Phòng y tế (tổng tiền)', 'Nắm tình hình y tế nội bộ', 'Hoàn thành', '/', 'Tab Hành chính'],
  [2, '', 'Thuốc', 'Hiển thị xuất nhập tồn thuốc từ Excel', 'Quản lý kho thuốc', 'Hoàn thành', '/', ''],
  [2, '', 'Phòng y tế', 'Hiển thị tổng tiền sử dụng phòng y tế', 'Theo dõi chi phí y tế', 'Hoàn thành', '/', ''],
  [2, '', 'Phòng ban', 'Mở trang danh sách phòng ban, chọn xem thống kê chi tiết', 'Phân tích theo phòng ban', 'Hoàn thành', '/departments', ''],
  [2, '', 'Upload Data', 'Mở trang upload file nhân viên + chấm công Excel', 'Import dữ liệu vào hệ thống', 'Hoàn thành', '/upload', ''],
  [2, '', 'Lịch sử', 'Mở trang lịch sử chấm công đã lưu, xem/xóa', 'Quản lý dữ liệu lưu trữ', 'Hoàn thành', '/history', ''],
  [2, '', 'Lịch sử sửa đổi', 'Bảng lịch sử sửa đổi YS-Smart', 'Theo dõi thay đổi hệ thống', 'Hoàn thành', '/revision-history', ''],
  // === CẤP 1: NHÂN SỰ ===
  [1, 'Nhân sự', 'Quản lý nhân sự & báo cáo HR', '—', '22 chức năng: NV, Báo cáo, HR Excel', 'Hoàn thành', '/', ''],
  [2, '', 'Tổng quan', 'Hiển thị dashboard HR với các KPI từ Excel', 'Nắm tổng quan nhân sự', 'Hoàn thành', '/', 'Tab Nhân sự'],
  [2, '', 'Danh sách nhân viên', 'Mở trang /employees: bảng NV, filter, tìm kiếm, CRUD, Export Excel', 'Quản lý hồ sơ nhân viên', 'Hoàn thành', '/employees', ''],
  [2, '', 'Thêm nhân viên', 'Mở form thêm NV mới: CCCD, tên, giới tính, ngày sinh, phòng ban, thông tin gia đình', 'Đăng ký nhân viên mới', 'Hoàn thành', '/employees/new', ''],
  [2, '', 'Báo cáo theo ngày', 'Mở trang báo cáo chấm công 1 ngày, filter phòng ban', 'Xem chi tiết chấm công theo ngày', 'Hoàn thành', '/reports/day', ''],
  [2, '', 'Báo cáo theo tháng', 'Mở trang báo cáo chấm công 1 tháng', 'Tổng hợp theo tháng', 'Hoàn thành', '/reports/month', ''],
  [2, '', 'Báo cáo theo năm', 'Mở trang báo cáo chấm công 1 năm', 'Tổng hợp theo năm', 'Hoàn thành', '/reports/year', ''],
  [2, '', 'Báo cáo theo giai đoạn', 'Mở trang báo cáo theo khoảng ngày tùy chọn', 'Báo cáo tùy chỉnh', 'Hoàn thành', '/reports/range', ''],
  [2, '', 'So sánh báo cáo', 'Mở trang so sánh giữa phòng ban hoặc giai đoạn', 'Phân tích so sánh', 'Hoàn thành', '/reports/compare', ''],
  [2, '', 'Công nhân thời vụ 1 ngày', 'Mở trang báo cáo NV thời vụ làm 1 ngày', 'Theo dõi lao động thời vụ', 'Hoàn thành', '/reports/weekly-temporary-workers', ''],
  [2, '', 'Tỉ lệ đi làm', 'Upload Excel + chọn Vendor, tháng/tuần → Xem báo cáo tỉ lệ đi làm', 'Đánh giá tỷ lệ chuyên cần', 'Hoàn thành', 'Inline (popup Nhân sự)', ''],
  [2, '', 'Chốt công thời vụ', 'Upload Excel → Xem bảng chốt công thời vụ', 'Xác nhận công thời vụ', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Chốt công chính thức', 'Upload Excel → Xem bảng chốt công chính thức', 'Xác nhận công chính thức', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Bảo hiểm', 'Upload Excel → Xem biểu mẫu/bảng kê bảo hiểm', 'Quản lý dữ liệu bảo hiểm', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Số lượng đi làm', 'Upload Excel → Xem báo cáo số lượng đi làm', 'Thống kê ngày công', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Công nhân 1 ngày/tuần', 'Upload Excel → Xem báo cáo NV làm 1 công/tuần', 'Theo dõi lao động bán thời gian', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Tiền công', 'Upload Excel → Xem báo cáo tiền công hàng ngày', 'Theo dõi chi phí lương', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Tỷ lệ lao động', 'Upload Excel → Xem báo cáo tỉ lệ nhân lực', 'Phân tích nhân lực', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Danh sách BHXH', 'Upload Excel → Xem danh sách tham gia BHXH (tăng/giảm)', 'Quản lý BHXH', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Bảng lương', 'Upload Excel → Xem bảng lương', 'Xem bảng lương', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Kho thuốc', 'Upload Excel → Xem xuất nhập tồn thuốc', 'Quản lý kho thuốc (HR)', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Sử dụng phòng y tế', 'Upload Excel → Xem báo cáo phòng y tế', 'Theo dõi sử dụng phòng y tế', 'Hoàn thành', 'Inline', ''],
  [2, '', 'Truy thu', 'Upload Excel → Xem biểu mẫu truy thu', 'Xử lý truy thu', 'Hoàn thành', 'Inline', ''],
  // === CẤP 1: CÔNG VỤ / MUA HÀNG / EHS ===
  [1, 'Công vụ', '—', 'Click → Hiện thông báo "Chức năng đang phát triển"', 'Dự kiến phát triển', 'Đang phát triển', 'Popup', 'Chưa có trang'],
  [1, 'Mua hàng', '—', 'Click → Hiện thông báo "Chức năng đang phát triển"', 'Dự kiến phát triển', 'Đang phát triển', 'Popup', 'Chưa có trang'],
  [1, 'EHS', '—', 'Click → Hiện thông báo "Chức năng EHS đang phát triển"', 'Dự kiến phát triển', 'Đang phát triển', 'Popup', 'Chưa có trang'],
  // === CẤP 1: UPLOAD ===
  [1, 'Upload', 'Import dữ liệu', '—', 'Tải file Excel vào hệ thống', 'Hoàn thành', '/upload', ''],
  [2, '', 'Upload nhân viên chính thức', 'Chọn file Excel → Upload → Gọi API → Đồng bộ NV chính thức vào DB', 'Cập nhật danh sách NV chính thức', 'Hoàn thành', '/upload', ''],
  [2, '', 'Upload nhân viên thời vụ', 'Chọn file Excel → Upload → Gọi API → Đồng bộ NV thời vụ vào DB', 'Cập nhật danh sách NV thời vụ', 'Hoàn thành', '/upload', ''],
  [2, '', 'Upload nhân viên (chung)', 'Chọn file Excel → Upload → Đồng bộ không phân biệt loại', 'Import nhanh khi file không phân loại', 'Hoàn thành', '/upload', ''],
  [2, '', 'Upload chấm công', 'Chọn file Excel chấm công → Upload → Lưu vào DB, tạo thông báo', 'Cập nhật dữ liệu chấm công', 'Hoàn thành', '/upload', ''],
  [2, '', 'Upload HR Excel (14 loại)', 'Mỗi chức năng HR có nút Upload → Chọn file → Parse sheet → Hiển thị bảng', 'Cập nhật từng loại báo cáo HR', 'Hoàn thành', 'Inline', ''],
  // === CẤP 1: NHÂN VIÊN (trang /employees) ===
  [1, 'Trang Nhân viên', 'CRUD nhân viên', '—', 'Khi click Danh sách nhân viên hoặc Thêm nhân viên', 'Hoàn thành', '/employees', ''],
  [2, '', 'Xem danh sách', 'Hiển thị bảng NV, phân trang, sort theo cột', 'Tra cứu nhân viên', 'Hoàn thành', '/employees', ''],
  [2, '', 'Tìm kiếm', 'Nhập tên/mã vào ô tìm kiếm → Lọc danh sách real-time', 'Tìm nhanh nhân viên', 'Hoàn thành', '/employees', ''],
  [2, '', 'Filter phòng ban', 'Chọn phòng ban từ dropdown → Lọc danh sách', 'Xem NV theo phòng ban', 'Hoàn thành', '/employees', ''],
  [2, '', 'Thêm nhân viên', 'Điền form: CCCD, tên, giới tính, ngày sinh, phòng ban, thông tin gia đình (quan hệ, nghề nghiệp) → Submit', 'Đăng ký NV mới', 'Hoàn thành', '/employees/new', ''],
  [2, '', 'Sửa nhân viên', 'Click Sửa → Mở form chỉnh sửa thông tin → Submit', 'Cập nhật hồ sơ', 'Hoàn thành', '/employees', ''],
  [2, '', 'Xóa nhân viên', 'Click Xóa → Xác nhận → Xóa 1 hoặc xóa tất cả (nếu chọn nhiều)', 'Loại bỏ NV khỏi hệ thống', 'Hoàn thành', '/employees', ''],
  [2, '', 'Export Excel', 'Click Export → Tải file Excel danh sách NV hiện tại', 'Xuất dữ liệu ra Excel', 'Hoàn thành', '/employees', ''],
  [2, '', 'Thông tin gia đình', 'Form có trường: quan hệ, nghề nghiệp người thân', 'Quản lý thông tin phụ thuộc', 'Hoàn thành', '/employees', ''],
  // === CẤP 1: LỊCH SỬ ===
  [1, 'Lịch sử chấm công', 'Quản lý dữ liệu đã lưu', '—', 'Xem/xóa dữ liệu chấm công lưu trữ', 'Hoàn thành', '/history', ''],
  [2, '', 'Xem lịch sử', 'Bảng dữ liệu chấm công: NV, ngày, giờ vào/ra, tổng giờ, phòng ban...', 'Kiểm tra dữ liệu đã lưu', 'Hoàn thành', '/history', ''],
  [2, '', 'Filter thời gian', 'Chọn từ ngày - đến ngày → Lọc', 'Xem theo khoảng thời gian', 'Hoàn thành', '/history', ''],
  [2, '', 'Filter phòng ban', 'Chọn phòng ban → Lọc', 'Xem theo phòng ban', 'Hoàn thành', '/history', ''],
  [2, '', 'Xóa bản ghi', 'Click Xóa 1 bản ghi → Xác nhận → Xóa khỏi DB', 'Xóa dữ liệu sai', 'Hoàn thành', '/history', ''],
  [2, '', 'Xóa tất cả', 'Click Xóa tất cả → Xác nhận → Xóa toàn bộ lịch sử', 'Xóa toàn bộ dữ liệu', 'Hoàn thành', '/history', ''],
  // === CẤP 1: KHÁC ===
  [1, 'Real-time', 'Theo dõi thời gian thực', 'Mở /realtime', 'Dashboard chấm công real-time', 'Hoàn thành', '/realtime', ''],
  [2, '', 'Bộ lọc giờ', 'Chọn từ giờ - đến giờ → Xem NV đang làm trong khung giờ đó', 'Theo dõi theo khung giờ', 'Hoàn thành', '/realtime', ''],
  [2, '', 'Tự động làm mới', 'Interval refresh dữ liệu (mỗi vài giây)', 'Luôn có số liệu mới nhất', 'Hoàn thành', '/realtime', ''],
  [1, 'Phòng ban', 'Thống kê theo phòng ban', '—', 'Chi tiết từng phòng ban', 'Hoàn thành', '/departments', ''],
  [2, '', 'Danh sách phòng ban', 'Mở /departments, hiển thị danh sách phòng ban, click chọn', 'Chọn phòng ban cần xem', 'Hoàn thành', '/departments', ''],
  [2, '', 'Chi tiết phòng ban', 'Xem thống kê, biểu đồ, danh sách NV của phòng', 'Phân tích chi tiết 1 phòng', 'Hoàn thành', '/departments/:dept', ''],
  [1, 'Thông báo', 'Quản lý thông báo', 'Click icon chuông TopBar', 'Xem thông báo hệ thống', 'Hoàn thành', 'TopBar', ''],
  [2, '', 'Xem thông báo', 'Danh sách: đồng bộ NV, đi trễ, upload...', 'Nắm sự kiện', 'Hoàn thành', 'TopBar', ''],
  [2, '', 'Đánh dấu đã đọc', 'Click "Đánh dấu đã đọc" → Gọi API, xóa badge số chưa đọc', 'Xóa badge số chưa đọc', 'Hoàn thành', 'TopBar', ''],
  [2, '', 'Xóa thông báo', 'Xóa 1 hoặc xóa tất cả', 'Dọn thông báo cũ', 'Hoàn thành', 'TopBar', ''],
  [2, '', 'Badge số chưa đọc', 'Hiển thị số thông báo chưa đọc trên icon chuông', 'Nhắc nhở có thông báo mới', 'Hoàn thành', 'TopBar', ''],
  [1, 'Tìm kiếm nhanh', 'Ô tìm kiếm TopBar', 'Nhập từ khóa → Tìm kiếm chức năng/trang', 'Truy cập nhanh', 'Hoàn thành', 'TopBar', ''],
  [1, 'Giao diện', 'Sidebar thu gọn', 'Click nút → Thu gọn/mở rộng sidebar', 'Tiết kiệm không gian màn hình', 'Hoàn thành', 'Sidebar', ''],
  [1, 'Giao diện', 'Responsive', 'Giao diện tương thích mobile/tablet', 'Sử dụng trên nhiều thiết bị', 'Hoàn thành', '', ''],
  [1, 'Download Excel', 'Xuất cấu trúc menu', 'Click "Download Excel" trong popup phòng ban → Tải file danh sách chức năng', 'Xuất danh sách chức năng ra Excel', 'Hoàn thành', 'Popup', ''],
  [1, 'Menu Structure', 'Xem cấu trúc menu', 'Click "Menu Structure" trong popup → Hiện dạng cây', 'Xem dạng cây cấu trúc menu', 'Hoàn thành', 'Popup', ''],
  [1, 'Login', 'Carousel ảnh', '3 ảnh chuyển mỗi 2s trên trang login', 'Giao diện đẹp, giới thiệu', 'Hoàn thành', '/login', ''],
  [1, 'Login', 'Layout', 'Panel trái xanh (carousel), panel phải form đăng nhập', 'Trải nghiệm đăng nhập', 'Hoàn thành', '/login', ''],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(pyramid);

// Set column widths for readability
ws['!cols'] = [
  { wch: 5 },   // Cấp
  { wch: 20 },  // Phòng ban
  { wch: 28 },  // Chức năng
  { wch: 50 },  // Làm gì
  { wch: 38 },  // Tác dụng
  { wch: 14 },  // Trạng thái
  { wch: 22 },  // Route
  { wch: 25 },  // Ghi chú
];

XLSX.utils.book_append_sheet(wb, ws, 'Cấu trúc tháp chức năng');

const outPath = path.join(__dirname, '..', 'docs', 'YS-Smart_CauTrucThapChucNang.xlsx');
XLSX.writeFile(wb, outPath);
console.log('✅ Đã tạo file:', outPath);
console.log('   Cấu trúc: Cấp 1 = Phòng ban/Nhóm, Cấp 2 = Chức năng con');
console.log('   Cột: Làm gì | Tác dụng | Trạng thái | Route | Ghi chú');
