import express from 'express';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  deleteAllEmployees,
} from '../controllers/employees';

const router = express.Router();

router.get('/', getEmployees);
router.get('/:id', getEmployeeById);
router.post('/', createEmployee);
router.put('/:id', updateEmployee);
// Xóa tất cả nhân viên - để route này TRƯỚC '/:id' để tránh bị hiểu nhầm là id
router.delete('/', deleteAllEmployees);
router.delete('/:id', deleteEmployee);

export default router;


