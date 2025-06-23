import { Router } from 'express';
import { createTweetJob, getJobStatus } from '../controllers/jobs';

const router = Router();

// Route to create a new tweet fetching job
router.post('/tweets/:username', createTweetJob);

// Route to get the status of a job
router.get('/:id', getJobStatus);

export default router; 