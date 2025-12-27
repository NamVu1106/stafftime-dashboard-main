# 📋 THIẾT KẾ MÀN HÌNH - HỆ THỐNG QUẢN LÝ CHẤM CÔNG

## 📌 MỤC ĐÍCH
Tài liệu này mô tả chi tiết các màn hình và tính năng cần phát triển theo yêu cầu của sếp.

---

## 🎯 TỔNG QUAN HỆ THỐNG

### **Điều kiện cần thiết:**
1. **Máy chủ (cấu hình):** Đã có (Render.com) - Cần đảm bảo đủ tài nguyên
2. **Rawdata:** Dữ liệu thô từ hệ thống chấm công (cần xác định format)
3. **Kết nối với phần mềm máy chấm công:** 
   - API endpoint để nhận data real-time
   - Webhook từ hệ thống chấm công
   - Hoặc polling định kỳ

---

## 📱 MÀN HÌNH 1: DASHBOARD TỔNG HỢP (CẢI TIẾN)

### **Vị trí:** Trang chủ (`/`)

### **Mô tả:**
Hiển thị thống kê tổng hợp theo **Ngày/Tháng/Năm** trên cùng một màn hình.

### **Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: Quản lý Chấm công - Admin Dashboard                       │
├─────────────────────────────────────────────────────────────────────┤
│  SIDEBAR │  MAIN CONTENT                                            │
│          │                                                          │
│  📊 Menu │  ┌──────────────────────────────────────────────────┐   │
│          │  │  BỘ LỌC THỜI GIAN                                 │   │
│          │  │  ○ Hôm nay  ○ Tháng này  ○ Năm này               │   │
│          │  │  ○ 1 ngày   ● Giai đoạn [Từ] [Đến]              │   │
│          │  └──────────────────────────────────────────────────┘   │
│          │                                                          │
│          │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│          │  │  HÔM NAY     │  │ THÁNG NÀY    │  │  NĂM NÀY     │  │
│          │  ├──────────────┤  ├──────────────┤  ├──────────────┤  │
│          │  │ Tổng NV: 150│  │ Tổng NV: 150│  │ Tổng NV: 150│  │
│          │  │ Đi làm: 145 │  │ Đi làm: 3200│ │ Đi làm: 38000│ │
│          │  │ Tỷ lệ: 96.7%│  │ Tỷ lệ: 95.2%│  │ Tỷ lệ: 94.5%│  │
│          │  │ Giờ: 1,160h │  │ Giờ: 25,600h│  │ Giờ: 304,000h│ │
│          │  └──────────────┘  └──────────────┘  └──────────────┘  │
│          │                                                          │
│          │  [Các biểu đồ và thống kê khác...]                      │
└──────────┴──────────────────────────────────────────────────────────┘
```

### **Tính năng:**
1. ✅ Hiển thị 3 cột thống kê: Hôm nay / Tháng này / Năm này
2. ✅ Bộ lọc thời gian nâng cao:
   - Radio buttons: Hôm nay, Tháng này, Năm này, 1 ngày, **Giai đoạn**
   - Khi chọn "Giai đoạn": Hiện 2 date picker (Từ ngày - Đến ngày)
3. ✅ Auto-refresh data khi thay đổi filter
4. ✅ Các biểu đồ hiện có (giữ nguyên)

### **API cần thiết:**
- `GET /api/statistics/dashboard?date=2025-12-22` (Hôm nay)
- `GET /api/statistics/dashboard?start_date=2025-12-01&end_date=2025-12-31` (Tháng này)
- `GET /api/statistics/dashboard?start_date=2025-01-01&end_date=2025-12-31` (Năm này)
- `GET /api/statistics/dashboard?start_date=2025-12-01&end_date=2025-12-15` (Giai đoạn)

---

## 📱 MÀN HÌNH 2: SIDEBAR VỚI MENU HẠNG MỤC

### **Vị trí:** Sidebar (bên trái, tất cả các trang)

### **Mô tả:**
Sidebar có menu phân cấp với các hạng mục để chọn vào các trang data cụ thể.

### **Layout:**

```
┌─────────────────────────┐
│  SIDEBAR (Collapsible)  │
├─────────────────────────┤
│  🏠 Trang chủ           │
│                         │
│  📊 Tổng quan           │
│    ├─ Dashboard         │
│    └─ Real-time         │
│                         │
│  👥 Nhân viên           │
│    ├─ Danh sách        │
│    ├─ Thêm mới         │
│    └─ Chi tiết         │
│                         │
│  📈 Báo cáo             │
│    ├─ Theo ngày        │
│    ├─ Theo tháng       │
│    ├─ Theo năm        │
│    ├─ Giai đoạn       │
│    └─ So sánh         │
│                         │
│  🏢 Phòng ban           │
│    ├─ Phòng Sản xuất  │
│    ├─ Phòng Kỹ thuật  │
│    ├─ Phòng Hành chính│
│    └─ ...             │
│                         │
│  ⏰ Thời gian          │
│    ├─ Hôm nay         │
│    ├─ Tuần này        │
│    ├─ Tháng này       │
│    └─ Tùy chọn        │
│                         │
│  📤 Upload Data        │
│                         │
│  📜 Lịch sử            │
└─────────────────────────┘
```

### **Tính năng:**
1. ✅ Menu phân cấp (Accordion/Collapsible)
2. ✅ Click vào hạng mục → Navigate đến trang tương ứng
3. ✅ Highlight menu item đang active
4. ✅ Có thể collapse/expand sidebar
5. ✅ Responsive (ẩn trên mobile, hiện menu hamburger)

### **Routes cần tạo:**
- `/realtime` - Real-time Dashboard
- `/reports/day` - Báo cáo theo ngày
- `/reports/month` - Báo cáo theo tháng
- `/reports/year` - Báo cáo theo năm
- `/reports/range` - Báo cáo theo giai đoạn
- `/reports/compare` - So sánh
- `/departments/:dept` - Báo cáo theo phòng ban

---

## 📱 MÀN HÌNH 3: REAL-TIME DASHBOARD

### **Vị trí:** `/realtime`

### **Mô tả:**
Hiển thị dữ liệu real-time với khả năng chọn khoảng thời gian (từ giờ đến giờ).

### **Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Real-time Dashboard                                    │
├─────────────────────────────────────────────────────────────────┤
│  SIDEBAR │  MAIN CONTENT                                        │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  BỘ LỌC THỜI GIAN REAL-TIME                 │   │
│          │  ├──────────────────────────────────────────────┤   │
│          │  │  Khoảng thời gian:                          │   │
│          │  │  [Từ giờ: 08:00 ▼] [Đến giờ: 17:00 ▼]      │   │
│          │  │  [🔄 Auto-refresh: ON] [Interval: 30s]      │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  📊 SỐ NGƯỜI ĐANG LÀM VIỆC                  │   │
│          │  │  ┌──────────────────────────────────────┐   │   │
│          │  │  │                                      │   │   │
│          │  │  │     [Biểu đồ real-time]             │   │   │
│          │  │  │     (Cập nhật mỗi 30 giây)          │   │   │
│          │  │  │                                      │   │   │
│          │  │  └──────────────────────────────────────┘   │   │
│          │  │  Số lượng: 45 người                         │   │
│          │  │  ⏰ Cập nhật lúc: 14:30:25                 │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  ┌──────────────┐  ┌──────────────┐                │
│          │  │ Đang làm: 45  │  │ Nghỉ: 5      │                │
│          │  │ Trễ: 2        │  │ Vắng: 3      │                │
│          │  └──────────────┘  └──────────────┘                │
│          │                                                      │
│          │  [Danh sách nhân viên đang làm việc...]              │
└──────────┴──────────────────────────────────────────────────────┘
```

### **Tính năng:**
1. ✅ Time picker: Chọn khoảng giờ (Từ - Đến)
2. ✅ Auto-refresh: Tự động cập nhật mỗi 30 giây (có thể tắt/bật)
3. ✅ Biểu đồ real-time: Hiển thị số người đang làm việc theo thời gian
4. ✅ Thống kê nhanh: Đang làm, Nghỉ, Trễ, Vắng
5. ✅ Danh sách nhân viên đang làm việc (real-time)
6. ✅ Hiển thị thời gian cập nhật cuối cùng

### **API cần thiết:**
- `GET /api/statistics/realtime?start_time=08:00&end_time=17:00`
- Response: `{ current: 45, onBreak: 5, late: 2, absent: 3, employees: [...] }`

### **Technical:**
- Frontend: Polling mỗi 30s (hoặc WebSocket nếu có)
- Backend: Query database theo thời gian hiện tại ± khoảng giờ

---

## 📱 MÀN HÌNH 4: BÁO CÁO THEO GIAI ĐOẠN

### **Vị trí:** `/reports/range`

### **Mô tả:**
Báo cáo chi tiết với khả năng chọn giai đoạn (từ ngày đến ngày).

### **Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Báo cáo theo Giai đoạn                                 │
├─────────────────────────────────────────────────────────────────┤
│  SIDEBAR │  MAIN CONTENT                                        │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  BỘ LỌC                                     │   │
│          │  ├──────────────────────────────────────────────┤   │
│          │  │  Từ ngày: [01/12/2025]                       │   │
│          │  │  Đến ngày: [15/12/2025]                      │   │
│          │  │  Phòng ban: [Tất cả ▼]                       │   │
│          │  │  [Tìm kiếm: ________] [Xem báo cáo]         │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  THỐNG KÊ TỔNG HỢP                           │   │
│          │  ├──────────────────────────────────────────────┤   │
│          │  │  Tổng nhân viên: 150                         │   │
│          │  │  Tổng ngày làm: 2,250 ngày                   │   │
│          │  │  Tổng giờ làm: 18,000 giờ                    │   │
│          │  │  Tổng tăng ca: 450 giờ                       │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  [Bảng dữ liệu chi tiết...]                         │
│          │  [Export Excel]                                    │
└──────────┴──────────────────────────────────────────────────────┘
```

### **Tính năng:**
1. ✅ Date Range Picker: Chọn từ ngày - đến ngày
2. ✅ Filter phòng ban (dropdown)
3. ✅ Tìm kiếm nhân viên
4. ✅ Thống kê tổng hợp cho giai đoạn đã chọn
5. ✅ Bảng dữ liệu chi tiết
6. ✅ Export Excel

### **API cần thiết:**
- `GET /api/timekeeping?start_date=2025-12-01&end_date=2025-12-15&department=...`
- `GET /api/statistics/range?start_date=2025-12-01&end_date=2025-12-15`

---

## 📱 MÀN HÌNH 5: BÁO CÁO THEO PHÒNG BAN

### **Vị trí:** `/departments/:dept` hoặc `/reports/department/:dept`

### **Mô tả:**
Báo cáo chi tiết cho từng phòng ban cụ thể.

### **Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Báo cáo - Phòng Sản xuất                               │
├─────────────────────────────────────────────────────────────────┤
│  SIDEBAR │  MAIN CONTENT                                        │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  THÔNG TIN PHÒNG BAN                         │   │
│          │  ├──────────────────────────────────────────────┤   │
│          │  │  Tên: Phòng Sản xuất                        │   │
│          │  │  Tổng nhân viên: 45                          │   │
│          │  │  Tỷ lệ đi làm: 95.6%                        │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  [Bộ lọc thời gian: Ngày/Tháng/Năm/Giai đoạn]       │
│          │                                                      │
│          │  [Biểu đồ thống kê phòng ban...]                    │
│          │                                                      │
│          │  [Bảng danh sách nhân viên trong phòng...]          │
└──────────┴──────────────────────────────────────────────────────┘
```

### **Tính năng:**
1. ✅ Hiển thị thông tin phòng ban
2. ✅ Thống kê riêng cho phòng ban
3. ✅ Bộ lọc thời gian
4. ✅ Biểu đồ so sánh
5. ✅ Danh sách nhân viên trong phòng

---

## 📱 MÀN HÌNH 6: SO SÁNH

### **Vị trí:** `/reports/compare`

### **Mô tả:**
So sánh dữ liệu giữa các phòng ban hoặc các thời kỳ.

### **Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: So sánh                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SIDEBAR │  MAIN CONTENT                                        │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  CHỌN ĐỐI TƯỢNG SO SÁNH                     │   │
│          │  ├──────────────────────────────────────────────┤   │
│          │  │  Loại: ○ Phòng ban  ● Thời kỳ              │   │
│          │  │  Chọn 1: [Phòng Sản xuất ▼]                 │   │
│          │  │  Chọn 2: [Phòng Kỹ thuật ▼]                │   │
│          │  │  [Thêm] [So sánh]                           │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  KẾT QUẢ SO SÁNH                             │   │
│          │  ├──────────────────────────────────────────────┤   │
│          │  │  [Biểu đồ so sánh side-by-side]               │   │
│          │  │                                              │   │
│          │  │  Bảng so sánh:                                  │   │
│          │  │  Chỉ số    │ Phòng A │ Phòng B │ Chênh lệch │   │
│          │  │  Tỷ lệ     │  95.6%  │  92.3%  │   +3.3%    │   │
│          │  │  Giờ làm   │ 1,200h  │ 1,150h  │   +50h     │   │
│          │  └──────────────────────────────────────────────┘   │
└──────────┴──────────────────────────────────────────────────────┘
```

### **Tính năng:**
1. ✅ Chọn loại so sánh: Phòng ban hoặc Thời kỳ
2. ✅ Multi-select: Có thể so sánh nhiều đối tượng
3. ✅ Biểu đồ so sánh side-by-side
4. ✅ Bảng so sánh chi tiết
5. ✅ Export kết quả

---

## 🔧 CÁC TÍNH NĂNG KỸ THUẬT CẦN PHÁT TRIỂN

### **1. Date Range Picker**
- Component: Chọn từ ngày - đến ngày
- Validation: Đến ngày phải >= Từ ngày
- Format: DD/MM/YYYY

### **2. Time Range Picker**
- Component: Chọn từ giờ - đến giờ
- Format: HH:MM (24h)
- Validation: Đến giờ phải > Từ giờ

### **3. Real-time Data**
- Polling: Mỗi 30 giây gọi API
- WebSocket: (Nếu có) Kết nối real-time
- Auto-refresh: Có thể bật/tắt

### **4. Sidebar với Submenu**
- Component: Accordion/Collapsible
- Navigation: React Router với nested routes
- Active state: Highlight menu đang active

### **5. API Endpoints mới**
```
GET /api/statistics/realtime?start_time=08:00&end_time=17:00
GET /api/statistics/range?start_date=...&end_date=...
GET /api/statistics/compare?type=department&ids=...
GET /api/departments/:dept/stats?date=...
```

---

## 📊 SƠ ĐỒ LUỒNG ĐIỀU HƯỚNG

```
Trang chủ (/)
  ├─ Dashboard (cải tiến)
  ├─ Real-time (/realtime)
  └─ Báo cáo
      ├─ Theo ngày (/reports/day)
      ├─ Theo tháng (/reports/month)
      ├─ Theo năm (/reports/year)
      ├─ Giai đoạn (/reports/range)
      └─ So sánh (/reports/compare)

Sidebar Menu
  ├─ Tổng quan
  │   ├─ Dashboard
  │   └─ Real-time
  ├─ Nhân viên
  │   ├─ Danh sách
  │   └─ Chi tiết
  ├─ Báo cáo
  │   ├─ Theo ngày
  │   ├─ Theo tháng
  │   ├─ Theo năm
  │   ├─ Giai đoạn
  │   └─ So sánh
  └─ Phòng ban
      └─ [Danh sách phòng ban]
```

---

## ✅ CHECKLIST PHÁT TRIỂN

### **Frontend:**
- [ ] Cải thiện Dashboard: Hiển thị Ngày/Tháng/Năm cùng lúc
- [ ] Thêm Date Range Picker component
- [ ] Thêm Time Range Picker component
- [ ] Cải thiện Sidebar: Thêm submenu
- [ ] Tạo trang Real-time Dashboard
- [ ] Tạo trang Báo cáo theo Giai đoạn
- [ ] Tạo trang Báo cáo theo Phòng ban
- [ ] Tạo trang So sánh
- [ ] Auto-refresh cho real-time data

### **Backend:**
- [ ] API `/api/statistics/realtime`
- [ ] API `/api/statistics/range`
- [ ] API `/api/statistics/compare`
- [ ] API `/api/departments/:dept/stats`
- [ ] Support filter theo khoảng giờ
- [ ] Integration với hệ thống chấm công (nếu có)

### **Database:**
- [ ] Index cho query theo thời gian
- [ ] Có thể cần bảng mới cho real-time data

---

## 📝 GHI CHÚ

1. **Tham khảo Gmes:** Cần xem cách Gmes hiển thị data để áp dụng phong cách tương tự
2. **Real-time:** Có thể bắt đầu với polling, sau đó nâng cấp lên WebSocket
3. **Performance:** Cần optimize query khi filter theo giai đoạn dài
4. **UX:** Đảm bảo loading states và error handling đầy đủ

---

**Ngày tạo:** 22/12/2025  
**Version:** 1.0





