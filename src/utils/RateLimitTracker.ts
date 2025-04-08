/**
 * Utility to extract and track rate limit information from Twitter API responses
 */
export class RateLimitTracker {
    /**
     * Extract rate limit information from response headers
     * @param headers Response headers from Twitter API
     * @returns Rate limit information or null if not present
     */
    static extractRateLimitInfo(headers: Headers): {
        remaining: number;
        reset: number;
        limit: number;
    } | null {
        const remaining = headers.get('x-rate-limit-remaining');
        const reset = headers.get('x-rate-limit-reset');
        const limit = headers.get('x-rate-limit-limit');

        if (!remaining || !reset || !limit) {
            return null;
        }

        return {
            remaining: parseInt(remaining, 10),
            reset: parseInt(reset, 10),
            limit: parseInt(limit, 10)
        };
    }

    /**
     * Extract rate limit information from response headers
     * @param statusCode HTTP status code
     * @param headers Response headers
     * @returns Whether the request was rate limited
     */
    static isRateLimited(statusCode: number, headers: Headers): boolean {
        // HTTP 429 status code indicates rate limiting
        if (statusCode === 429) {
            return true;
        }

        // Check if remaining requests is 0
        const remaining = headers.get('x-rate-limit-remaining');
        if (remaining === '0') {
            return true;
        }

        return false;
    }

    /**
     * Extract rate limit endpoint from the URL
     * @param url The API URL
     * @returns Simplified endpoint name for rate limit tracking
     */
    static getEndpointFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;

            // Extract the main endpoint from the path
            const matches = path.match(/\/api\/([^\/]+)\/([^\/\?]+)/);
            if (matches && matches.length >= 3) {
                return `${matches[1]}.${matches[2]}`;
            }

            // Fallback to just using the path
            return path;
        } catch (e) {
            // If URL parsing fails, return the full URL as the endpoint
            return url;
        }
    }

    /**
     * Calculate wait time based on rate limit headers
     * @param headers Response headers from Twitter API
     * @returns Recommended wait time in milliseconds, or 0 if no waiting needed
     */
    static calculateWaitTime(headers: Headers): number {
        const rateLimitInfo = this.extractRateLimitInfo(headers);

        if (!rateLimitInfo || rateLimitInfo.remaining > 0) {
            return 0;
        }

        const now = Math.floor(Date.now() / 1000);
        const waitTimeSeconds = Math.max(0, rateLimitInfo.reset - now);

        // Add a small buffer (2 seconds) to ensure the rate limit has reset
        return (waitTimeSeconds + 2) * 1000;
    }
}