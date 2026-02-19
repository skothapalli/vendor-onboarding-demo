import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { vendorRoutes } from './vendor.routes';
import { complianceRoutes } from './compliance.routes';
import { workflowRoutes } from './workflow.routes';
import { auditRoutes } from './audit.routes';
import { healthRoutes } from './health.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/vendors', vendorRoutes);
router.use('/compliance', complianceRoutes);
router.use('/workflows', workflowRoutes);
router.use('/audit', auditRoutes);
router.use('/health', healthRoutes);

export { router as apiRoutes };
