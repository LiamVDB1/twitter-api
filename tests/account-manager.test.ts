import { AccountManager } from '../src/services/AccountManager';
import { TwitterAccount, TwitterAccountConfig } from '../src/models/TwitterAccount';
import { dbService } from '../src/services/database';

// Mock the database service
jest.mock('../src/services/database', () => ({
    dbService: {
        connect: jest.fn(),
        getAccounts: jest.fn(),
        updateAccountState: jest.fn(),
        getAccountCount: jest.fn().mockReturnValue(0),
        addAccount: jest.fn(),
        deleteAccount: jest.fn(),
    },
}));

describe('AccountManager', () => {
    let accountManager: AccountManager;

    // Helper to create mock accounts
    const createMockAccount = (config: Partial<TwitterAccountConfig>, successRate: number, inUse: boolean = false): TwitterAccount => {
        const acc = new TwitterAccount({ username: 'default', password: 'password', ...config });
        const successCount = successRate * 10;
        const failureCount = 10 - successCount;
        (acc as any).health = { successCount, failureCount, lastSuccess: null, lastFailure: null };
        acc.inUse = inUse;
        return acc;
    };

    beforeEach(async () => {
        // Reset the singleton instance for true test isolation
        // This is a common pattern for testing singletons
        jest.isolateModules(() => {
            const am = require('../src/services/AccountManager');
            accountManager = new am.AccountManager();
        });
    });

    describe('getBestAvailableAccount', () => {
        it('should return the account with the highest success rate', async () => {
            const acc1 = createMockAccount({ username: 'acc1', priority: 2 }, 0.7);
            const acc2 = createMockAccount({ username: 'acc2', priority: 1 }, 0.9); // Best
            const acc3 = createMockAccount({ username: 'acc3', priority: 3 }, 0.5);
            (dbService.getAccounts as jest.Mock).mockReturnValue([acc1, acc2, acc3]);
            await accountManager.init();

            const bestAccount = accountManager.getBestAvailableAccount();
            expect(bestAccount).toBe(acc2);
        });

        it('should not return disabled accounts', async () => {
            const acc1 = createMockAccount({ username: 'acc1' }, 0.7);
            const acc2 = createMockAccount({ username: 'acc2', disabled: true }, 0.9); // Disabled
            (dbService.getAccounts as jest.Mock).mockReturnValue([acc1, acc2]);
            await accountManager.init();

            const bestAccount = accountManager.getBestAvailableAccount();
            expect(bestAccount).toBe(acc1);
        });

        it('should not return accounts that are in use', async () => {
            const acc1 = createMockAccount({ username: 'acc1' }, 0.7);
            const acc2 = createMockAccount({ username: 'acc2' }, 0.9, true); // In Use
            (dbService.getAccounts as jest.Mock).mockReturnValue([acc1, acc2]);
            await accountManager.init();

            const bestAccount = accountManager.getBestAvailableAccount();
            expect(bestAccount).toBe(acc1);
        });

        it('should return null if all accounts are unavailable', async () => {
            const acc1 = createMockAccount({ username: 'acc1', disabled: true }, 0.7);
            const acc2 = createMockAccount({ username: 'acc2' }, 0.9, true);
            (dbService.getAccounts as jest.Mock).mockReturnValue([acc1, acc2]);
            await accountManager.init();

            const bestAccount = accountManager.getBestAvailableAccount();
            expect(bestAccount).toBeNull();
        });
    });

    describe('updateAccountStatus', () => {
        it('should call recordSuccess on success', async () => {
            const acc = createMockAccount({ username: 'acc1' }, 1);
            const recordSuccessSpy = jest.spyOn(acc, 'recordSuccess');
            accountManager.updateAccountStatus(acc, true);
            expect(recordSuccessSpy).toHaveBeenCalled();
            expect(dbService.updateAccountState).toHaveBeenCalledWith(acc);
        });

        it('should call recordFailure on failure', async () => {
            const acc = createMockAccount({ username: 'acc1' }, 1);
            const recordFailureSpy = jest.spyOn(acc, 'recordFailure');
            accountManager.updateAccountStatus(acc, false, 'Some error');
            expect(recordFailureSpy).toHaveBeenCalledWith('Some error');
            expect(dbService.updateAccountState).toHaveBeenCalledWith(acc);
        });

        it('should disable an account with a high failure rate', async () => {
            const acc = createMockAccount({ username: 'acc1' }, 0.1); // Low success rate
            (acc as any).health.failureCount = 6; // High failure count
            const disableSpy = jest.spyOn(acc, 'disable');
            
            accountManager.updateAccountStatus(acc, false, 'Another error');
            
            expect(disableSpy).toHaveBeenCalled();
            expect(dbService.updateAccountState).toHaveBeenCalledWith(acc);
        });
    });
}); 