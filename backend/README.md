# Backend API – StaffTime Dashboard

Node.js + Express + TypeScript + **mssql** (truy vấn trực tiếp SQL Server).

## Yêu cầu

- Node.js >= 18
- SQL Server (Express/Developer hoặc bản đầy đủ)
- Database đã tạo sẵn (ví dụ `StaffTime`)

## Cài đặt

```bash
cd backend
npm install
```

## Cấu hình `.env`

Xem `.env.example`. Chuỗi kết nối SQL Server:

```env
DATABASE_URL="sqlserver://localhost:1433;database=StaffTime;user=sa;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=true"
JWT_SECRET="your-secret-key"
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

Chi tiết: [docs/SQL_SERVER_SETUP.md](docs/SQL_SERVER_SETUP.md)

## Database (tạo bảng)

**Khi chạy server**, code tự tạo các bảng thiếu (`employees`, `timekeeping_records`, `notifications`, `users`, …) — không còn 500 do thiếu bảng.

Tuỳ chọn: chạy thêm script đầy đủ trong SSMS — `prisma/migrations/20260303000000_init_sqlserver/migration.sql` (**Không dùng Prisma.**)

## User admin mặc định

```bash
npm run create:user
```

## Test

```bash
npm run test          # chỉ test backend (Vitest)
npm run test:all      # backend + test frontend (thư mục cha)
```

Hoặc từ **thư mục gốc** dự án: `npm run test:all` (cùng kết quả: frontend trước, backend sau).

## Chạy server

```bash
npm run dev
```

API: `http://localhost:3000` (hoặc `PORT` trong `.env`)

## Bảng chính

| Bảng | Mô tả |
|------|--------|
| employees | Nhân viên |
| family_members | Thành viên gia đình |
| timekeeping_records | Chấm công |
| users | Đăng nhập |
| notifications | Thông báo |
| employee_excel_store | Cache Excel nhân viên (JSON) |
| hr_excel_uploads | Upload HR |

