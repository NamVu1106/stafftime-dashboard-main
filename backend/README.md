# Backend API - StaffTime Dashboard

Backend server cho hệ thống quản lý chấm công nhân sự.

## Công nghệ sử dụng

- **Node.js** + **Express** + **TypeScript**
- **Prisma** + **SQLite** (có thể chuyển sang PostgreSQL)
- **JWT** cho authentication
- **Multer** cho file upload
- **XLSX** cho parse Excel

## Cài đặt

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Setup Database

Tạo database và chạy migration:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

Hoặc nếu dùng npm.cmd:
```cmd
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

### 3. Tạo file .env

Copy `.env.example` thành `.env` và cập nhật các giá trị nếu cần.

### 4. Chạy server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register` - Đăng ký
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Employees
- `GET /api/employees` - Danh sách nhân viên (có filter)
- `GET /api/employees/:id` - Chi tiết nhân viên
- `POST /api/employees` - Tạo nhân viên mới
- `PUT /api/employees/:id` - Cập nhật nhân viên
- `DELETE /api/employees/:id` - Xóa nhân viên

### Timekeeping
- `GET /api/timekeeping` - Danh sách chấm công (có filter)
- `GET /api/timekeeping/:id` - Chi tiết chấm công
- `POST /api/timekeeping` - Tạo bản ghi chấm công
- `PUT /api/timekeeping/:id` - Cập nhật chấm công
- `DELETE /api/timekeeping/:id` - Xóa chấm công

### Upload
- `POST /api/upload/employees` - Upload Excel nhân viên
- `POST /api/upload/timekeeping` - Upload Excel chấm công
- `POST /api/upload/avatar` - Upload ảnh chân dung

### Statistics
- `GET /api/statistics/dashboard?date=2024-12-10` - Thống kê dashboard
- `GET /api/statistics/gender` - Thống kê giới tính
- `GET /api/statistics/age` - Thống kê độ tuổi
- `GET /api/statistics/employment-type` - Thống kê loại hợp đồng
- `GET /api/statistics/department?date=2024-12-10` - Thống kê theo bộ phận
- `GET /api/statistics/gender-by-employment-type` - Thống kê giới tính theo loại hợp đồng
- `GET /api/statistics/attendance-by-date?days=7` - Thống kê đi làm theo ngày

## Database

Database sử dụng SQLite, file database sẽ được tạo tại: `prisma/dev.db`

Để xem database bằng Prisma Studio:
```bash
npm run prisma:studio
```

## Cấu trúc thư mục

```
backend/
├── src/
│   ├── controllers/    # Business logic
│   ├── routes/          # API routes
│   ├── middleware/      # Middleware functions
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   └── server.ts        # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
└── uploads/             # Uploaded files
```


