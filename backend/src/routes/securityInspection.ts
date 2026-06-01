import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  attachSecurityScope,
  requireSecurityReportAccess,
  requireSecurityAssetAdmin,
} from '../middleware/securityPermission';
import {
  getChecklistEditorTemplate,
  createChecklistCategory,
  updateChecklistCategory,
  deleteChecklistCategory,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklist,
} from '../controllers/securityChecklistAdmin';
import {
  listSecurityAssets,
  createSecurityAsset,
  updateSecurityAsset,
  regenerateAssetQr,
  exportAssetLabelsPdf,
} from '../controllers/securityAssets';
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
  getCriticalAlerts,
  getFailureHistory,
  resolveInspectionResult,
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
router.get('/reports/critical-alerts', requireSecurityReportAccess, getCriticalAlerts);
router.get('/reports/failure-history', requireSecurityReportAccess, getFailureHistory);
router.post('/reports/results/:id/resolve', requireSecurityReportAccess, resolveInspectionResult);
router.get('/reports/export', requireSecurityReportAccess, exportSecurityReport);

router.get('/admin/checklist-editor/:deptId', requireSecurityAssetAdmin, getChecklistEditorTemplate);
router.post('/admin/checklist-editor/:deptId/categories', requireSecurityAssetAdmin, createChecklistCategory);
router.post('/admin/checklist-editor/:deptId/reorder', requireSecurityAssetAdmin, reorderChecklist);
router.patch('/admin/checklist-editor/categories/:catId', requireSecurityAssetAdmin, updateChecklistCategory);
router.delete('/admin/checklist-editor/categories/:catId', requireSecurityAssetAdmin, deleteChecklistCategory);
router.post('/admin/checklist-editor/categories/:catId/items', requireSecurityAssetAdmin, createChecklistItem);
router.patch('/admin/checklist-editor/items/:itemId', requireSecurityAssetAdmin, updateChecklistItem);
router.delete('/admin/checklist-editor/items/:itemId', requireSecurityAssetAdmin, deleteChecklistItem);

router.get('/assets/labels/pdf', requireSecurityAssetAdmin, exportAssetLabelsPdf);
router.get('/assets', requireSecurityAssetAdmin, listSecurityAssets);
router.post('/assets', requireSecurityAssetAdmin, createSecurityAsset);
router.patch('/assets/:id', requireSecurityAssetAdmin, updateSecurityAsset);
router.post('/assets/:id/regenerate-qr', requireSecurityAssetAdmin, regenerateAssetQr);

export default router;
