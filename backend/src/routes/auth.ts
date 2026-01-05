import express from 'express';
import { login, register, getMe, createDefaultUser, forgotPassword } from '../controllers/auth';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', getMe);
router.post('/forgot-password', forgotPassword);
router.post('/create-default', createDefaultUser);
router.get('/create-default', createDefaultUser); // Allow GET for easy browser access

export default router;


