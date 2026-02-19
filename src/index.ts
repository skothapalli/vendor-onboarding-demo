import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma';
import { disconnectRedis } from './infrastructure/cache/redis';

async function main() {
  const app = createApp();

  // Connect to database
  await connectDatabase();

  const server = app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        env: config.env,
        apiVersion: config.apiVersion,
      },
      `VOMS server started on port ${config.port}`
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    server.close(async () => {
      logger.info('HTTP server closed');

      await disconnectDatabase();
      await disconnectRedis();

      logger.info('All connections closed');
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}

main().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
