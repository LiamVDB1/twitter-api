import { Router } from 'express';
import { login, logout, status } from '../controllers/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/status', status);

export default router;