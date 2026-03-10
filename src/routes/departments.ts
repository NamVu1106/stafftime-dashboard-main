import express from 'express';
import { getDepartmentsList, getDepartmentStats, getDepartmentsFromExcel } from '../controllers/departments';

const router = express.Router();

router.get('/from-excel', getDepartmentsFromExcel);
router.get('/', getDepartmentsList);
router.get('/:dept/stats', getDepartmentStats);

export default router;

















