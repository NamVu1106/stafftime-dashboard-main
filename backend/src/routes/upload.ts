import express from 'express';
import { uploadEmployees, uploadTimekeeping, uploadAvatar } from '../controllers/upload';
import { uploadEmployeesOfficial, uploadEmployeesSeasonal } from '../controllers/uploadEmployeeExcel';

const router = express.Router();

/** GET để kiểm tra backend nào đang chạy (PID) và cách gọi POST. */
router.get('/timekeeping', (_req, res) => {
  res.json({
    backend: 'mssql',
    pid: process.pid,
    path: '/api/upload/timekeeping',
    method: 'POST',
    contentType: 'multipart/form-data',
    field: 'file',
    description: 'Upload file Excel chấm công (.xlsx). Cần header Authorization: Bearer <token> nếu API có bảo vệ.',
    example: 'fetch(POST, FormData.append("file", file))',
  });
});

router.post('/employees/official', uploadEmployeesOfficial);
router.post('/employees/seasonal', uploadEmployeesSeasonal);
router.post('/employees', uploadEmployees);
router.post('/timekeeping', uploadTimekeeping);
router.post('/avatar', uploadAvatar);

export default router;

