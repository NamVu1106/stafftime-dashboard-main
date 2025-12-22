import express from 'express';
import { uploadEmployees, uploadTimekeeping, uploadAvatar } from '../controllers/upload';

const router = express.Router();

router.post('/employees', uploadEmployees);
router.post('/timekeeping', uploadTimekeeping);
router.post('/avatar', uploadAvatar);

export default router;

