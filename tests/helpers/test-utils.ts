import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/infrastructure/database/prisma';
import { config } from '../../src/config';

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export async function createTestUser(
  overrides: {
    email?: string;
    roles?: string[];
    permissions?: string[];
  } = {}
): Promise<TestUser> {
  const email = overrides.email || `test-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
    },
  });

  const roles = overrides.roles || ['VIEWER'];
  const permissions = overrides.permissions || ['vendor:read'];

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      roles,
      permissions,
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  return { id: user.id, email: user.email, token };
}

export async function createTestVendorCategory(name?: string) {
  return prisma.vendorCategory.create({
    data: {
      name: name || `Category-${Date.now()}`,
      description: 'Test category',
      riskWeight: 1,
    },
  });
}

export async function createTestVendor(userId: string, categoryId: string) {
  return prisma.vendor.create({
    data: {
      legalName: `Test Vendor ${Date.now()}`,
      categoryId,
      createdBy: userId,
      status: 'DRAFT',
    },
  });
}

export async function createTestRole(name: string) {
  return prisma.role.create({
    data: {
      name,
      description: `Test role: ${name}`,
    },
  });
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
