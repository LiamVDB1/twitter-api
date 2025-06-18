import { Scraper } from '@the-convocation/twitter-scraper';
import { logger } from '../utils/logger';
import { accountManager } from './AccountManager';
import { TwitterAccount } from '../models/TwitterAccount';

class TwitterService {
    private scrapers: Map<string, Scraper> = new Map();
    private initialized: boolean = false;

    constructor() {}

    async init() {
        if (this.initialized) return;

        // Initialize the account manager with configured accounts
        await accountManager.init();
        this.initialized = true;

        logger.info(`Twitter service initialized with ${accountManager.getAccountCount()} accounts`);
    }

    /**
     * Get a scraper instance for the specified account
     * If no account is specified, gets the best available account
     */
    private async getScraper(account?: TwitterAccount | null): Promise<{ scraper: Scraper; account: TwitterAccount }> {
        // If no account specified, get the best available one
        if (!account) {
            account = accountManager.getBestAvailableAccount();

            if (!account) {
                throw new Error('No Twitter accounts available. All accounts may be rate limited or disabled.');
            }
        }

        // Check if we already have a scraper for this account
        if (this.scrapers.has(account.username)) {
            return {
                scraper: this.scrapers.get(account.username)!,
                account
            };
        }

        // Create a new scraper for this account
        try {
            const scraper = new Scraper();
            this.scrapers.set(account.username, scraper);

            // Log in if the account is not already logged in
            if (!account.isLoggedIn) {
                await this.loginWithAccount(account);
            }

            return { scraper, account };
        } catch (error) {
            logger.error(`Failed to create scraper for account ${account.username}: ${error}`);
            accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Login to Twitter with the specified account
     */
    private async loginWithAccount(account: TwitterAccount): Promise<boolean> {
        const scraper = this.scrapers.get(account.username);
        if (!scraper) {
            throw new Error(`No scraper found for account ${account.username}`);
        }

        try {
            if (account.email) {
                await scraper.login(
                    account.username,
                    account.password,
                    account.email
                );
            } else {
                await scraper.login(
                    account.username,
                    account.password
                );
            }

            account.isLoggedIn = await scraper.isLoggedIn() || false;
            logger.info(`Twitter login ${account.isLoggedIn ? 'successful' : 'failed'} for account ${account.username}`);

            accountManager.updateAccountStatus(account, account.isLoggedIn);
            return account.isLoggedIn;
        } catch (error) {
            logger.error(`Twitter login error for account ${account.username}: ${error}`);
            account.isLoggedIn = false;
            accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Login with the best available account
     */
    async login(): Promise<boolean> {
        const account = accountManager.getBestAvailableAccount();
        if (!account) {
            throw new Error('No Twitter accounts available');
        }

        return this.loginWithAccount(account);
    }

    /**
     * Logout of all accounts
     */
    async logout(): Promise<boolean> {
        try {
            const logoutPromises = [];

            for (const account of accountManager.getAllAccounts()) {
                if (account.isLoggedIn && this.scrapers.has(account.username)) {
                    const scraper = this.scrapers.get(account.username)!;
                    logoutPromises.push(scraper.logout());
                    account.isLoggedIn = false;
                }
            }

            await Promise.all(logoutPromises);
            logger.info('Twitter logout successful for all accounts');
            return true;
        } catch (error) {
            logger.error(`Twitter logout error: ${error}`);
            throw error;
        }
    }

    /**
     * Check login status
     */
    async isLoggedIn(): Promise<boolean> {
        try {
            // Check if any account is logged in
            for (const account of accountManager.getAllAccounts()) {
                if (this.scrapers.has(account.username)) {
                    const scraper = this.scrapers.get(account.username)!;
                    account.isLoggedIn = await scraper.isLoggedIn() || false;

                    if (account.isLoggedIn) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            logger.error(`Error checking login status: ${error}`);
            return false;
        }
    }

    /**
     * Get the profile for the specified username
     */
    async getProfile(username: string) {
        return this.executeOperation(async ({ scraper }) => {
            return scraper.getProfile(username);
        }, 'profiles');
    }

    /**
     * Get a tweet by ID
     */
    async getTweet(id: string) {
        return this.executeOperation(async ({ scraper }) => {
            return scraper.getTweet(id);
        }, 'tweets');
    }

    /**
     * Get tweets for the specified username
     */
    async getTweets(username: string, maxTweets: number = 20) {
        return this.executeOperation(async ({ scraper }) => {
            const tweetsGenerator = scraper.getTweets(username, maxTweets);
            const tweets = [];

            for await (const tweet of tweetsGenerator) {
                tweets.push(tweet);
            }

            return tweets;
        }, 'tweets');
    }

    /**
     * Get the latest tweet for the specified username
     */
    async getLatestTweet(username: string, includeRetweets: boolean = false) {
        return this.executeOperation(async ({ scraper }) => {
            return scraper.getLatestTweet(username, includeRetweets);
        }, 'tweets');
    }

    /**
     * Search tweets using the specified query
     */
    async searchTweets(query: string, maxTweets: number = 20) {
        return this.executeOperation(async ({ scraper }) => {
            const tweetsGenerator = scraper.searchTweets(query, maxTweets);
            const tweets = [];

            for await (const tweet of tweetsGenerator) {
                tweets.push(tweet);
            }

            return tweets;
        }, 'search');
    }

    /**
     *  These features are not implemented inside of the `the-convocation/twitter-scraper` package.
    async sendTweet(text: string, replyToTweetId?: string) {
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                const response = await scraper.sendTweet(text, replyToTweetId);
                accountManager.updateAccountStatus(account, true);
                return response;
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'tweets');
    }
    
    async likeTweet(tweetId: string) {
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                await scraper.likeTweet(tweetId);
                accountManager.updateAccountStatus(account, true);
                return { success: true, tweetId };
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'tweets');
    }

    async retweet(tweetId: string) {
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                await scraper.retweet(tweetId);
                accountManager.updateAccountStatus(account, true);
                return { success: true, tweetId };
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'tweets');
    }

    async followUser(username: string) {
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                await scraper.followUser(username);
                accountManager.updateAccountStatus(account, true);
                return { success: true, username };
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'profiles');
    }
    */

    /**
     * Execute an operation with a Twitter scraper
     * This wraps the operation with rate limit handling and account selection
     */
    private async executeOperation<T>(
        operation: (params: { scraper: Scraper, account: TwitterAccount }) => Promise<T>,
        endpointCategory: string
    ): Promise<T> {
        let lastError: Error | null = null;
        const attemptedAccounts = new Set<string>();

        while (attemptedAccounts.size < accountManager.getAccountCount()) {
            const account = accountManager.getBestAvailableAccount(endpointCategory);
            if (!account || attemptedAccounts.has(account.username)) {
                break;
            }

            attemptedAccounts.add(account.username);
            account.inUse = true;

            try {
                const { scraper } = await this.getScraper(account);
                const result = await operation({ scraper, account });
                accountManager.updateAccountStatus(account, true, undefined, endpointCategory);
                account.inUse = false;
                return result;
            } catch (error) {
                lastError = error as Error;
                logger.warn(`Operation failed for account ${account.username}: ${lastError.message}`);
                accountManager.updateAccountStatus(account, false, lastError.message, endpointCategory);
                account.inUse = false;
            }
        }

        throw new Error(`Operation failed for all accounts. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * DANGER: This should only be used in a test environment.
     * Resets the singleton's state.
     */
    public _resetForTest(): void {
        this.scrapers.clear();
        this.initialized = false;
        accountManager._resetForTest();
    }

    /**
     * Get account statistics and status information
     */
    getAccountsStatus() {
        return accountManager.getAllAccounts().map(account => ({
            username: account.username,
            isLoggedIn: account.isLoggedIn,
            isDisabled: account.disabled,
            health: account.getHealth(),
            rateLimits: account.getRateLimits(),
        }));
    }
}

export const twitterService = new TwitterService();