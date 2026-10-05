import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../../config';
import { redis, isRedisReady } from '../../config/redis';
import { logger } from '../../config/logger';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days in seconds
const REGISTRATION_TOKEN_TTL = '15m';
const RESET_TOKEN_TTL = '10m';

const REFRESH_TOKEN_PREFIX = 'refresh_token:';

export interface JwtAccessPayload {
  sub: string;       // user.id (PostgreSQL UUID)
  uid: string;       // firebase_uid
  email: string;
  role: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;       // user.id
  jti: string;       // unique token id (for revocation)
  type: 'refresh';
}

export interface JwtRegistrationPayload {
  email: string;
  fullName: string;
  phone?: string;
  type: 'registration';
}

export interface JwtResetPayload {
  email: string;
  userId: string;
  type: 'reset';
}

// ─── Access Token ───────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<JwtAccessPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    config.security.jwtSecret,
    { expiresIn: ACCESS_TOKEN_TTL } as SignOptions
  );
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  return jwt.verify(token, config.security.jwtSecret) as JwtAccessPayload;
}

// ─── Refresh Token ──────────────────────────────────────────────────────────

export async function signRefreshToken(userId: string): Promise<{ token: string; jti: string }> {
  const jti = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const token = jwt.sign(
    { sub: userId, jti, type: 'refresh' },
    config.security.jwtSecret,
    { expiresIn: REFRESH_TOKEN_TTL } as SignOptions
  );

  // Store in Redis (or in-memory fallback) for revocation support
  if (isRedisReady()) {
    try {
      await redis.setex(
        `${REFRESH_TOKEN_PREFIX}${jti}`,
        REFRESH_TOKEN_TTL_SECONDS,
        userId
      );
    } catch {
      memoryRefreshTokens.set(`${REFRESH_TOKEN_PREFIX}${jti}`, userId);
    }
  } else {
    memoryRefreshTokens.set(`${REFRESH_TOKEN_PREFIX}${jti}`, userId);
  }

  return { token, jti };
}

// In-memory fallback map for refresh tokens when Redis is offline
const memoryRefreshTokens = new Map<string, string>();

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, config.security.jwtSecret) as JwtRefreshPayload;
}

export async function revokeRefreshToken(jti: string): Promise<void> {
  const key = `${REFRESH_TOKEN_PREFIX}${jti}`;
  if (isRedisReady()) {
    try {
      await redis.del(key);
      return;
    } catch {
      // fallback
    }
  }
  memoryRefreshTokens.delete(key);
}

export async function isRefreshTokenValid(jti: string): Promise<boolean> {
  const key = `${REFRESH_TOKEN_PREFIX}${jti}`;
  if (isRedisReady()) {
    try {
      const result = await redis.get(key);
      return result !== null;
    } catch {
      // fallback
    }
  }
  return memoryRefreshTokens.has(key);
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  if (isRedisReady()) {
    try {
      const pattern = `${REFRESH_TOKEN_PREFIX}*`;
      let cursor = '0';
      do {
        const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        if (keys.length > 0) {
          for (const k of keys) {
            const val = await redis.get(k);
            if (val === userId) {
              await redis.del(k);
            }
          }
        }
      } while (cursor !== '0');
      return;
    } catch {
      // fallback
    }
  }

  for (const [k, u] of memoryRefreshTokens.entries()) {
    if (u === userId) {
      memoryRefreshTokens.delete(k);
    }
  }
}

// ─── Registration Token (temp, after OTP verification) ──────────────────────

export function signRegistrationToken(payload: Omit<JwtRegistrationPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'registration' },
    config.security.jwtSecret,
    { expiresIn: REGISTRATION_TOKEN_TTL } as SignOptions
  );
}

export function verifyRegistrationToken(token: string): JwtRegistrationPayload {
  const decoded = jwt.verify(token, config.security.jwtSecret) as JwtRegistrationPayload;
  if (decoded.type !== 'registration') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

// ─── Password Reset Token ───────────────────────────────────────────────────

export function signResetToken(payload: Omit<JwtResetPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'reset' },
    config.security.jwtSecret,
    { expiresIn: RESET_TOKEN_TTL } as SignOptions
  );
}

export function verifyResetToken(token: string): JwtResetPayload {
  const decoded = jwt.verify(token, config.security.jwtSecret) as JwtResetPayload;
  if (decoded.type !== 'reset') {
    throw new Error('Invalid token type');
  }
  return decoded;
}
