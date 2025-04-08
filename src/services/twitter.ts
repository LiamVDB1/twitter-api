import { Scraper } from 'agent-twitter-client';
import { config } from '../config';
import { logger } from '../utils/logger';

class TwitterService {
    private scraper: Scraper | null = null;
    private isLoggedIn: boolean = false;

    constructor() {
        this.initScraper();
    }

    private initScraper() {
        try {
            this.scraper = new Scraper();
            logger.info('Twitter scraper initialized');
        } catch (error) {
            logger.error(`Failed to initialize Twitter scraper: ${error}`);
            throw error;
        }
    }

    async login() {
        if (!this.scraper) {
            this.initScraper();
        }

        if (this.isLoggedIn) {
            return true;
        }

        try {
            const {
                twitterUsername,
                twitterPassword,
                twitterEmail
            } = config;

            // Basic login with just username/password/email - no API keys needed
            await this.scraper?.login(
                twitterUsername,
                twitterPassword,
                twitterEmail
            );

            this.isLoggedIn = await this.scraper?.isLoggedIn() || false;
            logger.info(`Twitter login ${this.isLoggedIn ? 'successful' : 'failed'}`);
            return this.isLoggedIn;
        } catch (error) {
            logger.error(`Twitter login error: ${error}`);
            this.isLoggedIn = false;
            throw error;
        }
    }

    async logout() {
        try {
            await this.scraper?.logout();
            this.isLoggedIn = false;
            logger.info('Twitter logout successful');
            return true;
        } catch (error) {
            logger.error(`Twitter logout error: ${error}`);
            throw error;
        }
    }

    async getProfile(username: string) {
        await this.ensureLoggedIn();
        try {
            return await this.scraper?.getProfile(username);
        } catch (error) {
            logger.error(`Error getting profile for ${username}: ${error}`);
            throw error;
        }
    }

    async getTweet(id: string) {
        await this.ensureLoggedIn();
        try {
            return await this.scraper?.getTweet(id);
        } catch (error) {
            logger.error(`Error getting tweet ${id}: ${error}`);
            throw error;
        }
    }

    async getTweets(username: string, maxTweets: number = 20) {
        await this.ensureLoggedIn();
        try {
            const tweetsGenerator = this.scraper?.getTweets(username, maxTweets);
            if (!tweetsGenerator) {
                return [];
            }

            const tweets = [];
            for await (const tweet of tweetsGenerator) {
                tweets.push(tweet);
            }
            return tweets;
        } catch (error) {
            logger.error(`Error getting tweets for ${username}: ${error}`);
            throw error;
        }
    }

    async getLatestTweet(username: string, includeRetweets: boolean = false) {
        await this.ensureLoggedIn();
        try {
            return await this.scraper?.getLatestTweet(username, includeRetweets);
        } catch (error) {
            logger.error(`Error getting latest tweet for ${username}: ${error}`);
            throw error;
        }
    }

    async searchTweets(query: string, maxTweets: number = 20) {
        await this.ensureLoggedIn();
        try {
            const tweetsGenerator = this.scraper?.searchTweets(query, maxTweets);
            if (!tweetsGenerator) {
                return [];
            }

            const tweets = [];
            for await (const tweet of tweetsGenerator) {
                tweets.push(tweet);
            }
            return tweets;
        } catch (error) {
            logger.error(`Error searching tweets for "${query}": ${error}`);
            throw error;
        }
    }

    async sendTweet(text: string, replyToTweetId?: string) {
        await this.ensureLoggedIn();
        try {
            return await this.scraper?.sendTweet(text, replyToTweetId);
        } catch (error) {
            logger.error(`Error sending tweet: ${error}`);
            throw error;
        }
    }

    async likeTweet(tweetId: string) {
        await this.ensureLoggedIn();
        try {
            await this.scraper?.likeTweet(tweetId);
            return { success: true, tweetId };
        } catch (error) {
            logger.error(`Error liking tweet ${tweetId}: ${error}`);
            throw error;
        }
    }

    async retweet(tweetId: string) {
        await this.ensureLoggedIn();
        try {
            await this.scraper?.retweet(tweetId);
            return { success: true, tweetId };
        } catch (error) {
            logger.error(`Error retweeting tweet ${tweetId}: ${error}`);
            throw error;
        }
    }

    async followUser(username: string) {
        await this.ensureLoggedIn();
        try {
            await this.scraper?.followUser(username);
            return { success: true, username };
        } catch (error) {
            logger.error(`Error following user ${username}: ${error}`);
            throw error;
        }
    }

    private async ensureLoggedIn() {
        if (!this.isLoggedIn) {
            await this.login();
        }
        return this.isLoggedIn;
    }
}

export const twitterService = new TwitterService();