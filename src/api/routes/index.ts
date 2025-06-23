import { Router } from 'express';
import accountsRouter from './accounts';
import authRouter from './auth';
import profilesRouter from './profiles';
import searchRouter from './search';
import tweetsRouter from './tweets';
import jobsRouter from './jobs';
import { twitterService } from '../../services/twitter';
import { requireApiKey } from '../middleware/auth';
import { logger } from '../../utils/logger';

const mainRouter = Router();

// Health check endpoint
mainRouter.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// All other routes are protected by API key
mainRouter.use(requireApiKey);

mainRouter.get('/status', (req, res) => {
    res.status(200).json(twitterService.getAccountsStatus());
});

mainRouter.use('/accounts', accountsRouter);
mainRouter.use('/auth', authRouter);
mainRouter.use('/profiles', profilesRouter);
mainRouter.use('/search', searchRouter);
mainRouter.use('/tweets', tweetsRouter);
mainRouter.use('/jobs', jobsRouter);

export default mainRouter;