import Database from 'better-sqlite3';
import { TwitterAccount, TwitterAccountConfig, AccountHealth, RateLimitInfo } from '../models/TwitterAccount';
import { logger } from '../utils/logger';
import { config } from '../config';

type AccountRecord = {
    username: string;
    password: string;
    email: string | null;
    priority: number;
    tags: string; // JSON string
    disabled: number; // 0 or 1
    isLoggedIn: number; // 0 or 1
    health: string; // JSON string
    rateLimits: string; // JSON string
};

export class DatabaseService {
    private db: Database.Database | null = null;

    public connect(): void {
        if (this.db) return;
        this.db = new Database(config.databasePath, { verbose: logger.debug.bind(logger) });
        this.initSchema();
    }

    private initSchema(): void {
        if (!this.db) throw new Error("Database not connected");
        const schema = `
      CREATE TABLE IF NOT EXISTS accounts (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        email TEXT,
        priority INTEGER DEFAULT 1,
        tags TEXT DEFAULT '[]',
        disabled INTEGER DEFAULT 0,
        isLoggedIn INTEGER DEFAULT 0,
        health TEXT,
        rateLimits TEXT
      );
    `;
        this.db.exec(schema);
    }

    public getDb(): Database.Database {
        if (!this.db) throw new Error("Database not connected");
        return this.db;
    }

    public getAccounts(): TwitterAccount[] {
        if (!this.db) throw new Error("Database not connected");
        try {
            const stmt = this.db.prepare('SELECT * FROM accounts');
            const records = stmt.all() as AccountRecord[];

            return records.map(record => {
                const health: AccountHealth = record.health ? JSON.parse(record.health) : {
                    successCount: 0, failureCount: 0, lastSuccess: null, lastFailure: null
                };

                const rateLimits: Map<string, RateLimitInfo> = record.rateLimits
                    ? new Map(Object.entries(JSON.parse(record.rateLimits)))
                    : new Map();
                
                const accountConfig: TwitterAccountConfig = {
                    username: record.username,
                    password: record.password,
                    email: record.email || undefined,
                    priority: record.priority,
                    tags: JSON.parse(record.tags),
                    disabled: Boolean(record.disabled)
                };

                const account = new TwitterAccount(accountConfig);
                account.isLoggedIn = Boolean(record.isLoggedIn);
                (account as any).health = health;
                (account as any).rateLimits = rateLimits;

                return account;
            });
        } catch (error) {
            logger.error(`Error fetching accounts from database: ${error}`);
            return [];
        }
    }
    
    public addAccount(accountConfig: TwitterAccountConfig): void {
        if (!this.db) throw new Error("Database not connected");
        const stmt = this.db.prepare(`
            INSERT INTO accounts (username, password, email, priority, tags, disabled, isLoggedIn, health, rateLimits)
            VALUES (@username, @password, @email, @priority, @tags, @disabled, @isLoggedIn, @health, @rateLimits)
            ON CONFLICT(username) DO UPDATE SET
                password=excluded.password,
                email=excluded.email,
                priority=excluded.priority,
                tags=excluded.tags;
        `);

        stmt.run({
            username: accountConfig.username,
            password: accountConfig.password,
            email: accountConfig.email || null,
            priority: accountConfig.priority || 1,
            tags: JSON.stringify(accountConfig.tags || []),
            disabled: accountConfig.disabled ? 1 : 0,
            isLoggedIn: 0,
            health: JSON.stringify({ successCount: 0, failureCount: 0, lastSuccess: null, lastFailure: null }),
            rateLimits: JSON.stringify({})
        });
    }
    
    public deleteAccount(username: string): void {
        if (!this.db) throw new Error("Database not connected");
        const stmt = this.db.prepare('DELETE FROM accounts WHERE username = ?');
        stmt.run(username);
    }
    
    public updateAccountState(account: TwitterAccount): void {
        if (!this.db) throw new Error("Database not connected");
        const stmt = this.db.prepare(`
            UPDATE accounts
            SET 
                disabled = @disabled,
                isLoggedIn = @isLoggedIn,
                health = @health,
                rateLimits = @rateLimits
            WHERE username = @username
        `);
        
        stmt.run({
            username: account.username,
            disabled: account.disabled ? 1 : 0,
            isLoggedIn: account.isLoggedIn ? 1 : 0,
            health: JSON.stringify(account.getHealth()),
            // The Map object needs to be converted to a plain object for JSON serialization
            rateLimits: JSON.stringify(Object.fromEntries(account.getRateLimits()))
        });
    }

    public getAccountCount(): number {
        if (!this.db) throw new Error("Database not connected");
        const stmt = this.db.prepare('SELECT count(*) as count FROM accounts');
        const result = stmt.get() as { count: number };
        return result.count;
    }
    
    public close(): void {
        if (this.db && this.db.open) {
            this.db.close();
            this.db = null;
        }
    }
}

export const dbService = new DatabaseService();

// Graceful shutdown
process.on('exit', () => dbService.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15)); 