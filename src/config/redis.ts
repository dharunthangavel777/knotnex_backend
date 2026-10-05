import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      logger.warn('Redis connection retry limit reached. Operating in graceful in-memory fallback mode.');
      return null; // Stop retrying
    }
    return Math.min(times * 100, 2000);
  },
});

let isConnected = false;

redis.on('connect', () => {
  isConnected = true;
  logger.info('Connected to Redis (Memorystore)');
});

redis.on('ready', () => {
  isConnected = true;
});

redis.on('close', () => {
  isConnected = false;
});

redis.on('error', (err) => {
  isConnected = false;
  logger.warn('Redis offline (operating in safe in-memory fallback mode)', { error: err.message });
});

// Attempt initial connection safely without crashing application
redis.connect().catch((err) => {
  isConnected = false;
  logger.warn('Redis not running locally — enabled automatic in-memory fallback for development');
});

export const isRedisReady = (): boolean => isConnected && redis.status === 'ready';
