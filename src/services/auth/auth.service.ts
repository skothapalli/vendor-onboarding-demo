import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/database/prisma';
import { config } from '../../config';
import { UnauthorizedError, NotFoundError, ConflictError } from '../../utils/errors';
import { encryptionService } from '../../utils/encryption';
import { ROLE_PERMISSIONS } from '../../config/permissions';
import { CreateUserDto, LoginDto } from '../../api/validators/auth.validator';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError('Account is locked');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginCount);
      throw new UnauthorizedError('Invalid credentials');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lastLoginAt: new Date(),
        lockedUntil: null,
      },
    });

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = this.extractPermissions(user.roles);

    return this.generateTokens(user.id, user.email, roles, permissions);
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const user = storedToken.user;
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = this.extractPermissions(user.roles);

    return this.generateTokens(user.id, user.email, roles, permissions);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { userId, token: refreshToken },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async createUser(dto: CreateUserDto, createdBy: string): Promise<{ id: string; email: string }> {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roles: {
          create: dto.roleIds.map((roleId) => ({
            roleId,
            assignedBy: createdBy,
          })),
        },
      },
    });

    return { id: user.id, email: user.email };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
      },
    });

    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async handleFailedLogin(userId: string, currentFailedCount: number): Promise<void> {
    const newFailedCount = currentFailedCount + 1;
    const lockUntil = newFailedCount >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: newFailedCount,
        lockedUntil: lockUntil,
      },
    });
  }

  private generateTokens(
    userId: string,
    email: string,
    roles: string[],
    permissions: string[]
  ): TokenPair {
    const accessToken = jwt.sign(
      { userId, email, roles, permissions },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiry }
    );

    const refreshToken = encryptionService.generateSecureToken(64);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  private extractPermissions(
    userRoles: Array<{
      role: {
        name: string;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>
  ): string[] {
    const permissionSet = new Set<string>();

    for (const userRole of userRoles) {
      const rolePermissions = ROLE_PERMISSIONS[userRole.role.name as keyof typeof ROLE_PERMISSIONS];
      if (rolePermissions) {
        rolePermissions.forEach((p) => permissionSet.add(p));
      }

      for (const rp of userRole.role.permissions) {
        permissionSet.add(rp.permission.code);
      }
    }

    return Array.from(permissionSet);
  }
}

export const authService = new AuthService();
