import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/enums';
import { ApiResponse } from '../utils/response.util';
import { query } from '../config/database';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return ApiResponse.error(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return ApiResponse.error(
        res,
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
        403,
        'FORBIDDEN'
      );
    }

    return next();
  };
};

export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireOrgOrAdmin = requireRole(UserRole.ORGANIZATION, UserRole.ADMIN);
export const requireAnyAuth = (req: Request, res: Response, next: NextFunction): any => {
  if (!req.user) {
    return ApiResponse.error(res, 'Authentication required', 401, 'UNAUTHORIZED');
  }
  return next();
};

/**
 * Ensures the authenticated user owns the target resource or is a platform admin.
 * If targetParam is 'me', resolves it to req.user.id.
 */
export const requireUserOwnership = (paramName: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return ApiResponse.error(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user.role === UserRole.ADMIN) {
      return next();
    }

    const targetUserId = req.params[paramName] || req.body[paramName] || req.query[paramName];
    if (!targetUserId || targetUserId === 'me' || targetUserId === req.user.id) {
      return next();
    }

    return ApiResponse.error(
      res,
      'You do not have permission to access or modify this user account',
      403,
      'FORBIDDEN'
    );
  };
};

/**
 * Ensures the authenticated user owns the target organization, is an active team member, or is a platform admin.
 */
export const requireOrganizationOwnership = (paramName: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    if (!req.user) {
      return ApiResponse.error(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user.role === UserRole.ADMIN) {
      return next();
    }

    const orgId = req.params[paramName] || req.body[paramName] || req.query[paramName] || (req.params as any).orgId;
    if (!orgId) {
      return ApiResponse.error(res, 'Organization ID is required', 400, 'BAD_REQUEST');
    }

    // Direct match with user's resolved orgId
    if (req.user.orgId && req.user.orgId === orgId) {
      return next();
    }

    // Verify ownership or team membership in database
    try {
      const checkRes = await query(
        `SELECT 1 FROM organizations WHERE id = $1 AND owner_id = $2
         UNION
         SELECT 1 FROM org_team_members WHERE org_id = $1 AND user_id = $2
         LIMIT 1`,
        [orgId, req.user.id]
      );

      if (checkRes.rowCount && checkRes.rowCount > 0) {
        return next();
      }
    } catch (_) {}

    return ApiResponse.error(
      res,
      'You do not have permission to access or modify this organization',
      403,
      'FORBIDDEN'
    );
  };
};
