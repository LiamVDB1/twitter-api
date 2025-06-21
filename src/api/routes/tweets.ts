import { Router } from 'express';
import {
    getTweet,
    getTweets,
    getLatestTweet,
    getThread
} from '../controllers/tweets';

const router = Router();

router.get('/:id', getTweet);
router.get('/thread/:id', getThread);
router.get('/user/:username', getTweets);
router.get('/latest/:username', getLatestTweet);

export default router;