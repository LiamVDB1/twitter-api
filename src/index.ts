import { app } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { twitterService } from './services/twitter';

const startServer = async () => {
    try {
        await twitterService.init();
        app.listen(config.port, () => {
            logger.info(`Server running on port ${config.port}`);
        });
    } catch (error) {
        logger.error(`Failed to start server: ${error}`);
        process.exit(1);
    }
};

if (process.env.NODE_ENV !== 'test') {
    startServer();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
    logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
    // Close server & exit process
    process.exit(1);
});

export { app, startServer };