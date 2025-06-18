import { dbService } from '../src/services/database';
import { twitterService } from '../src/services/twitter';
import fs from 'fs';

// Use an in-memory database for tests to ensure isolation and speed
process.env.DATABASE_PATH = ':memory:';
process.env.API_KEY = 'test-api-key';

// Mock the logger to avoid polluting test output
jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

beforeEach(async () => {
    // Reset singletons to ensure test isolation
    twitterService._resetForTest();
    
    // Explicitly connect to the in-memory DB for this test run
    dbService.connect();

    // Re-initialize the database schema before each test
    // This ensures a clean slate for every test case.
    const db = dbService.getDb();
    db.exec('DROP TABLE IF EXISTS accounts');
    db.exec(`
        CREATE TABLE accounts (
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
    `);
});

afterAll(() => {
    // Close the database connection after all tests have run
    dbService.close();
}); 