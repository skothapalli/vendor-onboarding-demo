import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { authorizeAny } from '../middlewares/authorize.middleware';
import { enforceAuditScope, validateAuditDateRange, AuditAccessScope } from '../middlewares/audit-access.middleware';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import {
  auditQuerySchema,
  complianceAuditQuerySchema,
  verifyIntegritySchema,
} from '../validators/audit.validator';
import { z } from 'zod';

const router = Router();

type AuditRequest = AuthenticatedRequest & { auditScope: AuditAccessScope };

const entityParamSchema = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
});

const vendorIdParamSchema = z.object({ vendorId: z.string().uuid() });

// Full audit access routes (admin/auditor)
router.get(
  '/trail',
  authMiddleware,
  authorizeAny(PERMISSIONS.AUDIT_READ_FULL, PERMISSIONS.AUDIT_READ_RESTRICTED),
  enforceAuditScope,
  validateAuditDateRange as never,
  validateQuery(auditQuerySchema),
  (req, res) => auditController.getAuditTrail(req as AuditRequest, res)
);

router.get(
  '/entity/:entityType/:entityId',
  authMiddleware,
  authorizeAny(PERMISSIONS.AUDIT_READ_FULL, PERMISSIONS.AUDIT_READ_RESTRICTED),
  enforceAuditScope,
  validateParams(entityParamSchema),
  (req, res) => auditController.getEntityTrail(req as AuditRequest, res)
);

router.post(
  '/verify',
  authMiddleware,
  authorizeAny(PERMISSIONS.AUDIT_VERIFY),
  enforceAuditScope,
  validateBody(verifyIntegritySchema),
  (req, res) => auditController.verifyIntegrity(req as AuditRequest, res)
);

// Compliance-specific audit routes (restricted access)
router.get(
  '/compliance/trail',
  authMiddleware,
  authorizeAny(PERMISSIONS.AUDIT_READ_RESTRICTED, PERMISSIONS.AUDIT_READ_FULL),
  enforceAuditScope,
  validateAuditDateRange as never,
  validateQuery(complianceAuditQuerySchema),
  (req, res) => auditController.getComplianceAuditTrail(req as AuditRequest, res)
);

router.get(
  '/compliance/vendor/:vendorId',
  authMiddleware,
  authorizeAny(PERMISSIONS.AUDIT_READ_RESTRICTED, PERMISSIONS.AUDIT_READ_FULL),
  enforceAuditScope,
  validateParams(vendorIdParamSchema),
  (req, res) => auditController.getVendorComplianceAudit(req as AuditRequest, res)
);

export { router as auditRoutes };
