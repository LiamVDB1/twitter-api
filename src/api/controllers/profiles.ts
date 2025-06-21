import { Request, Response, NextFunction } from 'express';
import { twitterService } from '../../services/twitter';
import { ApiError } from '../middleware/error';

export const getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { username } = req.params;

        if (!username) {
            throw new ApiError(400, 'Username is required');
        }

        const profile = await twitterService.getProfile(username);

        if (!profile) {
            throw new ApiError(404, 'Profile not found');
        }

        res.status(200).json({
            success: true,
            data: profile
        });
    } catch (error) {
        next(error);
    }
};