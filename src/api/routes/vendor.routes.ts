import { Router } from 'express';
import { vendorController } from '../controllers/vendor.controller';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import {
  createVendorSchema,
  updateVendorSchema,
  vendorQuerySchema,
  submitVendorSchema,
  rejectVendorSchema,
  terminateVendorSchema,
} from '../validators/vendor.validator';
import {
  initiateResubmissionSchema,
  submitResubmissionSchema,
} from '../validators/resubmission.validator';
import { z } from 'zod';

const router = Router();

const idParamSchema = z.object({ id: z.string().uuid() });
const resubmissionParamSchema = z.object({
  id: z.string().uuid(),
  resubmissionId: z.string().uuid(),
});

router.post(
  '/',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_CREATE),
  validateBody(createVendorSchema),
  (req, res) => vendorController.create(req as AuthenticatedRequest, res)
);

router.get(
  '/',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_READ),
  validateQuery(vendorQuerySchema),
  (req, res) => vendorController.list(req as AuthenticatedRequest, res)
);

router.get(
  '/:id',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_READ),
  validateParams(idParamSchema),
  (req, res) => vendorController.getById(req as AuthenticatedRequest, res)
);

router.put(
  '/:id',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_UPDATE),
  validateParams(idParamSchema),
  validateBody(updateVendorSchema),
  (req, res) => vendorController.update(req as AuthenticatedRequest, res)
);

router.post(
  '/:id/submit',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_SUBMIT),
  validateParams(idParamSchema),
  validateBody(submitVendorSchema),
  (req, res) => vendorController.submit(req as AuthenticatedRequest, res)
);

router.post(
  '/:id/approve',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_APPROVE),
  validateParams(idParamSchema),
  (req, res) => vendorController.approve(req as AuthenticatedRequest, res)
);

router.post(
  '/:id/reject',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_REJECT),
  validateParams(idParamSchema),
  validateBody(rejectVendorSchema),
  (req, res) => vendorController.reject(req as AuthenticatedRequest, res)
);

router.post(
  '/:id/deactivate',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_UPDATE),
  validateParams(idParamSchema),
  (req, res) => vendorController.deactivate(req as AuthenticatedRequest, res)
);

router.post(
  '/:id/terminate',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_TERMINATE),
  validateParams(idParamSchema),
  validateBody(terminateVendorSchema),
  (req, res) => vendorController.terminate(req as AuthenticatedRequest, res)
);

// Resubmission routes
router.post(
  '/:id/resubmission/initiate',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_RESUBMIT),
  validateParams(idParamSchema),
  validateBody(initiateResubmissionSchema),
  (req, res) => vendorController.initiateResubmission(req as AuthenticatedRequest, res)
);

router.post(
  '/:id/resubmission/:resubmissionId/submit',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_RESUBMIT),
  validateParams(resubmissionParamSchema),
  validateBody(submitResubmissionSchema),
  (req, res) => vendorController.submitResubmission(req as AuthenticatedRequest, res)
);

router.get(
  '/:id/resubmission/history',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_READ),
  validateParams(idParamSchema),
  (req, res) => vendorController.getResubmissionHistory(req as AuthenticatedRequest, res)
);

router.get(
  '/:id/resubmission/eligibility',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_READ),
  validateParams(idParamSchema),
  (req, res) => vendorController.getResubmissionEligibility(req as AuthenticatedRequest, res)
);

router.delete(
  '/:id/resubmission/:resubmissionId',
  authMiddleware,
  authorize(PERMISSIONS.VENDOR_RESUBMIT),
  validateParams(resubmissionParamSchema),
  (req, res) => vendorController.cancelResubmission(req as AuthenticatedRequest, res)
);

export { router as vendorRoutes };
