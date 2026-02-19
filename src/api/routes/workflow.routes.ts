import { Router } from 'express';
import { workflowController } from '../controllers/workflow.controller';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.middleware';
import { PERMISSIONS } from '../../config/permissions';
import {
  createWorkflowConfigSchema,
  approveStepSchema,
  rejectStepSchema,
  delegateApprovalSchema,
  workflowQuerySchema,
} from '../validators/workflow.validator';
import { z } from 'zod';

const router = Router();

const idParamSchema = z.object({ id: z.string().uuid() });

// Config routes
router.post(
  '/config',
  authMiddleware,
  authorize(PERMISSIONS.WORKFLOW_CONFIG_CREATE),
  validateBody(createWorkflowConfigSchema),
  (req, res) => workflowController.createConfig(req as AuthenticatedRequest, res)
);

router.get(
  '/config',
  authMiddleware,
  authorize(PERMISSIONS.WORKFLOW_CONFIG_READ),
  (req, res) => workflowController.listConfigs(req as AuthenticatedRequest, res)
);

router.get(
  '/config/:id',
  authMiddleware,
  authorize(PERMISSIONS.WORKFLOW_CONFIG_READ),
  validateParams(idParamSchema),
  (req, res) => workflowController.getConfigById(req as AuthenticatedRequest, res)
);

// Approval routes
router.get(
  '/pending',
  authMiddleware,
  validateQuery(workflowQuerySchema),
  (req, res) => workflowController.getPendingApprovals(req as AuthenticatedRequest, res)
);

router.get(
  '/steps/:id',
  authMiddleware,
  validateParams(idParamSchema),
  (req, res) => workflowController.getStepById(req as AuthenticatedRequest, res)
);

router.post(
  '/steps/:id/approve',
  authMiddleware,
  authorize(PERMISSIONS.WORKFLOW_APPROVE),
  validateParams(idParamSchema),
  validateBody(approveStepSchema),
  (req, res) => workflowController.approve(req as AuthenticatedRequest, res)
);

router.post(
  '/steps/:id/reject',
  authMiddleware,
  authorize(PERMISSIONS.WORKFLOW_REJECT),
  validateParams(idParamSchema),
  validateBody(rejectStepSchema),
  (req, res) => workflowController.reject(req as AuthenticatedRequest, res)
);

// Delegation routes
router.post(
  '/delegate',
  authMiddleware,
  authorize(PERMISSIONS.WORKFLOW_DELEGATE),
  validateBody(delegateApprovalSchema),
  (req, res) => workflowController.delegate(req as AuthenticatedRequest, res)
);

router.delete(
  '/delegate/:id',
  authMiddleware,
  authorize(PERMISSIONS.WORKFLOW_DELEGATE),
  validateParams(idParamSchema),
  (req, res) => workflowController.revokeDelegation(req as AuthenticatedRequest, res)
);

export { router as workflowRoutes };
