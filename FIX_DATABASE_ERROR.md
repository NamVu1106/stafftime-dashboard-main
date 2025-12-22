# 🔧 SỬA LỖI DATABASE

## ❌ LỖI HIỆN TẠI

```
Error querying the database: Error code 14: Unable to open the database file
```

## 🔍 NGUYÊN NHÂN

Database file chưa được tạo hoặc path không đúng.

---

## ✅ CÁCH SỬA

### **BƯỚC 1: Kiểm tra file .env**

Đảm bảo trong `backend/.env` có:
```env
DATABASE_URL="file:./prisma/dev.db"
```

**Lưu ý:** Path này là **relative** từ thư mục `backend/`

---

### **BƯỚC 2: Chạy Migration**

Mở terminal và chạy:

```bash
cd backend
npx prisma migrate deploy
```

Hoặc nếu chưa có migration:

```bash
cd backend
npx prisma migrate dev
```

---

### **BƯỚC 3: Generate Prisma Client**

```bash
cd backend
npx prisma generate
```

---

### **BƯỚC 4: Tạo User Admin**

```bash
cd backend
npx ts-node src/scripts/createDefaultUser.ts
```

---

### **BƯỚC 5: Chạy lại Server**

```bash
cd backend
npm run dev
```

---

## 🎯 LỆNH ĐẦY ĐỦ (Copy tất cả)

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npx ts-node src/scripts/createDefaultUser.ts
npm run dev
```

---

## ⚠️ NẾU VẪN LỖI

### Kiểm tra path database:

1. **Xóa file database cũ** (nếu có):
```bash
cd backend
del prisma\dev.db
del prisma\dev.db-journal
```

2. **Tạo lại database:**
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

3. **Tạo user:**
```bash
npx ts-node src/scripts/createDefaultUser.ts
```

---

## ✅ SAU KHI SỬA

Server sẽ chạy thành công và hiển thị:
```
✅ Default admin user created!
   Username: admin
   Password: admin123
🚀 Server is running on http://localhost:3000
```

