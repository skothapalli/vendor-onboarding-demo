import request from 'supertest';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/infrastructure/database/prisma';
import { createTestUser, authHeader } from '../../helpers/test-utils';
import { AuditAction } from '../../../src/domain/enums';

const app = createApp();

describe('Audit API', () => {
  describe('GET /api/v1/audit/trail', () => {
    beforeEach(async () => {
      // Create some audit logs
      await prisma.auditLog.createMany({
        data: [
          {
            entityType: 'Vendor',
            entityId: '00000000-0000-0000-0000-000000000001',
            action: AuditAction.CREATE,
            userEmail: 'test@example.com',
            timestamp: new Date(),
          },
          {
            entityType: 'Vendor',
            entityId: '00000000-0000-0000-0000-000000000001',
            action: AuditAction.UPDATE,
            userEmail: 'test@example.com',
            timestamp: new Date(),
          },
          {
            entityType: 'ComplianceItem',
            entityId: '00000000-0000-0000-0000-000000000002',
            action: AuditAction.CREATE,
            userEmail: 'test@example.com',
            timestamp: new Date(),
          },
        ],
      });
    });

    it('should return audit trail for users with full access', async () => {
      const user = await createTestUser({
        permissions: ['audit:read:full'],
      });

      const response = await request(app)
        .get('/api/v1/audit/trail')
        .set(authHeader(user.token))
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(3);
    });

    it('should filter by entity type', async () => {
      const user = await createTestUser({
        permissions: ['audit:read:full'],
      });

      const response = await request(app)
        .get('/api/v1/audit/trail')
        .set(authHeader(user.token))
        .query({ entityType: 'Vendor' });

      expect(response.status).toBe(200);
      response.body.data.forEach((log: { entityType: string }) => {
        expect(log.entityType).toBe('Vendor');
      });
    });

    it('should return 403 without audit permissions', async () => {
      const user = await createTestUser({
        permissions: ['vendor:read'],
      });

      const response = await request(app)
        .get('/api/v1/audit/trail')
        .set(authHeader(user.token));

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/audit/compliance/trail', () => {
    it('should return restricted audit trail for compliance users', async () => {
      const user = await createTestUser({
        permissions: ['audit:read:restricted'],
      });

      const response = await request(app)
        .get('/api/v1/audit/compliance/trail')
        .set(authHeader(user.token))
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should mask sensitive fields for restricted access', async () => {
      // Create audit log with sensitive data
      await prisma.auditLog.create({
        data: {
          entityType: 'Vendor',
          entityId: '00000000-0000-0000-0000-000000000003',
          action: AuditAction.UPDATE,
          userEmail: 'test@example.com',
          before: { taxId: '12-3456789', bankingInfo: 'secret' },
          after: { taxId: '12-3456789', bankingInfo: 'new-secret' },
          timestamp: new Date(),
        },
      });

      const user = await createTestUser({
        permissions: ['audit:read:restricted'],
      });

      const response = await request(app)
        .get('/api/v1/audit/compliance/trail')
        .set(authHeader(user.token));

      expect(response.status).toBe(200);
      // Sensitive fields should be masked
      const logs = response.body.data;
      logs.forEach((log: { before?: { taxId?: string }; after?: { taxId?: string } }) => {
        if (log.before?.taxId) {
          expect(log.before.taxId).toBe('[REDACTED]');
        }
        if (log.after?.taxId) {
          expect(log.after.taxId).toBe('[REDACTED]');
        }
      });
    });
  });

  describe('GET /api/v1/audit/entity/:entityType/:entityId', () => {
    it('should return audit trail for specific entity', async () => {
      const entityId = '00000000-0000-0000-0000-000000000001';

      const user = await createTestUser({
        permissions: ['audit:read:full'],
      });

      const response = await request(app)
        .get(`/api/v1/audit/entity/Vendor/${entityId}`)
        .set(authHeader(user.token));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((log: { entityId: string }) => {
        expect(log.entityId).toBe(entityId);
      });
    });
  });

  describe('POST /api/v1/audit/verify', () => {
    it('should verify audit log integrity', async () => {
      const user = await createTestUser({
        permissions: ['audit:verify'],
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();

      const response = await request(app)
        .post('/api/v1/audit/verify')
        .set(authHeader(user.token))
        .send({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('valid');
      expect(response.body.data).toHaveProperty('totalChecked');
    });
  });
});
