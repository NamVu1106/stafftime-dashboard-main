# ⚡ DEPLOY NHANH - 5 BƯỚC

## 🎯 MỤC TIÊU
Deploy dự án lên Render.com miễn phí trong 15 phút

---

## ✅ BƯỚC 1: CHUẨN BỊ (2 phút)

1. **Tạo file `backend/.env`:**
```env
PORT=3000
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-random-secret-key-here"
NODE_ENV=production
FRONTEND_URL="https://stafftime-frontend.onrender.com"
```

2. **Đảm bảo code đã sẵn sàng:**
- ✅ File `render.yaml` đã có (đã tạo sẵn)
- ✅ CORS đã cấu hình (đã cập nhật)
- ✅ Build config đã có (đã cập nhật)

---

## ✅ BƯỚC 2: ĐẨY CODE LÊN GITHUB (3 phút)

```bash
# Nếu chưa có git repo
git init
git add .
git commit -m "Prepare for deployment"
git branch -M main

# Tạo repo trên GitHub, sau đó:
git remote add origin https://github.com/YOUR_USERNAME/stafftime-dashboard.git
git push -u origin main
```

---

## ✅ BƯỚC 3: DEPLOY BACKEND (5 phút)

1. Vào https://render.com → Đăng nhập bằng GitHub

2. **New +** → **Web Service**

3. **Connect** repository của bạn

4. **Cấu hình:**
   - **Name:** `stafftime-backend`
   - **Region:** `Singapore`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build && npx prisma generate`
   - **Start Command:** `npm start`

5. **Environment Variables:**
   - `DATABASE_URL` = `file:./prisma/dev.db`
   - `JWT_SECRET` = (tạo random string)
   - `NODE_ENV` = `production`
   - `PORT` = `3000`

6. **Click "Create Web Service"**

7. **Chờ deploy xong** → Copy URL backend (ví dụ: `https://stafftime-backend-xxx.onrender.com`)

---

## ✅ BƯỚC 4: DEPLOY FRONTEND (3 phút)

1. **New +** → **Static Site**

2. **Connect** cùng repository

3. **Cấu hình:**
   - **Name:** `stafftime-frontend`
   - **Branch:** `main`
   - **Root Directory:** (để trống)
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

4. **Environment Variable:**
   - `VITE_API_URL` = `https://stafftime-backend-xxx.onrender.com/api`
   - (Thay bằng URL backend thực tế của bạn)

5. **Click "Create Static Site"**

6. **Chờ deploy xong** → Copy URL frontend

---

## ✅ BƯỚC 5: CẬP NHẬT CORS (2 phút)

1. Vào **Backend Service** trên Render

2. **Environment** tab → Thêm:
   - `FRONTEND_URL` = URL frontend của bạn

3. **Manual Deploy** → **Deploy latest commit**

4. Chờ deploy xong

---

## 🎉 HOÀN TẤT!

Bây giờ bạn có:
- ✅ Frontend: `https://stafftime-frontend.onrender.com`
- ✅ Backend: `https://stafftime-backend-xxx.onrender.com`

**Gửi URL frontend cho sếp!** 🚀

---

## ⚠️ LƯU Ý

1. **Lần đầu truy cập:** Backend có thể mất 30-60 giây để "wake up" (free tier)

2. **Tạo user admin:**
   - Vào Backend → Shell
   - Chạy: `cd backend && npx ts-node src/scripts/createDefaultUser.ts`
   - Hoặc đăng nhập với: `admin` / `admin123`

3. **Nếu lỗi:** Xem file `HUONG_DAN_DEPLOY_MIEN_PHI.md` để troubleshoot

---

## 🔧 TROUBLESHOOTING NHANH

### Frontend không kết nối Backend?
- ✅ Kiểm tra `VITE_API_URL` đúng chưa
- ✅ Kiểm tra Backend đã wake up chưa (đợi 30-60s)
- ✅ Kiểm tra CORS đã set `FRONTEND_URL` chưa

### Backend lỗi build?
- ✅ Kiểm tra `package.json` có đầy đủ dependencies
- ✅ Kiểm tra build command đúng chưa
- ✅ Xem logs trong Render dashboard

### Database lỗi?
- ✅ Chạy `npx prisma migrate deploy` trong Shell
- ✅ Kiểm tra `DATABASE_URL` đúng chưa

---

**Chúc bạn thành công! 🎉**

