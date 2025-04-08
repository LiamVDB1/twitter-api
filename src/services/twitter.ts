import { Scraper } from 'agent-twitter-client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { accountManager } from './AccountManager';
import { TwitterAccount } from '../models/TwitterAccount';
import { RateLimitTracker } from '../utils/RateLimitTracker';

class TwitterService {
    private scrapers: Map<string, Scraper> = new Map();
    private initialized: boolean = false;

    constructor() {
        this.initAccountManager();
    }

    private initAccountManager() {
        if (this.initialized) return;

        // Initialize the account manager with configured accounts
        accountManager.init(config.twitterAccounts);
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
            await scraper.login(
                account.username,
                account.password,
                account.email
            );

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
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                const profile = await scraper.getProfile(username);
                accountManager.updateAccountStatus(account, true);
                return profile;
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'profiles');
    }

    /**
     * Get a tweet by ID
     */
    async getTweet(id: string) {
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                const tweet = await scraper.getTweet(id);
                accountManager.updateAccountStatus(account, true);
                return tweet;
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'tweets');
    }

    /**
     * Get tweets for the specified username
     */
    async getTweets(username: string, maxTweets: number = 20) {
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                const tweetsGenerator = scraper.getTweets(username, maxTweets);
                const tweets = [];

                for await (const tweet of tweetsGenerator) {
                    tweets.push(tweet);
                }

                accountManager.updateAccountStatus(account, true);
                return tweets;
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'tweets');
    }

    /**
     * Get the latest tweet for the specified username
     */
    async getLatestTweet(username: string, includeRetweets: boolean = false) {
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                const tweet = await scraper.getLatestTweet(username, includeRetweets);
                accountManager.updateAccountStatus(account, true);
                return tweet;
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'tweets');
    }

    /**
     * Search tweets using the specified query
     */
    async searchTweets(query: string, maxTweets: number = 20) {
        return this.executeOperation(async ({ scraper, account }) => {
            try {
                const tweetsGenerator = scraper.searchTweets(query, maxTweets, 1); // SearchMode.Latest
                const tweets = [];

                for await (const tweet of tweetsGenerator) {
                    tweets.push(tweet);
                }

                accountManager.updateAccountStatus(account, true);
                return tweets;
            } catch (error) {
                accountManager.updateAccountStatus(account, false, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, 'search');
    }

    /**
     * Send a tweet
     */
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

    /**
     * Like a tweet
     */
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

    /**
     * Retweet a tweet
     */
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

    /**
     * Follow a user
     */
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

    /**
     * Execute an operation with a Twitter scraper
     * This wraps the operation with rate limit handling and account selection
     */
    private async executeOperation<T>(
        operation: (params: { scraper: Scraper, account: TwitterAccount }) => Promise<T>,
        endpointCategory: string
    ): Promise<T> {
        try {
            // Get the best available account
            const account = accountManager.getBestAvailableAccount(endpointCategory);

            if (!account) {
                const waitTime = accountManager.getWaitTime(endpointCategory);

                if (waitTime > 0) {
                    logger.warn(`All accounts are rate limited for ${endpointCategory}. Retry after ${waitTime} seconds.`);
                    throw new Error(`Rate limited. Retry after ${waitTime} seconds.`);
                } else {
                    throw new Error('No available Twitter accounts');
                }
            }

            // Get scraper for this account
            const { scraper, account: selectedAccount } = await this.getScraper(account);

            // Execute the operation
            const result = await operation({ scraper, account: selectedAccount });

            return result;
        } catch (error) {
            // Check if this is a rate limit error
            if (error instanceof Error &&
                (error.message.includes('Rate limit') || error.message.includes('429'))) {
                logger.warn(`Rate limit detected: ${error.message}`);

                // Handle rate limiting here
                // We've already updated the account status in the operation wrapper
            }

            throw error;
        }
    }

    /**
     * Get account statistics and status information
     */
    getAccountsStatus() {
        const accounts = accountManager.getAllAccounts();

        return accounts.map(account => ({
            username: account.username,
            isLoggedIn: account.isLoggedIn,
            disabled: account.disabled,
            health: account.getHealth(),
            successRate: account.getSuccessRate()
        }));
    }
}

export const twitterService = new TwitterService();