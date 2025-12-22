# 🚀 HƯỚNG DẪN DEPLOY MIỄN PHÍ LÊN RENDER.COM

## 📋 TỔNG QUAN

**Render.com** là nền tảng deploy miễn phí tốt nhất cho dự án này vì:
- ✅ **Hoàn toàn miễn phí** (free tier)
- ✅ Hỗ trợ cả **Frontend** và **Backend**
- ✅ Hỗ trợ **SQLite** (database hiện tại)
- ✅ Tự động deploy khi push code
- ✅ Có domain miễn phí (render.com)
- ✅ SSL tự động (HTTPS)

**Lưu ý:** Free tier có thể "sleep" sau 15 phút không dùng, nhưng vẫn đủ để demo cho sếp xem.

---

## 🎯 CÁC BƯỚC THỰC HIỆN

### **BƯỚC 1: CHUẨN BỊ CODE**

#### 1.1. Tạo file `.env` cho backend
Tạo file `backend/.env`:
```env
PORT=3000
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-key-change-this-in-production"
```

#### 1.2. Tạo file `render.yaml` (tự động deploy)
Tạo file `render.yaml` ở thư mục gốc:
```yaml
services:
  - type: web
    name: stafftime-backend
    env: node
    buildCommand: cd backend && npm install && npm run build && npx prisma generate
    startCommand: cd backend && npm start
    envVars:
      - key: DATABASE_URL
        value: file:./prisma/dev.db
      - key: JWT_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production
    plan: free

  - type: web
    name: stafftime-frontend
    env: node
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    envVars:
      - key: VITE_API_URL
        value: https://stafftime-backend.onrender.com/api
    plan: free
```

#### 1.3. Cập nhật `vite.config.ts` để build đúng
Đảm bảo file `vite.config.ts` có:
```typescript
export default defineConfig({
  // ... existing config
  build: {
    outDir: 'dist',
  },
});
```

#### 1.4. Tạo file `render-build.sh` cho backend
Tạo file `backend/render-build.sh`:
```bash
#!/usr/bin/env bash
npm install
npm run build
npx prisma generate
npx prisma migrate deploy
```

#### 1.5. Cập nhật CORS trong backend
Đảm bảo `backend/src/server.ts` cho phép CORS từ frontend domain:
```typescript
app.use(cors({
  origin: [
    'https://stafftime-frontend.onrender.com',
    'http://localhost:8080' // cho dev local
  ],
  credentials: true
}));
```

---

### **BƯỚC 2: ĐẨY CODE LÊN GITHUB**

1. Tạo repository mới trên GitHub
2. Push code lên:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/stafftime-dashboard.git
git push -u origin main
```

---

### **BƯỚC 3: DEPLOY BACKEND LÊN RENDER**

1. **Đăng ký/Đăng nhập Render:**
   - Vào https://render.com
   - Đăng nhập bằng GitHub

2. **Tạo Web Service cho Backend:**
   - Click **"New +"** → **"Web Service"**
   - Connect repository GitHub của bạn
   - Chọn repository `stafftime-dashboard`

3. **Cấu hình Backend:**
   ```
   Name: stafftime-backend
   Region: Singapore (gần VN nhất)
   Branch: main
   Root Directory: backend
   Environment: Node
   Build Command: npm install && npm run build && npx prisma generate
   Start Command: npm start
   ```

4. **Thêm Environment Variables:**
   - Click **"Environment"** tab
   - Thêm các biến:
     ```
     DATABASE_URL = file:./prisma/dev.db
     JWT_SECRET = (tạo random string dài)
     NODE_ENV = production
     PORT = 3000
     ```

5. **Click "Create Web Service"**
   - Render sẽ tự động build và deploy
   - Chờ 5-10 phút
   - Lưu lại URL backend (ví dụ: `https://stafftime-backend.onrender.com`)

---

### **BƯỚC 4: DEPLOY FRONTEND LÊN RENDER**

1. **Tạo Static Site cho Frontend:**
   - Click **"New +"** → **"Static Site"**
   - Connect cùng repository GitHub

2. **Cấu hình Frontend:**
   ```
   Name: stafftime-frontend
   Branch: main
   Root Directory: (để trống - root của repo)
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

3. **Thêm Environment Variable:**
   - Thêm biến:
     ```
     VITE_API_URL = https://stafftime-backend.onrender.com/api
     ```
   - (Thay bằng URL backend thực tế của bạn)

4. **Click "Create Static Site"**
   - Chờ build xong
   - Lưu lại URL frontend (ví dụ: `https://stafftime-frontend.onrender.com`)

---

### **BƯỚC 5: CẬP NHẬT CORS BACKEND**

Sau khi có URL frontend, cập nhật CORS trong backend:

1. Vào **Backend Service** trên Render
2. Vào **Environment** tab
3. Thêm biến:
   ```
   FRONTEND_URL = https://stafftime-frontend.onrender.com
   ```

4. Cập nhật code `backend/src/server.ts`:
```typescript
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
```

5. **Redeploy** backend (Render tự động deploy khi push code mới)

---

### **BƯỚC 6: KHỞI TẠO DATABASE**

1. Vào **Backend Service** trên Render
2. Click **"Shell"** tab
3. Chạy lệnh:
```bash
cd backend
npx prisma migrate deploy
npx ts-node src/scripts/createDefaultUser.ts
```

Hoặc tạo user thủ công qua API sau khi deploy.

---

## 🔧 CÁC VẤN ĐỀ THƯỜNG GẶP

### ❌ Lỗi: "Cannot find module"
**Giải pháp:** Đảm bảo `package.json` có đầy đủ dependencies và build command chạy `npm install`

### ❌ Lỗi: "Database not found"
**Giải pháp:** 
- Đảm bảo `prisma migrate deploy` chạy trong build command
- Hoặc chạy thủ công qua Shell

### ❌ Lỗi: CORS
**Giải pháp:** Kiểm tra `FRONTEND_URL` trong backend environment variables

### ❌ Frontend không kết nối được Backend
**Giải pháp:** 
- Kiểm tra `VITE_API_URL` trong frontend
- Đảm bảo backend đã chạy (không sleep)
- Kiểm tra URL backend có đúng không

### ⏰ Backend bị "sleep" (free tier)
**Giải pháp:**
- Lần đầu truy cập sẽ mất 30-60 giây để "wake up"
- Có thể dùng service như UptimeRobot để ping định kỳ (miễn phí)

---

## 🌐 TÙY CHỈNH DOMAIN (TÙY CHỌN)

Render cho phép dùng domain tùy chỉnh miễn phí:

1. Vào **Service Settings**
2. Click **"Custom Domains"**
3. Thêm domain của bạn
4. Cập nhật DNS theo hướng dẫn

---

## 📝 TÓM TẮT CÁC URL

Sau khi deploy xong, bạn sẽ có:
- **Frontend:** `https://stafftime-frontend.onrender.com`
- **Backend:** `https://stafftime-backend.onrender.com`
- **API:** `https://stafftime-backend.onrender.com/api`

**Gửi URL frontend cho sếp để xem!** 🎉

---

## 🎯 LƯU Ý QUAN TRỌNG

1. **Free tier có giới hạn:**
   - Service có thể "sleep" sau 15 phút không dùng
   - Lần đầu wake up mất 30-60 giây
   - Bandwidth có giới hạn (nhưng đủ để demo)

2. **Database SQLite:**
   - SQLite file lưu trong container
   - Nếu container restart, data có thể mất (free tier)
   - **Giải pháp:** Upgrade lên PostgreSQL (có free tier) hoặc backup định kỳ

3. **Environment Variables:**
   - Không commit file `.env` lên GitHub
   - Chỉ set trên Render dashboard

---

## 🚀 CÁCH KHÁC: RAILWAY.APP (THAY THẾ)

Nếu Render không phù hợp, có thể dùng **Railway.app**:

1. Đăng ký tại https://railway.app
2. Connect GitHub
3. Deploy tương tự
4. Railway có free tier tốt hơn (không sleep)

---

## ✅ CHECKLIST SAU KHI DEPLOY

- [ ] Backend deploy thành công
- [ ] Frontend deploy thành công
- [ ] Frontend kết nối được Backend
- [ ] Database đã migrate
- [ ] Có thể đăng nhập
- [ ] Có thể xem dashboard
- [ ] Test upload file
- [ ] Test các tính năng chính
- [ ] Gửi URL cho sếp! 🎉

---

**Chúc bạn deploy thành công! 🚀**

