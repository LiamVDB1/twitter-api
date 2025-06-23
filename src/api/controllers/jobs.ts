import { Request, Response, NextFunction } from 'express';
import { jobService } from '../../services/jobService';
import { tweetFetcher } from '../../services/tweetFetcher';
import { ApiError } from '../middleware/error';

export const createTweetJob = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { username } = req.params;
        const { maxTweets, sinceId } = req.query;

        if (!username) {
            throw new ApiError(400, 'Username is required');
        }

        const payload = {
            username,
            maxTweets: maxTweets ? parseInt(maxTweets as string, 10) : 100,
            sinceId: sinceId as string | undefined,
        };

        const job = jobService.createJob(payload);

        // Start the job processing in the background, but do not wait for it
        tweetFetcher.processTweetJob(job.id);

        res.status(202).json({
            success: true,
            jobId: job.id,
        });

    } catch (error) {
        next(error);
    }
};

export const getJobStatus = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const job = jobService.getJob(id);

        if (!job) {
            throw new ApiError(404, 'Job not found');
        }

        const response: any = {
            jobId: job.id,
            status: job.status,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };

        if (job.status === 'completed') {
            response.result = job.result;
        } else if (job.status === 'failed') {
            response.error = job.error;
        }

        res.status(200).json({
            success: true,
            data: response,
        });

    } catch (error) {
        next(error);
    }
}; 