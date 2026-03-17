import express from 'express';
import { getHrTemplateGrid } from '../controllers/hrTemplates';

const router = express.Router();

router.get('/:reportType/grid', getHrTemplateGrid);

export default router;
