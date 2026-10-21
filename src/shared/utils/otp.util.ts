import { logger } from '../../config/logger';
import { query } from '../../config/database';

// ─── OTP Utilities ────────────────────────────────────────────────────────────
// Dual store: PostgreSQL (durable across all Cloud Run containers & cold boots)
// + In-memory cache fallback.
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

let tableEnsured = false;
export async function ensureOtpTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS auth_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        attempts INT DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_auth_otps_lookup ON auth_otps(email, type);
    `);
    tableEnsured = true;
  } catch (err: any) {
    logger.warn('[OTP] Could not ensure auth_otps table, relying on memory fallback:', { error: err.message });
  }
}

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
 * Creates and stores an OTP in PostgreSQL (and memory) for the given email + type.
 */
export async function createOtp(email: string, type: OtpType): Promise<string> {
  const cleanEmail = email.toLowerCase().trim();
  const key = `${OTP_PREFIX[type]}${cleanEmail}`;
  const otp = generateOtp();
  const ttl = OTP_TTL_SECONDS[type];

  // 1. Keep memory cache
  memoryOtpMap.set(key, { otp, expiresAt: Date.now() + ttl * 1000 });

  // 2. Persist in PostgreSQL for multi-container and cold start resilience
  try {
    await ensureOtpTable();
    await query(`DELETE FROM auth_otps WHERE email = $1 AND type = $2`, [cleanEmail, type]);
    await query(
      `INSERT INTO auth_otps (email, type, otp, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::INTERVAL)`,
      [cleanEmail, type, otp, ttl.toString()]
    );
    logger.info(`[OTP] Created ${type} OTP in PostgreSQL for ${cleanEmail}, TTL: ${ttl}s`);
  } catch (dbErr: any) {
    logger.warn(`[OTP] PostgreSQL OTP insert failed, fallback to memory: ${dbErr.message}`);
  }

  return otp;
}

/**
 * Verifies an OTP for the given email + type.
 */
export async function verifyOtp(email: string, type: OtpType, code: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = code.trim();
  const key = `${OTP_PREFIX[type]}${cleanEmail}`;
  const attemptKey = `${OTP_ATTEMPT_PREFIX}${type}:${cleanEmail}`;
  const now = Date.now();

  // Check attempt count in memory
  const attemptRecord = memoryAttemptsMap.get(attemptKey);
  if (attemptRecord && attemptRecord.expiresAt > now && attemptRecord.count >= MAX_OTP_ATTEMPTS) {
    throw new Error('Too many OTP attempts. Please request a new OTP.');
  }

  // 1. Check PostgreSQL first
  try {
    await ensureOtpTable();
    const res = await query(
      `SELECT id, otp, attempts, expires_at FROM auth_otps
       WHERE email = $1 AND type = $2 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [cleanEmail, type]
    );

    if (res.rowCount && res.rowCount > 0) {
      const row = res.rows[0];
      if (row.attempts >= MAX_OTP_ATTEMPTS) {
        throw new Error('Too many OTP attempts. Please request a new OTP.');
      }

      if (row.otp !== cleanCode) {
        await query(`UPDATE auth_otps SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
        throw new Error('Invalid OTP. Please check and try again.');
      }

      // Success in DB — remove row and clean memory
      await query(`DELETE FROM auth_otps WHERE email = $1 AND type = $2`, [cleanEmail, type]);
      memoryOtpMap.delete(key);
      memoryAttemptsMap.delete(attemptKey);
      logger.info(`[OTP] ${type} OTP verified in PostgreSQL for ${cleanEmail}`);
      return;
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('Invalid OTP') || err.message.includes('Too many OTP attempts'))) {
      throw err;
    }
    logger.warn(`[OTP] PostgreSQL verify check encountered: ${err.message}. Checking memory fallback.`);
  }

  // 2. Fallback to memory store if PostgreSQL check was inconclusive
  const storedEntry = memoryOtpMap.get(key);
  if (!storedEntry || storedEntry.expiresAt <= now) {
    memoryOtpMap.delete(key);
    throw new Error('OTP expired or not found. Please request a new one.');
  }

  if (storedEntry.otp !== cleanCode) {
    const currentCount = (attemptRecord && attemptRecord.expiresAt > now) ? attemptRecord.count + 1 : 1;
    memoryAttemptsMap.set(attemptKey, {
      count: currentCount,
      expiresAt: now + ATTEMPT_WINDOW_SECONDS * 1000,
    });
    throw new Error('Invalid OTP. Please check and try again.');
  }

  // Success in memory
  memoryOtpMap.delete(key);
  memoryAttemptsMap.delete(attemptKey);
  logger.info(`[OTP] ${type} OTP verified in memory for ${cleanEmail}`);
}

/**
 * Helper to retrieve stored OTP for development/testing.
 */
export async function getStoredOtp(email: string, type: OtpType): Promise<string | null> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    await ensureOtpTable();
    const res = await query(
      `SELECT otp FROM auth_otps WHERE email = $1 AND type = $2 AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
      [cleanEmail, type]
    );
    if (res.rowCount && res.rowCount > 0) {
      return res.rows[0].otp;
    }
  } catch (_) {}

  const key = `${OTP_PREFIX[type]}${cleanEmail}`;
  const entry = memoryOtpMap.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.otp;
}
