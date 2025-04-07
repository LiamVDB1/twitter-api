import { Router } from 'express';
import {
    getTweet,
    getTweets,
    getLatestTweet,
    sendTweet,
    likeTweet,
    retweet
} from '../controllers/tweets';

const router = Router();

router.get('/:id', getTweet);
router.get('/user/:username', getTweets);
router.get('/latest/:username', getLatestTweet);
router.post('/', sendTweet);
router.post('/like/:id', likeTweet);
router.post('/retweet/:id', retweet);

export default router;