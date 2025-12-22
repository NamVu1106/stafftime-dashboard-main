import express from 'express';
import { 
  getDashboardStats, 
  getGenderStats, 
  getAgeStats, 
  getEmploymentTypeStats, 
  getAttendanceRateByDepartment,
  getGenderByEmploymentType,
  getAttendanceByDate
} from '../controllers/statistics';

const router = express.Router();

router.get('/dashboard', getDashboardStats);
router.get('/gender', getGenderStats);
router.get('/age', getAgeStats);
router.get('/employment-type', getEmploymentTypeStats);
router.get('/department', getAttendanceRateByDepartment);
router.get('/gender-by-employment-type', getGenderByEmploymentType);
router.get('/attendance-by-date', getAttendanceByDate);

export default router;


