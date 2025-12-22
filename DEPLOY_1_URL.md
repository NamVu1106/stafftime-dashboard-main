# 🚀 DEPLOY 1 URL DUY NHẤT - Frontend + Backend

## 🎯 MỤC TIÊU
Deploy cả frontend và backend trên **1 URL duy nhất** - đơn giản hơn, dễ quản lý hơn!

---

## ✅ CÁCH HOẠT ĐỘNG

- **Backend** serve cả API (`/api/*`) và frontend static files
- **1 URL duy nhất** cho tất cả: `https://stafftime-app.onrender.com`
- Frontend tự động dùng relative path `/api` để gọi backend
- Không cần cấu hình CORS phức tạp

---

## 📋 CÁC BƯỚC DEPLOY

### **BƯỚC 1: CHUẨN BỊ (1 phút)**

1. **Tạo file `backend/.env`:**
```env
PORT=3000
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-random-secret-key-here"
NODE_ENV=production
```

2. **Đảm bảo code đã được cập nhật:**
   - ✅ Backend đã serve static files (đã cập nhật)
   - ✅ Frontend dùng relative API path (đã cập nhật)
   - ✅ File `render.yaml` đã cấu hình (đã cập nhật)

---

### **BƯỚC 2: ĐẨY CODE LÊN GITHUB (2 phút)**

```bash
git add .
git commit -m "Configure for single URL deployment"
git push origin main
```

---

### **BƯỚC 3: DEPLOY LÊN RENDER (5 phút)**

1. **Vào https://render.com** → Đăng nhập bằng GitHub

2. **New +** → **Web Service**

3. **Connect** repository của bạn

4. **Cấu hình:**
   ```
   Name: stafftime-app
   Region: Singapore
   Branch: main
   Root Directory: (để trống - root của repo)
   Environment: Node
   Build Command: 
     npm install
     npm run build
     cd backend
     npm install
     npm run build
     npx prisma generate
   
   Start Command: cd backend && npm start
   ```

5. **Environment Variables:**
   - `DATABASE_URL` = `file:./prisma/dev.db`
   - `JWT_SECRET` = (tạo random string dài)
   - `NODE_ENV` = `production`
   - `PORT` = `3000`

6. **Click "Create Web Service"**

7. **Chờ deploy xong** (5-10 phút)

---

### **BƯỚC 4: KHỞI TẠO DATABASE (2 phút)**

1. Vào **Service** trên Render
2. Click **"Shell"** tab
3. Chạy lệnh:
```bash
cd backend
npx prisma migrate deploy
npx ts-node src/scripts/createDefaultUser.ts
```

Hoặc tạo user thủ công sau khi deploy.

---

## 🎉 HOÀN TẤT!

Bây giờ bạn có **1 URL duy nhất:**
- ✅ **https://stafftime-app.onrender.com** - Frontend + Backend
- ✅ API: `https://stafftime-app.onrender.com/api/*`
- ✅ Frontend: `https://stafftime-app.onrender.com/*`

**Gửi URL này cho sếp!** 🚀

---

## 🔧 CÁCH HOẠT ĐỘNG

### **Cấu trúc:**
```
https://stafftime-app.onrender.com
├── /api/*          → Backend API
├── /uploads/*      → Uploaded files
└── /*              → Frontend React App
```

### **Luồng request:**
1. User truy cập: `https://stafftime-app.onrender.com`
2. Backend serve file `index.html` từ `dist/`
3. React Router xử lý routing
4. Frontend gọi API qua `/api/*` (relative path)
5. Backend xử lý API requests

---

## ⚠️ LƯU Ý

1. **Lần đầu truy cập:** Service có thể mất 30-60 giây để "wake up" (free tier)

2. **Tạo user admin:**
   - Đăng nhập với: `admin` / `admin123`
   - Hoặc tạo qua Shell như trên

3. **Build time:** Lần đầu build mất 5-10 phút (build cả frontend + backend)

4. **File uploads:** Files upload sẽ lưu trong container, có thể mất khi restart (free tier)

---

## 🐛 TROUBLESHOOTING

### ❌ Lỗi: "Cannot GET /"
**Nguyên nhân:** Frontend chưa được build hoặc path sai
**Giải pháp:** 
- Kiểm tra build command có chạy `npm run build` không
- Kiểm tra `dist/` folder có tồn tại không

### ❌ Lỗi: "API not found"
**Nguyên nhân:** API path không đúng
**Giải pháp:**
- Kiểm tra frontend dùng `/api` (relative path)
- Kiểm tra backend routes có prefix `/api` không

### ❌ Lỗi: "Database not found"
**Nguyên nhân:** Chưa chạy migration
**Giải pháp:**
- Chạy `npx prisma migrate deploy` trong Shell

### ❌ Frontend không load
**Nguyên nhân:** Path static files sai
**Giải pháp:**
- Kiểm tra `frontendDistPath` trong `server.ts` đúng chưa
- Đảm bảo build frontend tạo folder `dist/` ở root

---

## 📝 SO SÁNH VỚI CÁCH CŨ

| | Cách cũ (2 URLs) | Cách mới (1 URL) |
|---|---|---|
| **URLs** | 2 URLs riêng biệt | 1 URL duy nhất |
| **CORS** | Cần cấu hình phức tạp | Không cần (cùng origin) |
| **Quản lý** | 2 services | 1 service |
| **Độ phức tạp** | Cao hơn | Đơn giản hơn |
| **Phù hợp** | Production lớn | Demo, MVP |

---

## ✅ CHECKLIST

- [ ] Code đã được cập nhật (backend serve static, frontend dùng relative path)
- [ ] File `render.yaml` đã cấu hình
- [ ] Đã push code lên GitHub
- [ ] Đã tạo service trên Render
- [ ] Build thành công
- [ ] Database đã migrate
- [ ] Có thể truy cập frontend
- [ ] API hoạt động
- [ ] Có thể đăng nhập
- [ ] Gửi URL cho sếp! 🎉

---

**Chúc bạn deploy thành công! 🚀**

