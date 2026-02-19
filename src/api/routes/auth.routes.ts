import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { authRateLimiter } from '../middlewares/rate-limit.middleware';
import { PERMISSIONS } from '../../config/permissions';
import {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  createUserSchema,
} from '../validators/auth.validator';

const router = Router();

router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  authController.login.bind(authController)
);

router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  authController.refreshToken.bind(authController)
);

router.post(
  '/logout',
  authMiddleware,
  (req, res) => authController.logout(req as AuthenticatedRequest, res)
);

router.post(
  '/users',
  authMiddleware,
  authorize(PERMISSIONS.USER_CREATE),
  validateBody(createUserSchema),
  (req, res) => authController.createUser(req as AuthenticatedRequest, res)
);

router.post(
  '/change-password',
  authMiddleware,
  validateBody(changePasswordSchema),
  (req, res) => authController.changePassword(req as AuthenticatedRequest, res)
);

router.get(
  '/me',
  authMiddleware,
  (req, res) => authController.me(req as AuthenticatedRequest, res)
);

export { router as authRoutes };
