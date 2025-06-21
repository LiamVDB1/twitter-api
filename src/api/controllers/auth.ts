import { Request, Response, NextFunction } from 'express';
import { twitterService } from '../../services/twitter';
import { ApiError } from '../middleware/error';

export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const success = await twitterService.login();

        if (!success) {
            throw new ApiError(401, 'Login failed');
        }

        res.status(200).json({
            success: true,
            message: 'Login successful'
        });
    } catch (error) {
        next(error);
    }
};

export const logout = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        await twitterService.logout();

        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        next(error);
    }
};

export const status = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const isLoggedIn = await twitterService.isLoggedIn();

        res.status(200).json({
            success: true,
            loggedIn: isLoggedIn
        });
    } catch (error) {
        next(error);
    }
};