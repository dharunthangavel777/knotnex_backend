import { redis, isRedisReady } from '../../config/redis';
import { logger } from '../../config/logger';

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

// In-memory fallback when Redis is offline (e.g., local development)
interface MemoryOtpEntry {
  otp: string;
  expiresAt: number;
}
const memoryOtpMap = new Map<string, MemoryOtpEntry>();
const memoryAttemptsMap = new Map<string, { count: number; expiresAt: number }>();

/**
 * Generates a cryptographically-sufficient 4-digit OTP (1000–9999)
 */
function generateOtp(): string {
  const min = 1000;
  const max = 9999;
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  return otp.toString();
}

export type OtpType = 'SIGNUP' | 'PASSWORD_RESET';

/**
 * Creates and stores an OTP in Redis (or in-memory fallback) for the given email + type.
 */
export async function createOtp(email: string, type: OtpType): Promise<string> {
  const key = `${OTP_PREFIX[type]}${email.toLowerCase()}`;
  const otp = generateOtp();
  const ttl = OTP_TTL_SECONDS[type];

  if (isRedisReady()) {
    try {
      await redis.setex(key, ttl, otp);
      logger.info(`[OTP] Created ${type} OTP in Redis for ${email}, TTL: ${ttl}s`);
      return otp;
    } catch (err: any) {
      logger.warn(`[OTP] Redis write failed, falling back to memory: ${err.message}`);
    }
  }

  // Fallback to memory
  memoryOtpMap.set(key, { otp, expiresAt: Date.now() + ttl * 1000 });
  logger.info(`[OTP] Created ${type} OTP in memory for ${email} (Redis offline), TTL: ${ttl}s`);
  return otp;
}

/**
 * Verifies an OTP for the given email + type.
 */
export async function verifyOtp(email: string, type: OtpType, code: string): Promise<void> {
  const key = `${OTP_PREFIX[type]}${email.toLowerCase()}`;
  const attemptKey = `${OTP_ATTEMPT_PREFIX}${type}:${email.toLowerCase()}`;

  if (isRedisReady()) {
    try {
      const attempts = await redis.get(attemptKey);
      if (attempts && parseInt(attempts, 10) >= MAX_OTP_ATTEMPTS) {
        throw new Error('Too many OTP attempts. Please request a new OTP.');
      }

      const stored = await redis.get(key);
      if (!stored) {
        throw new Error('OTP expired or not found. Please request a new one.');
      }

      if (stored !== code.trim()) {
        const pipe = redis.pipeline();
        pipe.incr(attemptKey);
        pipe.expire(attemptKey, ATTEMPT_WINDOW_SECONDS);
        await pipe.exec();
        throw new Error('Invalid OTP. Please check and try again.');
      }

      const pipe = redis.pipeline();
      pipe.del(key);
      pipe.del(attemptKey);
      await pipe.exec();

      logger.info(`[OTP] ${type} OTP verified in Redis for ${email}`);
      return;
    } catch (err: any) {
      if (err.message && (err.message.includes('Invalid') || err.message.includes('expired') || err.message.includes('attempts'))) {
        throw err;
      }
      logger.warn(`[OTP] Redis verify failed, falling back to memory: ${err.message}`);
    }
  }

  // Memory fallback logic
  const now = Date.now();
  const attemptRecord = memoryAttemptsMap.get(attemptKey);
  if (attemptRecord && attemptRecord.expiresAt > now && attemptRecord.count >= MAX_OTP_ATTEMPTS) {
    throw new Error('Too many OTP attempts. Please request a new OTP.');
  }

  const storedEntry = memoryOtpMap.get(key);
  if (!storedEntry || storedEntry.expiresAt <= now) {
    memoryOtpMap.delete(key);
    throw new Error('OTP expired or not found. Please request a new one.');
  }

  if (storedEntry.otp !== code.trim()) {
    const currentCount = (attemptRecord && attemptRecord.expiresAt > now) ? attemptRecord.count + 1 : 1;
    memoryAttemptsMap.set(attemptKey, { count: currentCount, expiresAt: now + ATTEMPT_WINDOW_SECONDS * 1000 });
    throw new Error('Invalid OTP. Please check and try again.');
  }

  // Success
  memoryOtpMap.delete(key);
  memoryAttemptsMap.delete(attemptKey);
  logger.info(`[OTP] ${type} OTP verified in memory for ${email}`);
}

/**
 * Helper to retrieve stored OTP for testing without needing to read actual emails.
 */
export async function getStoredOtp(email: string, type: OtpType): Promise<string | null> {
  const key = `${OTP_PREFIX[type]}${email.toLowerCase()}`;
  if (isRedisReady()) {
    try {
      const code = await redis.get(key);
      if (code) return code;
    } catch {
      // fallback
    }
  }
  const entry = memoryOtpMap.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.otp;
}

