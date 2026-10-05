import http from 'http';
import app from './app';
import { config } from './config';
import { logger } from './config/logger';
import { pool } from './config/database';
import { redis } from './config/redis';
import { initializeSocketServer } from './websockets/socket.server';

const server = http.createServer(app);

// Initialize Socket.IO real-time engine
const io = initializeSocketServer(server);

server.listen(config.port, () => {
  logger.info(`🚀 Knotnex API Server listening on port ${config.port} [${config.env}]`);
  logger.info(`📡 Healthcheck available at: http://localhost:${config.port}/api/v1/health`);
  logger.info(`⚡ Socket.IO real-time engine attached at /socket.io`);
});

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
