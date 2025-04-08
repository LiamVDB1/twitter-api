import { TwitterAccount, TwitterAccountConfig } from '../models/TwitterAccount';
import { logger } from '../utils/logger';

/**
 * Manages a pool of Twitter accounts, providing rotation and selection strategies
 */
export class AccountManager {
    private accounts: TwitterAccount[] = [];
    private lastUsedIndex: number = -1;

    constructor() {}

    /**
     * Initialize accounts from configuration
     */
    public init(accountConfigs: TwitterAccountConfig[]): void {
        this.accounts = accountConfigs.map(config => new TwitterAccount(config));
        this.accounts.sort((a, b) => a.priority - b.priority);

        logger.info(`Account manager initialized with ${this.accounts.length} accounts`);
    }

    /**
     * Get number of accounts
     */
    public getAccountCount(): number {
        return this.accounts.length;
    }

    /**
     * Get number of available accounts
     */
    public getAvailableAccountCount(endpoint?: string): number {
        return this.accounts.filter(account =>
            !account.disabled && account.canUse(endpoint)
        ).length;
    }

    /**
     * Get all accounts
     */
    public getAllAccounts(): TwitterAccount[] {
        return [...this.accounts];
    }

    /**
     * Get account by username
     */
    public getAccount(username: string): TwitterAccount | undefined {
        return this.accounts.find(account => account.username === username);
    }

    /**
     * Add a new account to the pool
     */
    public addAccount(config: TwitterAccountConfig): TwitterAccount {
        const account = new TwitterAccount(config);
        this.accounts.push(account);
        this.accounts.sort((a, b) => a.priority - b.priority);
        return account;
    }

    /**
     * Remove an account from the pool
     */
    public removeAccount(username: string): boolean {
        const index = this.accounts.findIndex(account => account.username === username);
        if (index === -1) return false;

        this.accounts.splice(index, 1);
        return true;
    }

    /**
     * Get the next available account using round-robin selection
     */
    public getNextAvailableAccount(endpoint?: string): TwitterAccount | null {
        if (this.accounts.length === 0) {
            return null;
        }

        // Try to find an available account starting from the next one after last used
        const startIndex = (this.lastUsedIndex + 1) % this.accounts.length;

        for (let i = 0; i < this.accounts.length; i++) {
            const index = (startIndex + i) % this.accounts.length;
            const account = this.accounts[index];

            if (!account.disabled && account.canUse(endpoint)) {
                this.lastUsedIndex = index;
                return account;
            }
        }

        // No available account found
        return null;
    }

    /**
     * Get the best available account based on health metrics and rate limits
     */
    public getBestAvailableAccount(endpoint?: string): TwitterAccount | null {
        if (this.accounts.length === 0) {
            return null;
        }

        // Filter available accounts
        const availableAccounts = this.accounts.filter(
            account => !account.disabled && account.canUse(endpoint)
        );

        if (availableAccounts.length === 0) {
            return null;
        }

        // Sort by success rate (highest first)
        availableAccounts.sort((a, b) => b.getSuccessRate() - a.getSuccessRate());

        return availableAccounts[0];
    }

    /**
     * Get wait time until an account is available for the given endpoint
     * @returns Wait time in seconds, or 0 if an account is available now
     */
    public getWaitTime(endpoint: string): number {
        if (this.getAvailableAccountCount(endpoint) > 0) {
            return 0;
        }

        // Find the account with the shortest wait time
        let minWaitTime = Number.MAX_SAFE_INTEGER;

        for (const account of this.accounts) {
            if (account.disabled) continue;

            const waitTime = account.waitTimeFor(endpoint);
            if (waitTime < minWaitTime) {
                minWaitTime = waitTime;
            }
        }

        return minWaitTime === Number.MAX_SAFE_INTEGER ? 0 : minWaitTime;
    }

    /**
     * Update an account's status after an operation
     */
    public updateAccountStatus(
        account: TwitterAccount,
        success: boolean,
        error?: string,
        endpoint?: string,
        rateLimit?: {remaining: number, reset: number, limit: number}
    ): void {
        if (success) {
            account.recordSuccess();
        } else {
            account.recordFailure(error);

            // If the account has a high failure rate, disable it
            if (account.getHealth().failureCount > 5 && account.getSuccessRate() < 0.2) {
                logger.warn(`Disabling account ${account.username} due to high failure rate`);
                account.disable();
            }
        }

        // Update rate limit information if provided
        if (endpoint && rateLimit) {
            account.updateRateLimit(
                endpoint,
                rateLimit.remaining,
                rateLimit.reset,
                rateLimit.limit
            );
        }
    }
}

// Export singleton instance
export const accountManager = new AccountManager();