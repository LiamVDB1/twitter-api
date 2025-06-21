import { Router } from 'express';
import { getProfile } from '../controllers/profiles';

const router = Router();

router.get('/:username', getProfile);

export default router;