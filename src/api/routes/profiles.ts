import { Router } from 'express';
import { getProfile, followUser } from '../controllers/profiles';

const router = Router();

router.get('/:username', getProfile);
router.post('/follow/:username', followUser);

export default router;