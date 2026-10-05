import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from '../config';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

// ─── Helper: create Redis-backed rate limiter store ──────────────────────────
// In development or when Redis is offline, falls back to in-memory store gracefully.
function createStore(prefix: string) {
  if (config.env === 'development') {
    // In local development, use express-rate-limit's built-in MemoryStore (no Redis dependency required)
    return undefined;
  }

  try {
    return new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as any,
      prefix: `ratelimit:${prefix}:`,
    });
  } catch (err: any) {
    logger.warn(`[RateLimit] Redis store unavailable for ${prefix}, using memory store`, { error: err.message });
    return undefined;
  }
}

const shouldSkip = (req: any) => {
  if (config.env !== 'production') {
    if (req.headers['x-test-bypass-rate-limit'] === 'true') return true;
    const ip = req.ip || req.socket?.remoteAddress;
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  }
  return false;
};

// ─── Standard API Rate Limiter ───────────────────────────────────────────────
// 100 requests per 15 minutes per IP. Applied globally to all /api routes.
export const apiRateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('api'),
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down and try again later.',
    },
  },
});

// ─── OTP Send Rate Limiter ───────────────────────────────────────────────────
// 5 OTP sends per 15 minutes per IP. Prevents OTP spam.
export const authOtpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('auth_otp'),
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    success: false,
    error: {
      code: 'OTP_RATE_LIMIT_EXCEEDED',
      message: 'Too many OTP requests. Please wait 15 minutes before requesting a new code.',
    },
  },
});

// ─── Signin Rate Limiter ─────────────────────────────────────────────────────
// 20 sign-in attempts per 15 minutes per IP.
export const authSigninRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('auth_signin'),
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    success: false,
    error: {
      code: 'SIGNIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
    },
  },
});

// ─── Password Reset Rate Limiter ─────────────────────────────────────────────
// 3 password reset attempts per 30 minutes per IP.
export const authResetRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('auth_reset'),
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    success: false,
    error: {
      code: 'RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts. Please wait 30 minutes before trying again.',
    },
  },
});

// ─── Legacy export (kept for backward compatibility) ─────────────────────────
export const authRateLimiter = authSigninRateLimiter;
