import { Router } from 'express';
import { complianceController } from '../controllers/compliance.controller';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import {
  createComplianceTemplateSchema,
  assignComplianceSchema,
  updateComplianceItemSchema,
  complianceQuerySchema,
} from '../validators/compliance.validator';
import { z } from 'zod';

const router = Router();

const idParamSchema = z.object({ id: z.string().uuid() });
const vendorIdParamSchema = z.object({ vendorId: z.string().uuid() });

// Template routes
router.post(
  '/templates',
  authMiddleware,
  authorize(PERMISSIONS.COMPLIANCE_TEMPLATE_CREATE),
  validateBody(createComplianceTemplateSchema),
  (req, res) => complianceController.createTemplate(req as AuthenticatedRequest, res)
);

router.get(
  '/templates',
  authMiddleware,
  authorize(PERMISSIONS.COMPLIANCE_TEMPLATE_READ),
  (req, res) => complianceController.listTemplates(req as AuthenticatedRequest, res)
);

router.get(
  '/templates/:id',
  authMiddleware,
  authorize(PERMISSIONS.COMPLIANCE_TEMPLATE_READ),
  validateParams(idParamSchema),
  (req, res) => complianceController.getTemplateById(req as AuthenticatedRequest, res)
);

// Vendor compliance routes
router.post(
  '/vendors/:vendorId/assign',
  authMiddleware,
  authorize(PERMISSIONS.COMPLIANCE_ASSIGN),
  validateParams(vendorIdParamSchema),
  validateBody(assignComplianceSchema),
  (req, res) => complianceController.assignToVendor(req as AuthenticatedRequest, res)
);

router.get(
  '/vendors/:vendorId',
  authMiddleware,
  authorize(PERMISSIONS.COMPLIANCE_READ),
  validateParams(vendorIdParamSchema),
  (req, res) => complianceController.getVendorCompliance(req as AuthenticatedRequest, res)
);

// Item routes
router.get(
  '/items',
  authMiddleware,
  authorize(PERMISSIONS.COMPLIANCE_READ),
  validateQuery(complianceQuerySchema),
  (req, res) => complianceController.listItems(req as AuthenticatedRequest, res)
);

router.get(
  '/items/:id',
  authMiddleware,
  authorize(PERMISSIONS.COMPLIANCE_READ),
  validateParams(idParamSchema),
  (req, res) => complianceController.getItemById(req as AuthenticatedRequest, res)
);

router.put(
  '/items/:id/status',
  authMiddleware,
  authorize(PERMISSIONS.COMPLIANCE_UPDATE),
  validateParams(idParamSchema),
  validateBody(updateComplianceItemSchema),
  (req, res) => complianceController.updateItemStatus(req as AuthenticatedRequest, res)
);

export { router as complianceRoutes };
