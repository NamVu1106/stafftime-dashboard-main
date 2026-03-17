import express from 'express';
import { getTimekeeping, getTimekeepingById, createTimekeeping, updateTimekeeping, deleteTimekeeping, deleteAllTimekeeping, deleteAllArchivedTimekeeping, fixArchiveStatus } from '../controllers/timekeeping';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/', getTimekeeping);
router.get('/:id', getTimekeepingById);
router.post('/', authenticateToken, createTimekeeping);
router.post('/fix-archive', authenticateToken, fixArchiveStatus); // Fix archive status for existing data
router.put('/:id', authenticateToken, updateTimekeeping);
router.delete('/archived', authenticateToken, deleteAllArchivedTimekeeping); // Delete all archived records
router.delete('/:id', authenticateToken, deleteTimekeeping);
router.delete('/', authenticateToken, deleteAllTimekeeping); // Delete all records - must be before /:id route

export default router;


