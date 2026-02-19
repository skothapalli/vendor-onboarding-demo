import { Request, Response } from 'express';
import { authService } from '../../services/auth/auth.service';
import { auditService } from '../../services/audit/audit.service';
import { AuditAction } from '../../domain/enums';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  CreateUserDto,
} from '../validators/auth.validator';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const dto = req.body as LoginDto;
    const tokens = await authService.login(dto);

    await auditService.log({
      entityType: 'User',
      entityId: 'login',
      action: AuditAction.LOGIN,
      userEmail: dto.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: tokens,
    });
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const dto = req.body as RefreshTokenDto;
    const tokens = await authService.refreshTokens(dto.refreshToken);

    res.json({
      success: true,
      data: tokens,
    });
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    const refreshToken = req.body.refreshToken as string | undefined;
    await authService.logout(req.user.userId, refreshToken);

    await auditService.log({
      entityType: 'User',
      entityId: req.user.userId,
      action: AuditAction.LOGOUT,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as CreateUserDto;
    const user = await authService.createUser(dto, req.user.userId);

    await auditService.log({
      entityType: 'User',
      entityId: user.id,
      action: AuditAction.CREATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { email: user.email },
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  }

  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as ChangePasswordDto;
    await authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);

    await auditService.log({
      entityType: 'User',
      entityId: req.user.userId,
      action: AuditAction.UPDATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      changes: { passwordChanged: true },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  }

  async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        userId: req.user.userId,
        email: req.user.email,
        roles: req.user.roles,
        permissions: req.user.permissions,
      },
    });
  }
}

export const authController = new AuthController();
