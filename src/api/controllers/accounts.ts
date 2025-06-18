import { Request, Response, NextFunction } from 'express';
import { twitterService } from '../../services/twitter';
import { accountManager } from '../../services/AccountManager';
import { ApiError } from '../middleware/error';
import { TwitterAccountConfig } from '../../models/TwitterAccount';

/**
 * Get status of all accounts
 */
export const getAccountsStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const accountsStatus = twitterService.getAccountsStatus();

        res.status(200).json({
            success: true,
            count: accountsStatus.length,
            data: accountsStatus
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add a new account
 */
export const addAccount = async (
    req: Request<{}, {}, TwitterAccountConfig>,
    res: Response,
    next: NextFunction
) => {
    try {
        const accountConfig = req.body;

        if (!accountConfig.username || !accountConfig.password) {
            throw new ApiError(400, 'Username and password are required');
        }

        const addedAccount = accountManager.addAccount(accountConfig);
        
        res.status(201).json({
            success: true,
            message: `Account ${addedAccount.username} added successfully.`,
            data: {
                username: addedAccount.username,
                disabled: addedAccount.disabled
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Remove an account
 */
export const deleteAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { username } = req.params;

        if (!username) {
            throw new ApiError(400, 'Username is required');
        }
        
        const success = accountManager.removeAccount(username);

        if (!success) {
            throw new ApiError(404, 'Account not found');
        }
        
        res.status(200).json({
            success: true,
            message: `Account ${username} removed successfully.`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Enable an account
 */
export const enableAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { username } = req.params;

        if (!username) {
            throw new ApiError(400, 'Username is required');
        }

        const account = accountManager.getAccount(username);
        if (!account) {
            throw new ApiError(404, 'Account not found');
        }

        account.enable();

        res.status(200).json({
            success: true,
            message: `Account ${username} enabled`,
            data: {
                username: account.username,
                disabled: account.disabled,
                isLoggedIn: account.isLoggedIn
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Disable an account
 */
export const disableAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { username } = req.params;

        if (!username) {
            throw new ApiError(400, 'Username is required');
        }

        const account = accountManager.getAccount(username);
        if (!account) {
            throw new ApiError(404, 'Account not found');
        }

        account.disable();

        res.status(200).json({
            success: true,
            message: `Account ${username} disabled`,
            data: {
                username: account.username,
                disabled: account.disabled,
                isLoggedIn: account.isLoggedIn
            }
        });
    } catch (error) {
        next(error);
    }
};