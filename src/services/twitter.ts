import { Scraper, Tweet, SearchMode } from '@the-convocation/twitter-scraper';
import { logger } from '../utils/logger';
import { accountManager } from './AccountManager';
import { TwitterAccount } from '../models/TwitterAccount';
import he from 'he';

const TRUNCATION_SUSPICION_THRESHOLD = 265; // 280 is the actual limit, but we're using 265 to account for the word-truncation.

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
            const scraper = this.scrapers.get(account.username)!;
            const isLoggedIn = await scraper.isLoggedIn();
            if (!isLoggedIn) {
                logger.info(`Scraper for ${account.username} exists but is not logged in. Logging in now.`);
                await this.loginWithAccount(account);
            }
            return {
                scraper: this.scrapers.get(account.username)!,
                account
            };
        }

        // Create a new scraper for this account
        try {
            const scraper = new Scraper();
            this.scrapers.set(account.username, scraper);

            // Always log in when creating a new scraper instance.
            // A new scraper is never logged in, and the persisted `isLoggedIn` state might be stale.
            await this.loginWithAccount(account);

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
    async getTweets(username: string, maxTweets: number = 20, sinceId?: string) {
        // TODO: Transfer state, to another scraper when rate limited.
        const rawTweets = await this.executeOperation(async ({ scraper }) => {
            const tweetsGenerator = scraper.getTweets(username, maxTweets);
            const collectedTweets: Tweet[] = [];

            for await (const tweet of tweetsGenerator) {
                if (sinceId && tweet.id && tweet.id <= sinceId) {
                    break;
                }
                collectedTweets.push(tweet);
            }

            return collectedTweets;
        }, 'tweets');

        return this._postProcessAndFetchThreads(rawTweets, username);
    }

    /**
     * Get the latest tweet for the specified username
     */
    async getLatestTweet(username: string, includeRetweets: boolean = false) {
        const tweet = await this.executeOperation(async ({ scraper }) => {
            return scraper.getLatestTweet(username, includeRetweets);
        }, 'tweets');

        if (!tweet) {
            return null;
        }
        
        const processedTweets = await this._postProcessAndFetchThreads([tweet], username);
        return processedTweets[0];
    }

    /**
     * Search tweets using the specified query
     * @param query The search query (e.g., "from:JupiterExchange")
     * @param maxTweets The maximum number of tweets to return.
     * @param sinceId The tweet ID after which to start searching.
     * @param searchMode The search mode to use. Defaults to `Latest` for chronological results.
     */
    async searchTweets(query: string, maxTweets: number = 20, searchMode: SearchMode = SearchMode.Latest) {        
        const tweets = await this.executeOperation(async ({ scraper }) => {
            const tweetsGenerator = scraper.searchTweets(query, maxTweets, searchMode);
            const collectedTweets: Tweet[] = [];

            for await (const tweet of tweetsGenerator) {
                collectedTweets.push(tweet);
            }

            return collectedTweets;
        }, 'search');
        
        return this._postProcessAndFetchThreads(tweets);
    }

    /**
     * Fetches an entire conversation thread.
     * @param tweetId The ID of any tweet within the conversation.
     * @returns A promise that resolves to an array of Tweet objects representing the thread.
     */
    async getThread(tweetId: string): Promise<Tweet[]> {
        return this.executeOperation(async ({ scraper }) => {
            // First, get any tweet from the conversation to find the conversationId.
            const initialTweet = await scraper.getTweet(tweetId);
            if (!initialTweet?.conversationId) {
                // If it's not a real tweet or has no conversation ID, return it alone or nothing.
                return initialTweet ? [initialTweet] : [];
            }

            // A tweet's conversationId is the same as the ID of the first tweet in the thread.
            // Fetching the head tweet of the thread will return it with the `thread` property populated.
            const headTweet = await scraper.getTweet(initialTweet.conversationId);
            if (!headTweet) {
                return [];
            }

            // The `thread` property contains all subsequent tweets in the thread.
            const fullThread = [headTweet, ...headTweet.thread];
            
            // The `thread` property is not guaranteed to be ordered. Let's sort by timestamp.
            fullThread.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
            
            return fullThread;
        }, 'tweets');
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

    private _normalizeTweetText(text: string): string {
        // Use the 'he' library to decode all HTML entities.
        let normalizedText = he.decode(text);

        // Then, normalize newlines to spaces and trim.
        normalizedText = normalizedText.replace(/\n/g, ' ').trim();
        
        return normalizedText;
    }

    /**
     * Post-processes tweets to apply fixes, like fetching full text for truncated retweets.
     * @param tweets An array of tweets to process.
     * @private
     */
    private async _processTweets(tweets: Tweet[]): Promise<Tweet[]> {
        return this._executeConcurrentTasks(tweets, async (tweet) => {
            if (tweet.isRetweet && tweet.retweetedStatus) {
                const originalTweet = tweet.retweetedStatus;
                const text = originalTweet.text || '';
                const textWithoutUrl = text.replace(/\s*https?:\/\/t\.co\/\w+$/, ''); // Happens when retweeting a quote post. We don't want to count the t.co link in the length check.
                const textForLengthCheck = this._normalizeTweetText(textWithoutUrl);

                if (originalTweet.id && textForLengthCheck.length >= TRUNCATION_SUSPICION_THRESHOLD) {
                    try {
                        logger.info(`Retweet ${tweet.id} might be truncated. Fetching full tweet ${originalTweet.id}. Original length: ${text.length}, Calculated length: ${textForLengthCheck.length}, text: ${textForLengthCheck}`);
                        const fullOriginalTweet = await this.getTweet(originalTweet.id);
                        if (fullOriginalTweet) {
                            return {
                                ...tweet,
                                retweetedStatus: fullOriginalTweet,
                                text: fullOriginalTweet.text,
                                html: fullOriginalTweet.html,
                            };
                        }                    
                    } catch (error) {
                        logger.warn(`Failed to fetch full tweet for retweet ${originalTweet.id}: ${error instanceof Error ? error.message : String(error)}`);
                    }
                } else {
                    logger.info(`Retweet ${tweet.id} is not truncated. Original length: ${text.length}, Calculated length: ${textForLengthCheck.length}`);
                }
                
                // If not truncated, or if fetching the full tweet failed,
                // ensure top-level text/html is consistent with the (potentially truncated) retweet data.
                if (originalTweet) {
                    return { ...tweet, text: originalTweet.text, html: originalTweet.html };
                }
            }
            
            return tweet;
        });
    }

    private async _fetchAndMergeThreads(tweets: Tweet[], username: string): Promise<Tweet[]> {
        const threadsToFetch = new Set<string>();
        for (const tweet of tweets) {
            let conversationId: string | undefined;
            let isPotentialThread = false;

            if (tweet.isRetweet && tweet.retweetedStatus) {
                const originalTweet = tweet.retweetedStatus;
                const hasThreadEmoji = originalTweet.text?.includes('🧵');
                if (hasThreadEmoji && originalTweet.conversationId) {
                    isPotentialThread = true;
                    conversationId = originalTweet.conversationId;
                }
            } else {
                // @ts-ignore - accessing raw data
                const repliedTo = tweet.__raw_UNSTABLE?.in_reply_to_screen_name;
                const isSelfReply = tweet.isReply && (repliedTo && repliedTo.toLowerCase() === username.toLowerCase() || !repliedTo);
                const hasThreadEmoji = tweet.text?.includes('🧵');

                if (tweet.conversationId && (isSelfReply || hasThreadEmoji)) {
                    isPotentialThread = true;
                    conversationId = tweet.conversationId;
                }
            }

            if (isPotentialThread && conversationId) {
                logger.info(`Thread detected for tweet ${tweet.id}. Adding conversationId ${conversationId} to fetch queue.`);
                threadsToFetch.add(conversationId);
            }
        }

        if (threadsToFetch.size === 0) {
            return tweets;
        }

        const conversationIds = Array.from(threadsToFetch);
        const fetchedThreadsArray = await this._executeConcurrentTasks(
            conversationIds,
            async (conversationId) => {
                try {
                    const thread = await this.getThread(conversationId);
                    if (thread.length > 0) {
                        return { conversationId, thread };
                    }
                } catch (error) {
                    logger.warn(`Failed to fetch thread for conversation ${conversationId}: ${error}`);
                }
                return { conversationId, thread: null };
            }
        );

        const fetchedThreads = new Map<string, Tweet[]>();
        for (const result of fetchedThreadsArray) {
            if (result && result.thread) {
                fetchedThreads.set(result.conversationId, result.thread);
            }
        }

        const finalTweets: Tweet[] = [];
        const addedConversationIds = new Set<string>();

        for (const tweet of tweets) {
            const conversationId = tweet.isRetweet && tweet.retweetedStatus
                ? tweet.retweetedStatus.conversationId
                : tweet.conversationId;

            if (conversationId && fetchedThreads.has(conversationId)) {
                if (!addedConversationIds.has(conversationId)) {
                    finalTweets.push(...(fetchedThreads.get(conversationId) || []));
                    addedConversationIds.add(conversationId);
                }
            } else {
                finalTweets.push(tweet);
            }
        }
        
        return finalTweets;
    }

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

    private async _executeConcurrentTasks<T, R>(
        items: T[],
        taskProcessor: (item: T) => Promise<R>,
    ): Promise<R[]> {
        const concurrencyLimit = Math.max(1, accountManager.getAccountCount());
        const queue = items.map((item, index) => ({ item, index }));
        const results = new Array<R>(items.length);

        const worker = async () => {
            while (queue.length > 0) {
                const task = queue.shift();
                if (!task) continue;

                results[task.index] = await taskProcessor(task.item);
            }
        };

        const workers = Array(concurrencyLimit).fill(null).map(worker);
        await Promise.all(workers);

        return results;
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

    private async _postProcessAndFetchThreads(tweets: Tweet[], username?: string): Promise<Tweet[]> {
        const processedTweets = await this._processTweets(tweets);
        if (username) {
            return this._fetchAndMergeThreads(processedTweets, username);
        }
        return processedTweets;
    }
}

export const twitterService = new TwitterService();