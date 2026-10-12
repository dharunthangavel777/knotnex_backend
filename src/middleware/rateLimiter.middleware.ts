import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { redis, isRedisReady } from '../config/redis';
import { logger } from '../config/logger';

// ─── Helper: create Redis-backed rate limiter store ──────────────────────────
// Falls back to express-rate-limit's built-in in-memory store if Redis is offline or not ready.
function createStore(prefix: string) {
  if (!isRedisReady()) {
    return undefined;
  }

  try {
    return new RedisStore({
      sendCommand: async (...args: string[]) => {
        try {
          if (!isRedisReady()) return null as any;
          return await (redis.call as any)(...args);
        } catch {
          return null as any;
        }
      },
      prefix: `ratelimit:${prefix}:`,
    });
  } catch (err: any) {
    logger.warn(`[RateLimit] Redis store unavailable for ${prefix}, using memory store`, { error: err.message });
    return undefined;
  }
}

// ─── Key Resolution (User ID > Token Sub > Client IP) ────────────────────────
// Prevents shared NAT/Carrier IP starvation by prioritizing authenticated User IDs.
export function resolveClientKey(req: any): { key: string; isUser: boolean } {
  if (req.user?.id) {
    return { key: `user:${req.user.id}`, isUser: true };
  }
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded?.sub) {
          return { key: `user:${decoded.sub}`, isUser: true };
        }
        if (decoded?.uid) {
          return { key: `user:${decoded.uid}`, isUser: true };
        }
      } catch {
        // Ignore decode errors and fallback to IP
      }
    }
  }
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return { key: `ip:${ip}`, isUser: false };
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
// Authenticated: 600 req / 15 min (~40 req/min).
// Anonymous IP: 200 req / 15 min (Relaxed to support mobile carrier NAT).
export const apiRateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: (req) => {
    const { isUser } = resolveClientKey(req);
    return isUser ? 600 : config.security.rateLimitMax;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('api'),
  keyGenerator: (req) => resolveClientKey(req).key,
  handler: (req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down and try again later.',
        retryAfter,
      },
    });
  },
});

// ─── Feed & Reel Rate Limiter ────────────────────────────────────────────────
// 30 req/min for authenticated users; 15 req/min for anonymous.
export const feedRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (resolveClientKey(req).isUser ? 30 : 15),
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('feed'),
  keyGenerator: (req) => resolveClientKey(req).key,
  handler: (req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'FEED_RATE_LIMIT_EXCEEDED',
        message: 'Feed requests are too frequent. Please slow down.',
        retryAfter,
      },
    });
  },
});

// ─── Post Interaction Rate Limiter (Like, Save, Share) ──────────────────────
// 60 interactions/min per user.
export const postInteractionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (resolveClientKey(req).isUser ? 60 : 20),
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('interactions'),
  keyGenerator: (req) => resolveClientKey(req).key,
  handler: (req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'INTERACTION_RATE_LIMIT_EXCEEDED',
        message: 'You are performing actions too fast. Please pause for a moment.',
        retryAfter,
      },
    });
  },
});

// ─── Batch View Rate Limiter ─────────────────────────────────────────────────
// 40 batch view updates/min per user.
export const batchViewRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (resolveClientKey(req).isUser ? 40 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('views'),
  keyGenerator: (req) => resolveClientKey(req).key,
});

// ─── OTP Send Rate Limiter ───────────────────────────────────────────────────
// 5 OTP sends per 15 minutes per IP/mobile. Prevents SMS/Email spam.
export const authOtpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  store: createStore('auth_otp'),
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'OTP_RATE_LIMIT_EXCEEDED',
        message: 'Too many OTP requests. Please wait 15 minutes before requesting a new code.',
        retryAfter,
      },
    });
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
  handler: (req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'SIGNIN_RATE_LIMIT_EXCEEDED',
        message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
        retryAfter,
      },
    });
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
  handler: (req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'RESET_RATE_LIMIT_EXCEEDED',
        message: 'Too many password reset attempts. Please wait 30 minutes before trying again.',
        retryAfter,
      },
    });
  },
});

// ─── Legacy export (kept for backward compatibility) ─────────────────────────
export const authRateLimiter = authSigninRateLimiter;
