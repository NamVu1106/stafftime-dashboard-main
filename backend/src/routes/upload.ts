import express from 'express';
import { uploadEmployees, uploadTimekeeping, uploadAvatar } from '../controllers/upload';
import { uploadEmployeesOfficial, uploadEmployeesSeasonal } from '../controllers/uploadEmployeeExcel';

const router = express.Router();

router.post('/employees/official', uploadEmployeesOfficial);
router.post('/employees/seasonal', uploadEmployeesSeasonal);
router.post('/employees', uploadEmployees);
router.post('/timekeeping', uploadTimekeeping);
router.post('/avatar', uploadAvatar);

export default router;

