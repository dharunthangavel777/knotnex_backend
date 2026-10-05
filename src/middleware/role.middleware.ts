import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/enums';
import { ApiResponse } from '../utils/response.util';

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
