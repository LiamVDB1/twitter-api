import { Request, Response, NextFunction } from 'express';
import { twitterService } from '../../services/twitter';
import { ApiError } from '../middleware/error';

export const getTweet = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ApiError(400, 'Tweet ID is required');
        }

        const tweet = await twitterService.getTweet(id);

        if (!tweet) {
            throw new ApiError(404, 'Tweet not found');
        }

        res.status(200).json({
            success: true,
            data: tweet
        });
    } catch (error) {
        next(error);
    }
};

export const getThread = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ApiError(400, 'Tweet ID is required');
        }

        const thread = await twitterService.getThread(id);

        if (!thread || thread.length === 0) {
            throw new ApiError(404, 'Thread not found');
        }

        res.status(200).json({
            success: true,
            count: thread.length,
            data: thread
        });
    } catch (error) {
        next(error);
    }
};

export const getTweets = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { username } = req.params;
        const maxTweets = parseInt(req.query.maxTweets as string || '20', 10);
        const sinceId = req.query.sinceId as string | undefined;

        if (!username) {
            throw new ApiError(400, 'Username is required');
        }

        const tweets = await twitterService.getTweets(username, maxTweets, sinceId);

        res.status(200).json({
            success: true,
            count: tweets.length,
            data: tweets
        });
    } catch (error) {
        next(error);
    }
};

export const getLatestTweet = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { username } = req.params;
        const includeRetweets = req.query.includeRetweets === 'true';

        if (!username) {
            throw new ApiError(400, 'Username is required');
        }

        const tweet = await twitterService.getLatestTweet(username, includeRetweets);

        if (!tweet) {
            throw new ApiError(404, 'No tweets found for this user');
        }

        res.status(200).json({
            success: true,
            data: tweet
        });
    } catch (error) {
        next(error);
    }
};