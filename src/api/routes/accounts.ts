import { Router } from 'express';
import {
    getAccountsStatus,
    enableAccount,
    disableAccount
} from '../controllers/accounts';

const router = Router();

// Get status of all accounts
router.get('/status', getAccountsStatus);

// Enable an account
router.post('/enable/:username', enableAccount);

// Disable an account
router.post('/disable/:username', disableAccount);

export default router;