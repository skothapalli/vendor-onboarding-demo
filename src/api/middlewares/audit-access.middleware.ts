import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { ForbiddenError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';
import { prisma } from '../../infrastructure/database/prisma';

export interface AuditAccessScope {
  allowedEntityTypes: string[];
  allowedActions: string[];
  excludedFields: string[];
  dataRetentionDays: number;
  canExport: boolean;
  canViewUserDetails: boolean;
}

const DEFAULT_COMPLIANCE_SCOPE: AuditAccessScope = {
  allowedEntityTypes: ['Vendor', 'ComplianceItem', 'ComplianceChecklist', 'Document', 'OnboardingRequest'],
  allowedActions: ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'APPROVAL'],
  excludedFields: ['bankingInfo', 'taxId', 'ssn', 'internalNotes', 'bankAccountEncrypted', 'bankRoutingEncrypted'],
  dataRetentionDays: 365,
  canExport: false,
  canViewUserDetails: false,
};

const FULL_ACCESS_SCOPE: AuditAccessScope = {
  allowedEntityTypes: [],
  allowedActions: [],
  excludedFields: [],
  dataRetentionDays: 2555,
  canExport: true,
  canViewUserDetails: true,
};

export const getAuditScope = async (userId: string): Promise<AuditAccessScope> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              auditScopes: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return DEFAULT_COMPLIANCE_SCOPE;
  }

  for (const userRole of user.roles) {
    const scope = userRole.role.auditScopes[0];
    if (scope) {
      return {
        allowedEntityTypes: scope.allowedEntityTypes as string[],
        allowedActions: scope.allowedActions as string[],
        excludedFields: scope.excludedFields as string[],
        dataRetentionDays: scope.dataRetentionDays,
        canExport: scope.canExport,
        canViewUserDetails: scope.canViewUserDetails,
      };
    }
  }

  return DEFAULT_COMPLIANCE_SCOPE;
};

export const enforceAuditScope = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const userPermissions = req.user?.permissions || [];

  if (userPermissions.includes(PERMISSIONS.AUDIT_READ_FULL)) {
    (req as AuthenticatedRequest & { auditScope: AuditAccessScope }).auditScope = FULL_ACCESS_SCOPE;
    return next();
  }

  if (!userPermissions.includes(PERMISSIONS.AUDIT_READ_RESTRICTED)) {
    throw new ForbiddenError('No audit access permissions');
  }

  const scope = await getAuditScope(req.user.userId);
  (req as AuthenticatedRequest & { auditScope: AuditAccessScope }).auditScope = scope;

  next();
};

export const validateAuditDateRange = (
  req: AuthenticatedRequest & { auditScope: AuditAccessScope },
  _res: Response,
  next: NextFunction
): void => {
  const scope = req.auditScope;

  if (!scope || scope.dataRetentionDays === 0) {
    return next();
  }

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() - scope.dataRetentionDays);

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;

  if (startDate && startDate < maxDate) {
    req.query.startDate = maxDate.toISOString();
  }

  next();
};

export const maskAuditFields = (
  data: Record<string, unknown>,
  excludedFields: string[]
): Record<string, unknown> => {
  const masked = { ...data };

  for (const field of excludedFields) {
    if (field in masked) {
      masked[field] = '[REDACTED]';
    }
  }

  if (typeof masked.before === 'object' && masked.before !== null) {
    masked.before = maskAuditFields(masked.before as Record<string, unknown>, excludedFields);
  }

  if (typeof masked.after === 'object' && masked.after !== null) {
    masked.after = maskAuditFields(masked.after as Record<string, unknown>, excludedFields);
  }

  return masked;
};
