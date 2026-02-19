import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { ForbiddenError } from '../../utils/errors';
import { Permission } from '../../config/permissions';

export const authorize = (...requiredPermissions: Permission[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const userPermissions = req.user?.permissions || [];

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
};

export const authorizeAny = (...requiredPermissions: Permission[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const userPermissions = req.user?.permissions || [];

    const hasAnyPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasAnyPermission) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const userRoles = req.user?.roles || [];

    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenError('Insufficient role privileges');
    }

    next();
  };
};

export const authorizeSelf = (userIdParam: string = 'id') => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const targetUserId = req.params[userIdParam];
    const currentUserId = req.user?.userId;

    if (targetUserId !== currentUserId) {
      const userPermissions = req.user?.permissions || [];
      if (!userPermissions.includes('user:read')) {
        throw new ForbiddenError('Cannot access other user resources');
      }
    }

    next();
  };
};
