import { Request, Response, NextFunction } from 'express';
import { auth as firebaseAuth } from '../config/firebase';
import { query } from '../config/database';
import { ApiResponse } from '../utils/response.util';
import { AuthenticatedUser } from '../types/interfaces';
import { UserRole } from '../types/enums';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../shared/utils/jwt.util';

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

    // ─── Development mock bypass ─────────────────────────────────────────────
    if (process.env.NODE_ENV === 'development' && token.startsWith('mock_')) {
      const role = token.replace('mock_', '') as UserRole;
      req.user = {
        id: '00000000-0000-0000-0000-000000000001',
        firebaseUid: 'mock-uid',
        email: `${role || 'user'}@knotnex.test`,
        role: Object.values(UserRole).includes(role) ? role : UserRole.USER,
        isVerified: true,
        isBanned: false,
      };
      return next();
    }

    // ─── Try Knotnex JWT (access token) ──────────────────────────────────────
    // Our JWTs contain `type: 'access'` in payload
    try {
      const decoded = verifyAccessToken(token);
      if (decoded.type === 'access') {
        // Quick DB lookup to get is_banned status
        const userRes = await query(
          'SELECT id, firebase_uid, email, role, is_verified, is_banned FROM users WHERE id = $1 LIMIT 1',
          [decoded.sub]
        );

        if (userRes.rowCount && userRes.rowCount > 0) {
          const dbUser = userRes.rows[0];
          if (dbUser.is_banned) {
            return ApiResponse.error(res, 'Your account has been suspended', 403, 'ACCOUNT_BANNED');
          }

          req.user = {
            id: dbUser.id,
            firebaseUid: dbUser.firebase_uid,
            email: dbUser.email,
            role: dbUser.role as UserRole,
            isVerified: dbUser.is_verified,
            isBanned: dbUser.is_banned,
          };
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
      // Firebase user not yet in PostgreSQL (rare, during signup flow)
      req.user = {
        id: '',
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        role: (decodedToken['role'] as UserRole) || UserRole.USER,
        isVerified: decodedToken.email_verified || false,
        isBanned: false,
      };
      return next();
    }

    const dbUser = userRes.rows[0];
    if (dbUser.is_banned) {
      return ApiResponse.error(res, 'Your account has been suspended', 403, 'ACCOUNT_BANNED');
    }

    req.user = {
      id: dbUser.id,
      firebaseUid: dbUser.firebase_uid,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      isVerified: dbUser.is_verified,
      isBanned: dbUser.is_banned,
    };

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
