import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  attachSecurityScope,
  requireSecurityReportAccess,
} from '../middleware/securityPermission';
import {
  getSecurityDepartments,
  getDepartmentTemplate,
  resolveAssetByQr,
  saveInspection,
  submitInspection,
  syncInspections,
  getSecurityReportSummary,
  getSecurityManagementDashboard,
  exportSecurityReport,
  getMySecurityScope,
} from '../controllers/securityInspection';

const router = express.Router();

router.use(authenticateToken);
router.use(attachSecurityScope);

router.get('/me/scope', getMySecurityScope);
router.get('/departments', getSecurityDepartments);
router.get('/departments/:id/template', getDepartmentTemplate);
router.get('/assets/resolve', resolveAssetByQr);
router.post('/inspections', saveInspection);
router.post('/inspections/submit', submitInspection);
router.post('/sync', syncInspections);

router.get('/reports/summary', requireSecurityReportAccess, getSecurityReportSummary);
router.get('/reports/dashboard', requireSecurityReportAccess, getSecurityManagementDashboard);
router.get('/reports/export', requireSecurityReportAccess, exportSecurityReport);

export default router;
