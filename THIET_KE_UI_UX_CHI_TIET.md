# 🎨 THIẾT KẾ UI/UX CHI TIẾT - HỆ THỐNG QUẢN LÝ CHẤM CÔNG

## 📋 MỤC ĐÍCH
Tài liệu này mô tả chi tiết thiết kế giao diện và trải nghiệm người dùng cho các màn hình mới. Sau khi duyệt, sẽ bắt đầu triển khai code.

---

## 🎯 NGUYÊN TẮC THIẾT KẾ

1. **Đơn giản, dễ sử dụng:** Giao diện trực quan, không phức tạp
2. **Nhất quán:** Giữ phong cách thiết kế giống các màn hình hiện có
3. **Responsive:** Hoạt động tốt trên desktop, tablet, mobile
4. **Hiệu suất:** Loading nhanh, không lag
5. **Tham khảo Gmes:** Áp dụng phong cách tương tự về màu sắc và layout

---

## 📱 MÀN HÌNH 1: DASHBOARD TỔNG HỢP (CẢI TIẾN)

### **Vị trí:** Trang chủ (`/`)

### **Thiết kế Layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Quản lý Chấm công                    [User Avatar] [Logout]        │
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │  📊 Tổng quan                                                     │
│          │                                                                  │
│  SIDEBAR │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  🔍 BỘ LỌC THỜI GIAN                                      │  │
│          │  │  ┌────────────────────────────────────────────────────┐ │  │
│          │  │  │  ○ Hôm nay  ○ Tháng này  ○ Năm này                 │ │  │
│          │  │  │  ○ 1 ngày   ● Giai đoạn                            │ │  │
│          │  │  │                                                      │ │  │
│          │  │  │  [Từ ngày: 01/12/2025] [Đến ngày: 15/12/2025]      │ │  │
│          │  │  │  [Áp dụng bộ lọc]                                    │ │  │
│          │  │  └────────────────────────────────────────────────────┘ │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│          │  │  📅 HÔM NAY  │  │  📆 THÁNG NÀY│  │  📅 NĂM NÀY  │         │
│          │  ├──────────────┤  ├──────────────┤  ├──────────────┤         │
│          │  │ 👥 150 NV    │  │ 👥 150 NV    │  │ 👥 150 NV    │         │
│          │  │ ✅ 145 đi làm│  │ ✅ 3,200 đi  │  │ ✅ 38,000 đi │         │
│          │  │ 📊 96.7%     │  │ 📊 95.2%     │  │ 📊 94.5%     │         │
│          │  │ ⏰ 1,160h    │  │ ⏰ 25,600h   │  │ ⏰ 304,000h  │         │
│          │  └──────────────┘  └──────────────┘  └──────────────┘         │
│          │                                                                  │
│          │  [Các biểu đồ hiện có - giữ nguyên]                             │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

### **Chi tiết Components:**

#### 1. Bộ lọc thời gian (Filter Section)
- **Vị trí:** Phía trên 3 cột thống kê
- **Thiết kế:**
  - Background: Card màu trắng/nền nhạt, có border
  - Radio buttons: 5 lựa chọn (Hôm nay, Tháng này, Năm này, 1 ngày, Giai đoạn)
  - Khi chọn "Giai đoạn":
    - Hiện 2 date picker cạnh nhau
    - Format: DD/MM/YYYY
    - Validation: Đến ngày >= Từ ngày
  - Khi chọn "1 ngày":
    - Hiện 1 date picker
  - Nút "Áp dụng bộ lọc" (màu primary)
- **Màu sắc:** Giống các component hiện có

#### 2. 3 Cột thống kê (Stat Cards)
- **Layout:** Grid 3 cột, responsive (mobile: 1 cột)
- **Thiết kế:**
  - Mỗi cột là một Card
  - Header: Icon + Tiêu đề (Hôm nay/Tháng này/Năm này)
  - Body: 4 chỉ số:
    - Tổng nhân viên (icon 👥)
    - Số người đi làm (icon ✅)
    - Tỷ lệ đi làm (icon 📊)
    - Tổng giờ làm (icon ⏰)
  - Màu sắc: Mỗi cột có màu nhẹ khác nhau để phân biệt
- **Kích thước:** Đồng đều, chiều cao tự động

#### 3. Các biểu đồ hiện có
- **Giữ nguyên:** Tất cả biểu đồ và thống kê hiện có
- **Vị trí:** Phía dưới 3 cột thống kê

### **Tương tác:**
- Khi chọn bộ lọc → Tự động reload data
- Loading state khi đang fetch data
- Error state nếu có lỗi

---

## 📱 MÀN HÌNH 2: SIDEBAR VỚI MENU PHÂN CẤP

### **Vị trí:** Bên trái, tất cả các trang

### **Thiết kế Layout:**

```
┌─────────────────────────┐
│  [Logo] CHẤM CÔNG       │
├─────────────────────────┤
│  🏠 Trang chủ            │
│                         │
│  📊 Tổng quan ▼         │
│    ├─ Dashboard         │
│    └─ Real-time         │
│                         │
│  👥 Nhân viên ▼         │
│    ├─ Danh sách        │
│    ├─ Thêm mới         │
│    └─ Chi tiết         │
│                         │
│  📈 Báo cáo ▼           │
│    ├─ Theo ngày        │
│    ├─ Theo tháng       │
│    ├─ Theo năm         │
│    ├─ Giai đoạn        │
│    └─ So sánh          │
│                         │
│  🏢 Phòng ban ▼         │
│    ├─ Phòng Sản xuất  │
│    ├─ Phòng Kỹ thuật  │
│    └─ Phòng Hành chính│
│                         │
│  ⏰ Thời gian ▼         │
│    ├─ Hôm nay         │
│    ├─ Tuần này        │
│    └─ Tháng này       │
│                         │
│  📤 Upload Data        │
│                         │
│  📜 Lịch sử            │
└─────────────────────────┘
```

### **Chi tiết Components:**

#### 1. Menu Item (Mục menu)
- **Thiết kế:**
  - Có icon bên trái
  - Text label
  - Icon mũi tên (▼) nếu có submenu
  - Hover: Background nhẹ
  - Active: Background màu primary, text màu trắng
- **Kích thước:** Padding 12px, font size 14px

#### 2. Submenu (Menu con)
- **Thiết kế:**
  - Indent 20px so với menu cha
  - Icon nhỏ hơn hoặc không có icon
  - Background nhẹ hơn menu cha
  - Hover và Active tương tự menu cha
- **Animation:** Slide down khi mở, slide up khi đóng

#### 3. Collapse/Expand
- **Nút:** Ở góc trên bên phải sidebar
- **Icon:** Chevron left/right
- **Khi collapse:** Chỉ hiện icon, ẩn text
- **Width:** 
  - Expanded: 256px
  - Collapsed: 64px

### **Màu sắc:**
- Background: Màu sidebar hiện có
- Text: Màu text hiện có
- Active: Màu primary
- Hover: Background nhẹ

---

## 📱 MÀN HÌNH 3: REAL-TIME DASHBOARD

### **Vị trí:** `/realtime`

### **Thiết kế Layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Quản lý Chấm công                    [User Avatar] [Logout]        │
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │  ⚡ Real-time Dashboard                                         │
│          │                                                                  │
│  SIDEBAR │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  ⏰ BỘ LỌC THỜI GIAN                                      │  │
│          │  │  ┌────────────────────────────────────────────────────┐ │  │
│          │  │  │  Từ giờ: [08:00 ▼]  Đến giờ: [17:00 ▼]             │ │  │
│          │  │  │  [🔄 Auto-refresh: ON] [Interval: 30s] [Tắt/Bật]    │ │  │
│          │  │  └────────────────────────────────────────────────────┘ │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  📊 SỐ NGƯỜI ĐANG LÀM VIỆC                               │  │
│          │  │  ┌──────────────────────────────────────────────────┐  │  │
│          │  │  │                                                  │  │  │
│          │  │  │     [Biểu đồ đường real-time]                   │  │  │
│          │  │  │     (Cập nhật mỗi 30 giây)                       │  │  │
│          │  │  │                                                  │  │  │
│          │  │  └──────────────────────────────────────────────────┘  │  │
│          │  │  Số lượng hiện tại: 45 người                           │  │
│          │  │  ⏰ Cập nhật lúc: 14:30:25                            │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│          │  │ ✅ Đang làm │  │ ☕ Đang nghỉ │  │ ⚠️ Đi trễ     │         │
│          │  │    45       │  │     5        │  │     2         │         │
│          │  └──────────────┘  └──────────────┘  └──────────────┘         │
│          │  ┌──────────────┐                                             │
│          │  │ ❌ Vắng mặt  │                                             │
│          │  │     3        │                                             │
│          │  └──────────────┘                                             │
│          │                                                                  │
│          │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  👥 DANH SÁCH NHÂN VIÊN ĐANG LÀM VIỆC                    │  │
│          │  │  ┌──────────────────────────────────────────────────┐  │  │
│          │  │  │  Mã NV │ Tên        │ Phòng ban │ Trạng thái    │  │  │
│          │  │  │  NV001 │ Nguyễn Văn A│ Sản xuất │ ✅ Đang làm   │  │  │
│          │  │  │  NV002 │ Trần Thị B │ Kỹ thuật │ ☕ Đang nghỉ  │  │  │
│          │  │  │  ...   │ ...        │ ...      │ ...           │  │  │
│          │  │  └──────────────────────────────────────────────────┘  │  │
│          │  └──────────────────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

### **Chi tiết Components:**

#### 1. Bộ lọc thời gian
- **Time Picker:**
  - Format: HH:MM (24 giờ)
  - Dropdown hoặc input với validation
  - Default: 08:00 - 17:00
- **Auto-refresh Toggle:**
  - Switch ON/OFF
  - Hiển thị interval (30s)
  - Có thể thay đổi interval

#### 2. Biểu đồ Real-time
- **Type:** Line chart với animation
- **Data:** Số người đang làm việc theo thời gian
- **Update:** Mỗi 30 giây thêm điểm mới
- **Màu:** Màu primary, có gradient

#### 3. Thống kê nhanh (4 Cards)
- **Layout:** Grid 2x2 trên desktop, 1 cột trên mobile
- **Màu sắc:**
  - Đang làm: Xanh lá (success)
  - Đang nghỉ: Vàng (warning)
  - Đi trễ: Cam (warning)
  - Vắng mặt: Đỏ (danger)

#### 4. Danh sách nhân viên
- **Table:** Responsive table
- **Columns:** Mã NV, Tên, Phòng ban, Trạng thái
- **Trạng thái:** Badge với màu tương ứng
- **Auto-update:** Tự động cập nhật khi có thay đổi

### **Tương tác:**
- Real-time update mỗi 30s (nếu bật)
- Loading indicator khi đang fetch
- Error state nếu mất kết nối
- Toast notification khi có thay đổi lớn

---

## 📱 MÀN HÌNH 4: BÁO CÁO THEO GIAI ĐOẠN

### **Vị trí:** `/reports/range`

### **Thiết kế Layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Quản lý Chấm công                    [User Avatar] [Logout]        │
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │  📊 Báo cáo theo Giai đoạn                                       │
│          │                                                                  │
│  SIDEBAR │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  🔍 BỘ LỌC                                               │  │
│          │  │  ┌────────────────────────────────────────────────────┐ │  │
│          │  │  │  Từ ngày: [01/12/2025]                               │ │  │
│          │  │  │  Đến ngày: [15/12/2025]                              │ │  │
│          │  │  │  Phòng ban: [Tất cả ▼]                              │ │  │
│          │  │  │  Tìm kiếm: [________] [🔍]                           │ │  │
│          │  │  │  [Xem báo cáo] [Export Excel]                        │ │  │
│          │  │  └────────────────────────────────────────────────────┘ │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  📈 THỐNG KÊ TỔNG HỢP                                    │  │
│          │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│          │  │  │ 👥 150 NV│ │ 📅 2,250 │ │ ⏰ 18,000h│ │ ⚡ 450h   │ │  │
│          │  │  │ Tổng NV  │ │ Ngày làm │ │ Giờ làm  │ │ Tăng ca  │ │  │
│          │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  📋 BẢNG DỮ LIỆU CHI TIẾT                               │  │
│          │  │  ┌──────────────────────────────────────────────────┐  │  │
│          │  │  │ Mã │ Tên │ Phòng │ Ngày │ Vào │ Ra │ Giờ │ Tăng ca│ │  │
│          │  │  │NV01│ A    │ SX    │01/12 │08:00│17:00│ 8h  │ 0h    │ │  │
│          │  │  │... │ ... │ ...   │...   │...  │...  │ ... │ ...   │ │  │
│          │  │  └──────────────────────────────────────────────────┘  │  │
│          │  │  [< 1 2 3 ... 10 >]                                    │  │
│          │  └──────────────────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

### **Chi tiết Components:**

#### 1. Bộ lọc
- **Date Range Picker:**
  - 2 date picker cạnh nhau
  - Format: DD/MM/YYYY
  - Validation: Đến ngày >= Từ ngày
  - Có thể chọn từ calendar
- **Dropdown Phòng ban:**
  - Option đầu: "Tất cả"
  - Các option sau: Danh sách phòng ban
- **Tìm kiếm:**
  - Input với icon search
  - Tìm theo tên hoặc mã NV
  - Real-time filter
- **Buttons:**
  - "Xem báo cáo" (Primary)
  - "Export Excel" (Secondary)

#### 2. Thống kê tổng hợp (4 Cards)
- **Layout:** Grid 4 cột (responsive)
- **Mỗi card:** Icon + Số + Label
- **Màu:** Mỗi card màu nhẹ khác nhau

#### 3. Bảng dữ liệu
- **Table:** Responsive, có scroll ngang nếu cần
- **Columns:** Mã NV, Tên, Phòng ban, Ngày, Giờ vào, Giờ ra, Tổng giờ, Tăng ca
- **Features:**
  - Sortable columns
  - Pagination
  - Row hover effect
- **Empty state:** "Không có dữ liệu" nếu không tìm thấy

### **Tương tác:**
- Click "Xem báo cáo" → Reload data với filter mới
- Click "Export Excel" → Download file
- Sort column → Sắp xếp lại data
- Pagination → Chuyển trang

---

## 📱 MÀN HÌNH 5: BÁO CÁO THEO PHÒNG BAN

### **Vị trí:** `/departments/:dept`

### **Thiết kế Layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Quản lý Chấm công                    [User Avatar] [Logout]        │
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │  🏢 Báo cáo - Phòng Sản xuất                                    │
│          │                                                                  │
│  SIDEBAR │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  ℹ️ THÔNG TIN PHÒNG BAN                                   │  │
│          │  │  ┌────────────────────────────────────────────────────┐ │  │
│          │  │  │  Tên: Phòng Sản xuất                               │ │  │
│          │  │  │  Tổng nhân viên: 45                                │ │  │
│          │  │  │  Tỷ lệ đi làm: 95.6%                               │ │  │
│          │  │  └────────────────────────────────────────────────────┘ │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          │  [Bộ lọc thời gian: Ngày/Tháng/Năm/Giai đoạn]                  │
│          │                                                                  │
│          │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  📊 BIỂU ĐỒ THỐNG KÊ                                     │  │
│          │  │  [Biểu đồ cột: Tỷ lệ đi làm theo thời gian]            │  │
│          │  │  [Biểu đồ tròn: Phân bổ nhân viên]                      │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  👥 DANH SÁCH NHÂN VIÊN                                   │  │
│          │  │  [Bảng: Mã NV, Tên, Số ngày làm, Tổng giờ, Tỷ lệ]       │  │
│          │  └──────────────────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

### **Chi tiết Components:**

#### 1. Thông tin phòng ban (Info Card)
- **Background:** Màu nhẹ, có border
- **Layout:** 3 dòng thông tin
- **Icon:** Icon building

#### 2. Bộ lọc thời gian
- **Radio buttons:** Ngày, Tháng, Năm, Giai đoạn
- **Date picker:** Tương ứng với lựa chọn

#### 3. Biểu đồ
- **Biểu đồ cột:** Tỷ lệ đi làm theo thời gian
- **Biểu đồ tròn:** Phân bổ nhân viên (chính thức/thời vụ)

#### 4. Bảng nhân viên
- **Columns:** Mã NV, Tên, Số ngày làm, Tổng giờ, Tỷ lệ đi làm
- **Click row:** Mở modal chi tiết nhân viên

---

## 📱 MÀN HÌNH 6: SO SÁNH

### **Vị trí:** `/reports/compare`

### **Thiết kế Layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Quản lý Chấm công                    [User Avatar] [Logout]        │
├──────────┬──────────────────────────────────────────────────────────────────┤
│          │  ⚖️ So sánh                                                      │
│          │                                                                  │
│  SIDEBAR │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  🎯 CHỌN ĐỐI TƯỢNG SO SÁNH                               │  │
│          │  │  ┌────────────────────────────────────────────────────┐ │  │
│          │  │  │  Loại: ○ Phòng ban  ● Thời kỳ                     │ │  │
│          │  │  │                                                    │ │  │
│          │  │  │  Giai đoạn 1: [Từ: 01/12] [Đến: 15/12]           │ │  │
│          │  │  │  Giai đoạn 2: [Từ: 01/11] [Đến: 15/11]           │ │  │
│          │  │  │  [➕ Thêm giai đoạn] [So sánh]                    │ │  │
│          │  │  └────────────────────────────────────────────────────┘ │  │
│          │  └──────────────────────────────────────────────────────────┘  │
│          │                                                                  │
│          │  ┌──────────────────────────────────────────────────────────┐  │
│          │  │  📊 KẾT QUẢ SO SÁNH                                     │  │
│          │  │  ┌──────────────────────────────────────────────────┐  │  │
│          │  │  │  [Biểu đồ so sánh side-by-side]                  │  │  │
│          │  │  └──────────────────────────────────────────────────┘  │  │
│          │  │                                                          │  │
│          │  │  ┌──────────────────────────────────────────────────┐  │  │
│          │  │  │  Chỉ số    │ GĐ 1 │ GĐ 2 │ Chênh lệch           │  │  │
│          │  │  │  Tỷ lệ     │ 95.6%│ 92.3%│ +3.3%                │  │  │
│          │  │  │  Giờ làm   │1,200h│1,150h│ +50h                 │  │  │
│          │  │  │  ...       │ ...  │ ...  │ ...                  │  │  │
│          │  │  └──────────────────────────────────────────────────┘  │  │
│          │  │  [Export Excel] [Export PDF]                            │  │
│          │  └──────────────────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

### **Chi tiết Components:**

#### 1. Chọn đối tượng so sánh
- **Radio buttons:** Phòng ban hoặc Thời kỳ
- **Nếu chọn Phòng ban:**
  - Dropdown chọn phòng ban (có thể chọn nhiều)
  - Nút "Thêm" để thêm phòng ban
- **Nếu chọn Thời kỳ:**
  - Date range picker cho mỗi giai đoạn
  - Nút "Thêm" để thêm giai đoạn
- **Nút "So sánh":** Primary button

#### 2. Kết quả so sánh
- **Biểu đồ:**
  - Type: Bar chart side-by-side
  - Mỗi đối tượng một màu
  - Legend để phân biệt
- **Bảng so sánh:**
  - Cột 1: Chỉ số
  - Cột 2, 3, ...: Giá trị từng đối tượng
  - Cột cuối: Chênh lệch (nếu 2 đối tượng)
  - Highlight: Màu xanh nếu tăng, đỏ nếu giảm
- **Export buttons:**
  - Export Excel
  - Export PDF (nếu có)

---

## 🎨 MÀU SẮC VÀ STYLE

### **Màu sắc:**
- Primary: Màu xanh dương (giữ nguyên)
- Success: Xanh lá (đang làm, thành công)
- Warning: Vàng/Cam (nghỉ, trễ)
- Danger: Đỏ (vắng mặt, lỗi)
- Background: Trắng/nền nhạt
- Text: Đen/xám đậm

### **Typography:**
- Font: Giữ nguyên font hiện có
- Heading: Bold, size lớn hơn
- Body: Regular, size vừa
- Label: Medium, size nhỏ hơn

### **Spacing:**
- Padding: 16px, 24px
- Gap: 8px, 16px, 24px
- Border radius: 8px, 12px

### **Shadows:**
- Card: Shadow nhẹ
- Hover: Shadow đậm hơn

---

## 📱 RESPONSIVE DESIGN

### **Desktop (> 1024px):**
- Sidebar: Full width (256px)
- Main content: Full width còn lại
- Grid: 3-4 cột

### **Tablet (768px - 1024px):**
- Sidebar: Collapsible
- Main content: Full width
- Grid: 2 cột

### **Mobile (< 768px):**
- Sidebar: Hidden, hiện menu hamburger
- Main content: Full width
- Grid: 1 cột
- Cards: Stack vertically

---

## ✅ CHECKLIST THIẾT KẾ

### **Màn hình 1 - Dashboard:**
- [ ] Bộ lọc thời gian với 5 options
- [ ] 3 cột thống kê song song
- [ ] Date range picker khi chọn "Giai đoạn"
- [ ] Responsive layout

### **Màn hình 2 - Sidebar:**
- [ ] Menu phân cấp với submenu
- [ ] Collapse/Expand functionality
- [ ] Active state highlighting
- [ ] Responsive (hamburger menu)

### **Màn hình 3 - Real-time:**
- [ ] Time range picker
- [ ] Auto-refresh toggle
- [ ] Real-time chart
- [ ] 4 stat cards
- [ ] Employee list table

### **Màn hình 4 - Báo cáo Giai đoạn:**
- [ ] Date range picker
- [ ] Department filter
- [ ] Search input
- [ ] 4 stat cards
- [ ] Data table với pagination
- [ ] Export button

### **Màn hình 5 - Báo cáo Phòng ban:**
- [ ] Info card
- [ ] Time filter
- [ ] Charts (2 biểu đồ)
- [ ] Employee table

### **Màn hình 6 - So sánh:**
- [ ] Type selector (Phòng ban/Thời kỳ)
- [ ] Multi-select cho đối tượng
- [ ] Comparison chart
- [ ] Comparison table
- [ ] Export buttons

---

## 📝 GHI CHÚ THIẾT KẾ

1. **Tham khảo Gmes:** Áp dụng phong cách tương tự về layout và màu sắc
2. **Consistency:** Giữ phong cách giống các màn hình hiện có
3. **Accessibility:** Đảm bảo contrast đủ, có alt text cho icon
4. **Performance:** Lazy load cho biểu đồ, optimize images
5. **Error handling:** Hiển thị message rõ ràng khi có lỗi

---

**Sau khi duyệt thiết kế này, sẽ bắt đầu triển khai code!**

Ngày tạo: 22/12/2025
Version: 1.0





