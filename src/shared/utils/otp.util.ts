import { logger } from '../../config/logger';

// ─── OTP Utilities ────────────────────────────────────────────────────────────
// In-memory store (primary for low-cost architecture).
// Redis / Memorystore has been removed. OTPs are stored per-instance.
// With max 5 Cloud Run instances and low traffic, the same instance typically
// handles both OTP creation and verification.
// To re-enable Redis: restore ioredis and use redis.setex/get for OTP keys.
// ─────────────────────────────────────────────────────────────────────────────

const OTP_PREFIX = {
  SIGNUP: 'otp:signup:',
  PASSWORD_RESET: 'otp:reset:',
};

const OTP_ATTEMPT_PREFIX = 'otp:attempts:';

const OTP_TTL_SECONDS = {
  SIGNUP: 600,         // 10 minutes
  PASSWORD_RESET: 900, // 15 minutes
};

const MAX_OTP_ATTEMPTS = 5;
const ATTEMPT_WINDOW_SECONDS = 900; // 15 minutes

interface MemoryOtpEntry {
  otp: string;
  expiresAt: number;
}

const memoryOtpMap = new Map<string, MemoryOtpEntry>();
const memoryAttemptsMap = new Map<string, { count: number; expiresAt: number }>();

/**
 * Generates a 4-digit OTP (1000–9999)
 */
function generateOtp(): string {
  const min = 1000;
  const max = 9999;
  return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
}

export type OtpType = 'SIGNUP' | 'PASSWORD_RESET';

/**
 * Creates and stores an OTP in memory for the given email + type.
 */
export async function createOtp(email: string, type: OtpType): Promise<string> {
  const key = `${OTP_PREFIX[type]}${email.toLowerCase()}`;
  const otp = generateOtp();
  const ttl = OTP_TTL_SECONDS[type];

  memoryOtpMap.set(key, { otp, expiresAt: Date.now() + ttl * 1000 });
  logger.info(`[OTP] Created ${type} OTP in memory for ${email}, TTL: ${ttl}s`);
  return otp;
}

/**
 * Verifies an OTP for the given email + type.
 */
export async function verifyOtp(email: string, type: OtpType, code: string): Promise<void> {
  const key = `${OTP_PREFIX[type]}${email.toLowerCase()}`;
  const attemptKey = `${OTP_ATTEMPT_PREFIX}${type}:${email.toLowerCase()}`;
  const now = Date.now();

  // Check attempt count
  const attemptRecord = memoryAttemptsMap.get(attemptKey);
  if (attemptRecord && attemptRecord.expiresAt > now && attemptRecord.count >= MAX_OTP_ATTEMPTS) {
    throw new Error('Too many OTP attempts. Please request a new OTP.');
  }

  // Check OTP exists and is not expired
  const storedEntry = memoryOtpMap.get(key);
  if (!storedEntry || storedEntry.expiresAt <= now) {
    memoryOtpMap.delete(key);
    throw new Error('OTP expired or not found. Please request a new one.');
  }

  // Verify code
  if (storedEntry.otp !== code.trim()) {
    const currentCount = (attemptRecord && attemptRecord.expiresAt > now) ? attemptRecord.count + 1 : 1;
    memoryAttemptsMap.set(attemptKey, {
      count: currentCount,
      expiresAt: now + ATTEMPT_WINDOW_SECONDS * 1000,
    });
    throw new Error('Invalid OTP. Please check and try again.');
  }

  // Success — clear OTP and attempt counter
  memoryOtpMap.delete(key);
  memoryAttemptsMap.delete(attemptKey);
  logger.info(`[OTP] ${type} OTP verified in memory for ${email}`);
}

/**
 * Helper to retrieve stored OTP for development/testing.
 */
export async function getStoredOtp(email: string, type: OtpType): Promise<string | null> {
  const key = `${OTP_PREFIX[type]}${email.toLowerCase()}`;
  const entry = memoryOtpMap.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.otp;
}
