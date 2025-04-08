import dotenv from 'dotenv';
import path from 'path';
import { TwitterAccountConfig } from '../models/TwitterAccount';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Helper function to parse JSON from environment variable
function parseJsonEnv(envVar: string | undefined, defaultValue: any): any {
    if (!envVar) return defaultValue;

    try {
        return JSON.parse(envVar);
    } catch (error) {
        console.error(`Error parsing JSON from environment variable: ${error}`);
        return defaultValue;
    }
}

// Parse Twitter accounts from environment variables
function parseTwitterAccounts(): TwitterAccountConfig[] {
    // First try to parse accounts from TWITTER_ACCOUNTS JSON array
    const accountsJson = parseJsonEnv(process.env.TWITTER_ACCOUNTS, null);
    if (accountsJson && Array.isArray(accountsJson)) {
        return accountsJson;
    }

    // Legacy support for single account configuration
    if (process.env.TWITTER_USERNAME && process.env.TWITTER_PASSWORD) {
        return [
            {
                username: process.env.TWITTER_USERNAME,
                password: process.env.TWITTER_PASSWORD,
                email: process.env.TWITTER_EMAIL || undefined,
                priority: 1
            }
        ];
    }

    // Try to parse individual numbered accounts (TWITTER_ACCOUNT_1_USERNAME, etc.)
    const accounts: TwitterAccountConfig[] = [];
    let index = 1;

    while (true) {
        const username = process.env[`TWITTER_ACCOUNT_${index}_USERNAME`];
        const password = process.env[`TWITTER_ACCOUNT_${index}_PASSWORD`];

        if (!username || !password) {
            break;
        }

        accounts.push({
            username,
            password,
            email: process.env[`TWITTER_ACCOUNT_${index}_EMAIL`] || undefined,
            priority: parseInt(process.env[`TWITTER_ACCOUNT_${index}_PRIORITY`] || '1', 10),
            tags: process.env[`TWITTER_ACCOUNT_${index}_TAGS`]?.split(',') || [],
            disabled: process.env[`TWITTER_ACCOUNT_${index}_DISABLED`] === 'true'
        });

        index++;
    }

    return accounts;
}

export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Twitter accounts configuration
    twitterAccounts: parseTwitterAccounts(),

    // Legacy single account configuration (for backwards compatibility)
    twitterUsername: process.env.TWITTER_USERNAME || '',
    twitterPassword: process.env.TWITTER_PASSWORD || '',
    twitterEmail: process.env.TWITTER_EMAIL || '',

    // Proxy settings (optional)
    proxyUrl: process.env.PROXY_URL || '',

    // API configuration
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    },

    // Account Manager configuration
    accountManager: {
        // Automatically disable accounts with high failure rates
        disableFailingAccounts: process.env.DISABLE_FAILING_ACCOUNTS !== 'false',
        // How long to wait before retrying a disabled account (in minutes)
        retryDisabledAfter: parseInt(process.env.RETRY_DISABLED_AFTER || '60', 10),
        // Whether to rotate accounts for each request (round-robin)
        rotateAccounts: process.env.ROTATE_ACCOUNTS !== 'false'
    }
};

// Validate required environment variables
export function validateConfig() {
    if (config.twitterAccounts.length === 0) {
        throw new Error('No Twitter accounts configured. Please set TWITTER_ACCOUNTS or individual TWITTER_ACCOUNT_*_USERNAME and TWITTER_ACCOUNT_*_PASSWORD variables.');
    }
}