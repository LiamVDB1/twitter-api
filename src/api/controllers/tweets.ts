import { Request, Response, NextFunction } from 'express';
import { twitterService } from '../../services/twitter';
import { ApiError } from '../middleware/error';

// This is a new utility function to remove circular references
const sanitizeTweet = (tweet: any): any => {
    if (!tweet || typeof tweet !== 'object') {
        return tweet;
    }

    const seen = new WeakSet();

    const clean = (obj: any): any => {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (seen.has(obj)) {
            // If it's a tweet object that we've seen, return its ID.
            if (obj.id) {
                return { id: obj.id };
            }
            // For other circular references, return undefined to have JSON.stringify omit it.
            return undefined;
        }

        seen.add(obj);

        // For arrays, map over them and clean each item.
        if (Array.isArray(obj)) {
            return obj.map(item => clean(item));
        }

        // For objects, create a new object and clean each value.
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = clean(obj[key]);
            }
        }

        return newObj;
    };

    return clean(tweet);
};

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
            data: sanitizeTweet(tweet)
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

        if (thread === null) {
            throw new ApiError(404, 'Thread not found');
        }

        res.status(200).json({
            success: true,
            count: thread.thread.length,
            data: sanitizeTweet(thread)
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
            data: tweets.map(sanitizeTweet)            
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
            data: sanitizeTweet(tweet)
        });
    } catch (error) {
        next(error);
    }
};