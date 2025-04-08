import { Router } from 'express';
import authRoutes from './auth';
import tweetsRoutes from './tweets';
import profilesRoutes from './profiles';
import searchRoutes from './search';
import accountsRoutes from './accounts';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/tweets', tweetsRoutes);
router.use('/profiles', profilesRoutes);
router.use('/search', searchRoutes);
router.use('/accounts', accountsRoutes);

export default router;