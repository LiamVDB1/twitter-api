import { Request, Response, NextFunction } from 'express';
import { twitterService } from '../../services/twitter';
import { ApiError } from '../middleware/error';
import { SearchMode } from '@the-convocation/twitter-scraper';

function isSearchMode(value: any): value is SearchMode {
    return Object.values(SearchMode).includes(value);
}

export const searchTweets = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { query, searchMode: searchModeStr } = req.query;
        const maxTweets = parseInt(req.query.maxTweets as string || '20', 10);

        if (!query) {
            throw new ApiError(400, 'Search query is required');
        }

        let searchMode: SearchMode = SearchMode.Latest;
        if (isSearchMode(searchModeStr)) {
            searchMode = searchModeStr;
        }

        const tweets = await twitterService.searchTweets(query as string, maxTweets, searchMode);

        res.status(200).json({
            success: true,
            count: tweets.length,
            data: tweets
        });
    } catch (error) {
        next(error);
    }
};