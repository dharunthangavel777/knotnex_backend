import http from 'http';
import app from './app';
import { config } from './config';
import { logger } from './config/logger';
import { pool } from './config/database';
import { redis } from './config/redis';
import { initializeSocketServer } from './websockets/socket.server';

import { runMigrations } from './db/migrate';

const server = http.createServer(app);

// Initialize Socket.IO real-time engine
const io = initializeSocketServer(server);

const startServer = async () => {
  // Automated PostgreSQL migration runner (idempotent, advisory-locked)
  if (config.database.autoMigrate) {
    try {
      logger.info('Checking automated PostgreSQL schema migrations...');
      await runMigrations();
    } catch (migErr: any) {
      logger.error('FATAL: Database migration failed during server startup', { error: migErr.message });
      process.exit(1);
    }
  }

  server.listen(config.port, '0.0.0.0', () => {
    logger.info(`🚀 Knotnex API Server listening on 0.0.0.0:${config.port} [${config.env}]`);
    logger.info(`📡 Healthcheck available at: http://localhost:${config.port}/api/v1/health`);
    logger.info(`⚡ Socket.IO real-time engine attached at /socket.io`);
  });
};

startServer();

// ─── Graceful Shutdown ───
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Gracefully shutting down...`);

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await pool.end();
      logger.info('PostgreSQL connection pool closed.');

      redis.disconnect();
      logger.info('Redis connection closed.');

      process.exit(0);
    } catch (err: any) {
      logger.error('Error during shutdown cleanup', { error: err.message });
      process.exit(1);
    }
  });

  // Force shutdown if cleanup takes too long
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { server, io };
