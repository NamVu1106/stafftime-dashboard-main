# Hệ thống Quản lý Chấm công Nhân sự

Hệ thống quản lý chấm công nhân sự với đầy đủ tính năng dashboard, báo cáo, và quản lý nhân viên. Hỗ trợ đa ngôn ngữ (Tiếng Việt và Tiếng Hàn).

## 🚀 Tính năng chính

### Frontend
- ✅ **Dashboard tổng quan** - Hiển thị thống kê theo ngày/tháng/năm
- ✅ **Quản lý nhân viên** - Thêm, sửa, xóa, xem thông tin nhân viên
- ✅ **Báo cáo đa dạng**:
  - Báo cáo theo ngày
  - Báo cáo theo tháng
  - Báo cáo theo năm
  - Báo cáo theo giai đoạn
  - So sánh báo cáo
- ✅ **Real-time Dashboard** - Theo dõi dữ liệu chấm công theo thời gian thực
- ✅ **Upload dữ liệu** - Upload file Excel cho nhân viên và chấm công
- ✅ **Lịch sử** - Xem lịch sử các bản ghi đã được lưu trữ
- ✅ **Đa ngôn ngữ** - Hỗ trợ Tiếng Việt và Tiếng Hàn
- ✅ **Responsive Design** - Tối ưu cho mọi thiết bị

### Backend
- ✅ RESTful API với Express.js
- ✅ Prisma ORM với SQLite
- ✅ Authentication với JWT
- ✅ File upload với Multer
- ✅ Xử lý Excel với XLSX

## 📋 Yêu cầu hệ thống

- Node.js >= 18.x
- npm hoặc yarn
- SQLite (tự động tạo database)

## 🛠️ Cài đặt

### 1. Clone repository
```bash
git clone <repository-url>
cd stafftime-dashboard-main
```

### 2. Cài đặt dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd backend
npm install
```

### 3. Cấu hình môi trường

**Backend (.env):**
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

### 4. Khởi tạo database
```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

### 5. Chạy ứng dụng

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Ứng dụng sẽ chạy tại:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api

## 📁 Cấu trúc dự án

```
stafftime-dashboard-main/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── services/           # API services
│   ├── contexts/           # React contexts (Auth, i18n)
│   ├── locales/            # Translation files
│   └── App.tsx             # Main app component
├── backend/                # Backend source code
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   └── server.ts       # Express server
│   └── prisma/             # Prisma schema
└── README.md
```

## 🔐 Đăng nhập mặc định

- **Username:** admin
- **Password:** admin

## 🌐 Đa ngôn ngữ

Hệ thống hỗ trợ 2 ngôn ngữ:
- 🇻🇳 Tiếng Việt
- 🇰🇷 Tiếng Hàn

Chuyển đổi ngôn ngữ bằng cách click vào icon ngôn ngữ ở top bar (cạnh icon thông báo).

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập

### Employees
- `GET /api/employees` - Lấy danh sách nhân viên
- `GET /api/employees/:id` - Lấy thông tin nhân viên
- `POST /api/employees` - Tạo nhân viên mới
- `PUT /api/employees/:id` - Cập nhật nhân viên
- `DELETE /api/employees/:id` - Xóa nhân viên
- `DELETE /api/employees` - Xóa tất cả nhân viên

### Timekeeping
- `GET /api/timekeeping` - Lấy dữ liệu chấm công
- `GET /api/timekeeping/:id` - Lấy bản ghi chấm công
- `POST /api/timekeeping` - Tạo bản ghi chấm công
- `PUT /api/timekeeping/:id` - Cập nhật bản ghi
- `DELETE /api/timekeeping/:id` - Xóa bản ghi

### Statistics
- `GET /api/statistics/dashboard` - Thống kê dashboard
- `GET /api/statistics/gender` - Thống kê theo giới tính
- `GET /api/statistics/age` - Thống kê theo độ tuổi
- `GET /api/statistics/realtime` - Thống kê real-time
- `GET /api/statistics/range` - Thống kê theo giai đoạn
- `GET /api/statistics/compare` - So sánh thống kê

### Upload
- `POST /api/upload/employees` - Upload file nhân viên
- `POST /api/upload/timekeeping` - Upload file chấm công

## 🧪 Testing

```bash
# Frontend
npm run test

# Backend
cd backend
npm run test
```

## 📝 License

MIT

## 👥 Contributors

- Development Team

## 📞 Support

Nếu có vấn đề, vui lòng tạo issue trên GitHub repository.
