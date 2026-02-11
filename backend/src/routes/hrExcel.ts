import express from 'express';
import {
  uploadHrExcel,
  getLatestHrExcelUpload,
  getHrExcelUploadById,
  getHrExcelSheetView,
  getHrExcelReportStats,
  getHrExcelStatus,
} from '../controllers/hrExcel';

const router = express.Router();

// Upload a HR Excel file for a specific report type
router.post('/upload', uploadHrExcel);

// Get derived stats from latest upload (per report_type)
router.get('/stats', getHrExcelReportStats);

// Trạng thái upload + file + parser cho từng loại (dashboard)
router.get('/status', getHrExcelStatus);

// Get latest upload metadata for a report type
router.get('/latest', getLatestHrExcelUpload);

// Get a specific upload metadata
router.get('/:id', getHrExcelUploadById);

// Get a sheet view (paged grid) for a given upload + sheetName
router.get('/:id/sheets/:sheetName', getHrExcelSheetView);

export default router;

