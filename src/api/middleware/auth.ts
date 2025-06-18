import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { ApiError } from './error';
import { logger } from '../../utils/logger';

export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.get('X-API-Key');

    if (!config.apiKey) {
        logger.warn('API key is not set in the configuration. Denying all requests.');
        return next(new ApiError(500, 'Server configuration error: API key not set.'));
    }

    if (!apiKey || apiKey !== config.apiKey) {
        logger.warn(`Invalid or missing API key. Request denied from ${req.ip}`);
        return next(new ApiError(401, 'Unauthorized: Invalid or missing API key.'));
    }

    next();
}; 