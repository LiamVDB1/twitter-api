import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Twitter credentials - these are the only REQUIRED values
    twitterUsername: process.env.TWITTER_USERNAME || '',
    twitterPassword: process.env.TWITTER_PASSWORD || '',
    twitterEmail: process.env.TWITTER_EMAIL || '',

    // Proxy settings (optional)
    proxyUrl: process.env.PROXY_URL || '',

    // API configuration
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    }
};

// Validate required environment variables
export function validateConfig() {
    const requiredVars = ['TWITTER_USERNAME', 'TWITTER_PASSWORD'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}