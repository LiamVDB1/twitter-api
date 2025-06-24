import { jobService } from './jobService';
import { twitterService } from './twitter';
import { logger } from '../utils/logger';
import { sanitizeObject } from '../utils/sanitize';

const processTweetJob = async (jobId: string) => {
    const job = jobService.getJob(jobId);
    if (!job) {
        logger.error(`Job not found: ${jobId}`);
        return;
    }

    const { username, maxTweets, sinceId } = job.payload;

    try {
        logger.info(`Starting tweet fetch for job ${jobId}`, { username, maxTweets });
        jobService.updateJobStatus(jobId, 'processing');

        const tweets = await twitterService.getTweets(username, maxTweets, sinceId);
        const sanitizedTweets = tweets.map(sanitizeObject);

        logger.info(`Completed tweet fetch for job ${jobId}`, { tweetCount: sanitizedTweets.length });
        jobService.updateJobStatus(jobId, 'completed', sanitizedTweets);

    } catch (error: any) {
        logger.error(`Job ${jobId} failed`, { error: error.message });
        jobService.updateJobStatus(jobId, 'failed', undefined, error.message || 'An unknown error occurred');
    }
};

export const tweetFetcher = {
    processTweetJob,
}; 