import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../../config';
import { logger } from '../../config/logger';

// ─── JWT Utilities ────────────────────────────────────────────────────────────
// Token stores: in-memory Maps (primary for low-cost architecture).
// Redis / Memorystore has been removed. To re-enable Redis-backed revocation,
// restore ioredis, redis.ts, and connect the Redis branches below.
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_MS = 60 * 60 * 24 * 30 * 1000; // 30 days in ms
const REGISTRATION_TOKEN_TTL = '15m';
const RESET_TOKEN_TTL = '10m';
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes in ms

const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const RESET_TOKEN_PREFIX = 'reset_token:';

// In-memory token stores (per-instance; acceptable for max-5 Cloud Run)
const memoryRefreshTokens = new Map<string, { userId: string; expiresAt: number }>();
const memoryResetTokens = new Map<string, { userId: string; expiresAt: number }>();

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
  jti?: string;
  type: 'reset';
}

// ─── Access Token ────────────────────────────────────────────────────────────

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

// ─── Refresh Token ───────────────────────────────────────────────────────────

export async function signRefreshToken(userId: string): Promise<{ token: string; jti: string }> {
  const jti = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const token = jwt.sign(
    { sub: userId, jti, type: 'refresh' },
    config.security.jwtSecret,
    { expiresIn: REFRESH_TOKEN_TTL } as SignOptions
  );

  memoryRefreshTokens.set(`${REFRESH_TOKEN_PREFIX}${jti}`, {
    userId,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });

  return { token, jti };
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, config.security.jwtSecret) as JwtRefreshPayload;
}

export async function revokeRefreshToken(jti: string): Promise<void> {
  memoryRefreshTokens.delete(`${REFRESH_TOKEN_PREFIX}${jti}`);
}

export async function isRefreshTokenValid(jti: string): Promise<boolean> {
  const key = `${REFRESH_TOKEN_PREFIX}${jti}`;
  const entry = memoryRefreshTokens.get(key);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    memoryRefreshTokens.delete(key);
    return false;
  }
  return true;
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  for (const [key, entry] of memoryRefreshTokens.entries()) {
    if (entry.userId === userId) {
      memoryRefreshTokens.delete(key);
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

// ─── Password Reset Token ────────────────────────────────────────────────────

export async function signResetToken(payload: Omit<JwtResetPayload, 'type' | 'jti'>): Promise<string> {
  const jti = `${payload.userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const token = jwt.sign(
    { ...payload, jti, type: 'reset' },
    config.security.jwtSecret,
    { expiresIn: RESET_TOKEN_TTL } as SignOptions
  );

  memoryResetTokens.set(`${RESET_TOKEN_PREFIX}${jti}`, {
    userId: payload.userId,
    expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
  });

  return token;
}

export function verifyResetToken(token: string): JwtResetPayload {
  const decoded = jwt.verify(token, config.security.jwtSecret) as JwtResetPayload;
  if (decoded.type !== 'reset') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

export async function isResetTokenValid(jti?: string): Promise<boolean> {
  if (!jti) return true;
  const key = `${RESET_TOKEN_PREFIX}${jti}`;
  const entry = memoryResetTokens.get(key);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    memoryResetTokens.delete(key);
    return false;
  }
  return true;
}

export async function revokeResetToken(jti?: string): Promise<void> {
  if (!jti) return;
  memoryResetTokens.delete(`${RESET_TOKEN_PREFIX}${jti}`);
}
