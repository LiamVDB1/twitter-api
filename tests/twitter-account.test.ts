import { TwitterAccount, TwitterAccountConfig } from '../src/models/TwitterAccount';

describe('TwitterAccount', () => {
    let account: TwitterAccount;
    const baseConfig: TwitterAccountConfig = {
        username: 'testuser',
        password: 'password',
    };

    beforeEach(() => {
        account = new TwitterAccount(baseConfig);
    });

    describe('canUse', () => {
        it('should return false if the account is disabled', () => {
            account.disable();
            expect(account.canUse()).toBe(false);
        });

        it('should return true if the account is enabled and not rate-limited', () => {
            expect(account.canUse()).toBe(true);
        });

        it('should return false if rate limited for a specific endpoint', () => {
            const endpoint = 'tweets';
            const resetTime = Math.floor(Date.now() / 1000) + 15 * 60; // 15 minutes from now
            account.updateRateLimit(endpoint, 0, resetTime, 100);
            expect(account.canUse(endpoint)).toBe(false);
        });

        it('should return true if rate limit window has passed', () => {
            const endpoint = 'tweets';
            const resetTime = Math.floor(Date.now() / 1000) - 1; // 1 second in the past
            account.updateRateLimit(endpoint, 0, resetTime, 100);
            expect(account.canUse(endpoint)).toBe(true);
        });

        it('should return true if rate limited but still has remaining requests', () => {
            const endpoint = 'tweets';
            const resetTime = Math.floor(Date.now() / 1000) + 15 * 60;
            account.updateRateLimit(endpoint, 1, resetTime, 100);
            expect(account.canUse(endpoint)).toBe(true);
        });
    });

    describe('waitTimeFor', () => {
        it('should return 0 if not rate limited', () => {
            expect(account.waitTimeFor('tweets')).toBe(0);
        });

        it('should calculate the correct wait time in seconds', () => {
            const endpoint = 'tweets';
            const now = Math.floor(Date.now() / 1000);
            const resetTime = now + 300; // 5 minutes
            account.updateRateLimit(endpoint, 0, resetTime, 100);
            const waitTime = account.waitTimeFor(endpoint);
            expect(waitTime).toBeGreaterThanOrEqual(299);
            expect(waitTime).toBeLessThanOrEqual(300);
        });
    });

    describe('Health and Success Rate', () => {
        it('should have a success rate of 1 by default', () => {
            expect(account.getSuccessRate()).toBe(1);
        });

        it('should correctly calculate the success rate after operations', () => {
            account.recordSuccess();
            account.recordSuccess();
            account.recordFailure();
            expect(account.getSuccessRate()).toBeCloseTo(0.666);
        });

        it('should reset health metrics', () => {
            account.recordSuccess();
            account.recordFailure();
            account.resetHealth();
            const health = account.getHealth();
            expect(health.successCount).toBe(0);
            expect(health.failureCount).toBe(0);
        });
    });
}); 