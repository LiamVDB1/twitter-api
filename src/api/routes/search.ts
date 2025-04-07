import { Router } from 'express';
import { searchTweets } from '../controllers/search';

const router = Router();

router.get('/tweets', searchTweets);

export default router;