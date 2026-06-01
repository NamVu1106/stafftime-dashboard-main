import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  getSecurityDepartments,
  getDepartmentTemplate,
  resolveAssetByQr,
  saveInspection,
  submitInspection,
  syncInspections,
  getSecurityReportSummary,
  getSecurityManagementDashboard,
} from '../controllers/securityInspection';

const router = express.Router();

router.get('/departments', authenticateToken, getSecurityDepartments);
router.get('/departments/:id/template', authenticateToken, getDepartmentTemplate);
router.get('/assets/resolve', authenticateToken, resolveAssetByQr);
router.post('/inspections', authenticateToken, saveInspection);
router.post('/inspections/submit', authenticateToken, submitInspection);
router.post('/sync', authenticateToken, syncInspections);
router.get('/reports/summary', authenticateToken, requireAdmin, getSecurityReportSummary);
router.get('/reports/dashboard', authenticateToken, requireAdmin, getSecurityManagementDashboard);

export default router;
