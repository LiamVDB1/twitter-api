import { Request, Response, NextFunction } from 'express';
import { twitterService } from '../../services/twitter';
import { ApiError } from '../middleware/error';

export const searchTweets = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { query } = req.query;
        const maxTweets = parseInt(req.query.maxTweets as string || '20', 10);

        if (!query) {
            throw new ApiError(400, 'Search query is required');
        }

        const tweets = await twitterService.searchTweets(query as string, maxTweets);

        res.status(200).json({
            success: true,
            count: tweets.length,
            data: tweets
        });
    } catch (error) {
        next(error);
    }
};