import { Router } from 'express';
import {
    getAccountsStatus,
    enableAccount,
    disableAccount,
    addAccount,
    deleteAccount
} from '../controllers/accounts';

const router = Router();

// Get status of all accounts
router.get('/status', getAccountsStatus);

// Add a new account
router.post('/', addAccount);

// Delete an account
router.delete('/:username', deleteAccount);

// Enable an account
router.post('/enable/:username', enableAccount);

// Disable an account
router.post('/disable/:username', disableAccount);

export default router;