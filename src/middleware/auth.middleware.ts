import { Request, Response, NextFunction } from 'express';
import { auth as firebaseAuth } from '../config/firebase';
import { query } from '../config/database';
import { ApiResponse } from '../utils/response.util';
import { AuthenticatedUser } from '../types/interfaces';
import { UserRole } from '../types/enums';
import { logger } from '../config/logger';
import { config } from '../config';
import { verifyAccessToken } from '../shared/utils/jwt.util';

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// No Redis cache in this architecture (low-cost 3-service plan).
// Each authenticated request performs a direct PostgreSQL lookup.
// Acceptable at ≤5 Cloud Run instances × 40 concurrency = 200 max requests.
// To re-enable user caching: restore redis.ts and getCachedUser/setCachedUser.

// ─── Primary Authentication Middleware ───────────────────────────────────────
// Supports both:
//  1. Knotnex JWT access tokens (issued by our server after signup/signin)
//  2. Firebase ID tokens (for direct Firebase auth flows)
//  3. Development mock tokens (mock_<role>)
// ─────────────────────────────────────────────────────────────────────────────

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 'Authentication token required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split('Bearer ')[1].trim();

const resolveUserOrgId = async (userId: string): Promise<string | undefined> => {
  try {
    const orgRes = await query(
      `SELECT id FROM organizations WHERE owner_id = $1 OR id IN (SELECT org_id FROM org_team_members WHERE user_id = $1) LIMIT 1`,
      [userId]
    );
    if (orgRes.rowCount && orgRes.rowCount > 0) {
      return orgRes.rows[0].id;
    }
  } catch (_) {}
  return undefined;
};

    // ─── Development mock bypass ─────────────────────────────────────────────
    if ((config.env === 'development' || !config.isProduction) && token.startsWith('mock_')) {
      const role = token.replace('mock_', '') as UserRole;
      req.user = {
        id: '00000000-0000-0000-0000-000000000001',
        firebaseUid: 'mock-uid',
        email: `${role || 'user'}@knotnex.test`,
        role: Object.values(UserRole).includes(role) ? role : UserRole.USER,
        orgId: '00000000-0000-0000-0000-000000000001',
        isVerified: true,
        isBanned: false,
      };
      return next();
    }

    // ─── Try Knotnex JWT (access token) ──────────────────────────────────────
    try {
      const decoded = verifyAccessToken(token);
      if (decoded.type === 'access') {
        let dbUser: any = null;
        try {
          const userRes = await query(
            'SELECT id, firebase_uid, email, role, is_verified, is_banned FROM users WHERE id = $1 LIMIT 1',
            [decoded.sub]
          );
          if (userRes.rowCount && userRes.rowCount > 0) {
            dbUser = userRes.rows[0];
          }
        } catch (dbErr: any) {
          if (config.env === 'development') {
            logger.warn('[AuthMiddleware] DB query timed out/unreachable, authenticating from signed JWT payload');
            dbUser = {
              id: decoded.sub,
              firebase_uid: decoded.uid,
              email: decoded.email,
              role: decoded.role,
              is_verified: true,
              is_banned: false,
            };
          }
        }

        if (dbUser) {
          if (dbUser.is_banned) {
            return ApiResponse.error(res, 'Your account has been suspended', 403, 'ACCOUNT_BANNED');
          }

          const userObj: AuthenticatedUser = {
            id: dbUser.id,
            firebaseUid: dbUser.firebase_uid,
            email: dbUser.email,
            role: dbUser.role as UserRole,
            orgId: await resolveUserOrgId(dbUser.id),
            isVerified: dbUser.is_verified,
            isBanned: dbUser.is_banned,
          };

          req.user = userObj;
          return next();
        }
      }
    } catch {
      // Not a Knotnex JWT — try Firebase token next
    }

    // ─── Try Firebase ID token ────────────────────────────────────────────────
    let decodedToken;
    try {
      decodedToken = await firebaseAuth.verifyIdToken(token);
    } catch (err: any) {
      return ApiResponse.error(res, 'Invalid or expired authentication token', 401, 'INVALID_TOKEN');
    }

    // Lookup user in PostgreSQL by Firebase UID
    let userRes = await query(
      'SELECT id, firebase_uid, email, role, is_verified, is_banned FROM users WHERE firebase_uid = $1 LIMIT 1',
      [decodedToken.uid]
    );

    if (!userRes.rowCount || userRes.rowCount === 0) {
      if (decodedToken.email) {
        userRes = await query(
          'SELECT id, firebase_uid, email, role, is_verified, is_banned FROM users WHERE email = $1 LIMIT 1',
          [decodedToken.email]
        );
        if (userRes.rowCount && userRes.rowCount > 0) {
          // Link firebase_uid to Postgres user
          await query('UPDATE users SET firebase_uid = $1 WHERE id = $2', [
            decodedToken.uid,
            userRes.rows[0].id,
          ]);
        }
      }
    }

    if (!userRes.rowCount || userRes.rowCount === 0) {
      // Auto-provision verified Firebase user in PostgreSQL to guarantee a valid UUID
      try {
        const autoEmail = (decodedToken.email || `${decodedToken.uid}@knotnex.user`).toLowerCase().trim();
        const autoName = decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'KnotNex Member');
        const autoRole = (decodedToken['role'] as UserRole) || UserRole.USER;

        const insertRes = await query(
          `INSERT INTO users (firebase_uid, email, full_name, role, is_verified)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (email) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid, updated_at = NOW()
           RETURNING id, firebase_uid, email, role, is_verified, is_banned`,
          [decodedToken.uid, autoEmail, autoName, autoRole, decodedToken.email_verified || true]
        );

        if (insertRes.rowCount && insertRes.rowCount > 0) {
          const createdUser = insertRes.rows[0];
          await query(
            `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
            [createdUser.id]
          );

          const userObj: AuthenticatedUser = {
            id: createdUser.id,
            firebaseUid: createdUser.firebase_uid,
            email: createdUser.email,
            role: createdUser.role as UserRole,
            isVerified: createdUser.is_verified,
            isBanned: createdUser.is_banned,
          };

          req.user = userObj;
          return next();
        }
      } catch (provErr: any) {
        logger.warn(`[AuthMiddleware] Auto-provisioning failed: ${provErr.message}`);
      }

      return ApiResponse.error(res, 'User account not configured in database', 401, 'ACCOUNT_NOT_FOUND');
    }

    const dbUser = userRes.rows[0];
    if (dbUser.is_banned) {
      return ApiResponse.error(res, 'Your account has been suspended', 403, 'ACCOUNT_BANNED');
    }

    const userObj: AuthenticatedUser = {
      id: dbUser.id,
      firebaseUid: dbUser.firebase_uid,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      orgId: await resolveUserOrgId(dbUser.id),
      isVerified: dbUser.is_verified,
      isBanned: dbUser.is_banned,
    };

    req.user = userObj;
    return next();
  } catch (error: any) {
    logger.error('Authentication middleware error', { error: error.message });
    return ApiResponse.error(res, 'Authentication verification failed', 500, 'AUTH_ERROR');
  }
};

// ─── Optional Authentication ──────────────────────────────────────────────────
// Sets req.user if token is present, continues if not.

export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, next);
};
