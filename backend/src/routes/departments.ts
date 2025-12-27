import express from 'express';
import { getDepartmentStats } from '../controllers/departments';

const router = express.Router();

router.get('/:dept/stats', getDepartmentStats);

export default router;





