import express from 'express';
import {
  listVendorAssignments,
  saveVendorAssignments,
  syncVendorAssignments,
  deleteVendorAssignment,
  uploadVendorExcel,
} from '../controllers/vendorAssignments';

const router = express.Router();

router.get('/', listVendorAssignments);
router.post('/sync', syncVendorAssignments);
router.post('/', saveVendorAssignments);
router.post('/upload', ...uploadVendorExcel);
router.delete('/:code', deleteVendorAssignment);

export default router;
