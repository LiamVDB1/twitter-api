import { TwitterAccount, TwitterAccountConfig } from '../models/TwitterAccount';
import { logger } from '../utils/logger';
import { dbService } from './database';
import fs from 'fs';
import { config } from '../config';

/**
 * Manages a pool of Twitter accounts, providing rotation and selection strategies
 */
export class AccountManager {
    private accounts: TwitterAccount[] = [];
    private lastUsedIndex: number = -1;
    public inUse: boolean;

    constructor() {
        this.inUse = false;
    }

    /**
     * Initialize accounts from the database, seeding from a file if necessary
     */
    public async init(): Promise<void> {
        dbService.connect();
        this.seedDatabaseFromFile();
        
        this.accounts = dbService.getAccounts();
        this.accounts.sort((a, b) => a.priority - b.priority);

        logger.info(`Account manager initialized with ${this.accounts.length} accounts from database`);
    }

    private seedDatabaseFromFile(): void {
        try {
            // Check if DB is empty
            if (dbService.getAccountCount() > 0) {
                logger.info('Database is not empty, skipping seed.');
                return;
            }

            // Check if seed file exists
            if (!fs.existsSync(config.accountsFilePath)) {
                logger.warn(`Accounts file not found at ${config.accountsFilePath}, skipping seed.`);
                return;
            }

            logger.info(`Database is empty, seeding from ${config.accountsFilePath}...`);
            const fileContent = fs.readFileSync(config.accountsFilePath, 'utf-8');
            const accountConfigs: TwitterAccountConfig[] = JSON.parse(fileContent);

            for (const accConfig of accountConfigs) {
                dbService.addAccount(accConfig);
            }
            
            logger.info(`Seeded ${accountConfigs.length} accounts into the database.`);

        } catch (error) {
            logger.error(`Error seeding database from file: ${error}`);
            // Do not exit process in test environment
            if (process.env.NODE_ENV !== 'test') {
                process.exit(1);
            } else {
                throw error;
            }
        }
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
     * Add a new account to the pool and database
     */
    public addAccount(config: TwitterAccountConfig): TwitterAccount {
        // Add to DB first
        dbService.addAccount(config);
        
        // Then add to in-memory pool
        const account = new TwitterAccount(config);
        this.accounts.push(account);
        this.accounts.sort((a, b) => a.priority - b.priority);
        return account;
    }

    /**
     * Remove an account from the pool and database
     */
    public removeAccount(username: string): boolean {
        // Remove from DB first
        dbService.deleteAccount(username);

        // Then remove from in-memory pool
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

            if (!account.disabled && account.canUse(endpoint) && !account.inUse) {
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
            account => !account.disabled && account.canUse(endpoint) && !account.inUse
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
     * Update an account's status after an operation and persist it
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
        
        // Persist the updated state to the database
        dbService.updateAccountState(account);
    }

    /**
     * DANGER: This should only be used in a test environment.
     * Resets the singleton's state.
     */
    public _resetForTest(): void {
        this.accounts = [];
        this.lastUsedIndex = -1;
    }
}

// Export singleton instance
export const accountManager = new AccountManager();