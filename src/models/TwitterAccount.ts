/**
 * Represents a Twitter account with its credentials and status
 */
export interface TwitterAccountConfig {
    username: string;
    password: string;
    email?: string;
    priority?: number;
    tags?: string[];
    disabled?: boolean;
}

export interface RateLimitInfo {
    remaining: number;
    reset: number; // Unix timestamp when the rate limit resets
    limit: number;
}

export interface AccountHealth {
    successCount: number;
    failureCount: number;
    lastSuccess: Date | null;
    lastFailure: Date | null;
    lastError?: string;
}

export class TwitterAccount {
    public username: string;
    public password: string;
    public email?: string;
    public priority: number;
    public tags: string[];
    public disabled: boolean;
    public isLoggedIn: boolean;
    public inUse: boolean;

    private health: AccountHealth;
    private rateLimits: Map<string, RateLimitInfo>;

    constructor(config: TwitterAccountConfig) {
        this.username = config.username;
        this.password = config.password;
        this.email = config.email;
        this.priority = config.priority || 1;
        this.tags = config.tags || [];
        this.disabled = config.disabled || false;
        this.isLoggedIn = false;
        this.inUse = false;

        this.health = {
            successCount: 0,
            failureCount: 0,
            lastSuccess: null,
            lastFailure: null
        };

        this.rateLimits = new Map();
    }

    /**
     * Check if this account can be used for a request
     */
    canUse(endpoint?: string): boolean {
        if (this.disabled) {
            return false;
        }

        if (endpoint && this.rateLimits.has(endpoint)) {
            const rateLimit = this.rateLimits.get(endpoint)!;
            const now = Math.floor(Date.now() / 1000);

            // If we're still within the rate limit window and have no requests left
            if (now < rateLimit.reset && rateLimit.remaining <= 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Time until this account can be used again for the given endpoint
     * @returns Time in seconds, or 0 if available now
     */
    waitTimeFor(endpoint: string): number {
        if (!this.rateLimits.has(endpoint)) {
            return 0;
        }

        const rateLimit = this.rateLimits.get(endpoint)!;
        const now = Math.floor(Date.now() / 1000);

        if (rateLimit.remaining > 0 || now >= rateLimit.reset) {
            return 0;
        }

        return rateLimit.reset - now;
    }

    /**
     * Update rate limit information for this account
     */
    updateRateLimit(endpoint: string, remaining: number, reset: number, limit: number): void {
        this.rateLimits.set(endpoint, { remaining, reset, limit });
    }

    /**
     * Record a successful operation
     */
    recordSuccess(): void {
        this.health.successCount++;
        this.health.lastSuccess = new Date();
    }

    /**
     * Record a failed operation
     */
    recordFailure(error?: string): void {
        this.health.failureCount++;
        this.health.lastFailure = new Date();
        this.health.lastError = error;
    }

    /**
     * Get account health metrics
     */
    getHealth(): AccountHealth {
        return { ...this.health };
    }

    /**
     * Get success rate (0-1)
     */
    getSuccessRate(): number {
        const total = this.health.successCount + this.health.failureCount;
        if (total === 0) return 1; // No operations yet, assume good
        return this.health.successCount / total;
    }

    /**
     * Get account rate limits
     */
    getRateLimits(): Map<string, RateLimitInfo> {
        return this.rateLimits;
    }

    /**
     * Reset health metrics
     */
    resetHealth(): void {
        this.health = {
            successCount: 0,
            failureCount: 0,
            lastSuccess: null,
            lastFailure: null
        };
    }

    /**
     * Enable the account
     */
    enable(): void {
        this.disabled = false;
    }

    /**
     * Disable the account
     */
    disable(): void {
        this.disabled = true;
    }
}