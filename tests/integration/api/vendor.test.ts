import request from 'supertest';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/infrastructure/database/prisma';
import {
  createTestUser,
  createTestVendorCategory,
  createTestVendor,
  authHeader,
} from '../../helpers/test-utils';

const app = createApp();

describe('Vendor API', () => {
  describe('POST /api/v1/vendors', () => {
    it('should create a vendor with valid data', async () => {
      const user = await createTestUser({
        permissions: ['vendor:create', 'vendor:read'],
      });
      const category = await createTestVendorCategory();

      const response = await request(app)
        .post('/api/v1/vendors')
        .set(authHeader(user.token))
        .send({
          legalName: 'Test Vendor Inc',
          categoryId: category.id,
          primaryContactEmail: 'contact@testvendor.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.legalName).toBe('Test Vendor Inc');
      expect(response.body.data.status).toBe('DRAFT');
    });

    it('should return 400 for invalid data', async () => {
      const user = await createTestUser({
        permissions: ['vendor:create'],
      });

      const response = await request(app)
        .post('/api/v1/vendors')
        .set(authHeader(user.token))
        .send({
          legalName: 'X', // Too short
          categoryId: 'not-a-uuid',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VOMS-4000');
    });

    it('should return 403 without proper permissions', async () => {
      const user = await createTestUser({
        permissions: ['vendor:read'], // Missing vendor:create
      });
      const category = await createTestVendorCategory();

      const response = await request(app)
        .post('/api/v1/vendors')
        .set(authHeader(user.token))
        .send({
          legalName: 'Test Vendor',
          categoryId: category.id,
        });

      expect(response.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).post('/api/v1/vendors').send({
        legalName: 'Test Vendor',
        categoryId: 'some-id',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/vendors', () => {
    it('should list vendors with pagination', async () => {
      const user = await createTestUser({
        permissions: ['vendor:create', 'vendor:read'],
      });
      const category = await createTestVendorCategory();

      // Create test vendors
      await createTestVendor(user.id, category.id);
      await createTestVendor(user.id, category.id);

      const response = await request(app)
        .get('/api/v1/vendors')
        .set(authHeader(user.token))
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter vendors by status', async () => {
      const user = await createTestUser({
        permissions: ['vendor:create', 'vendor:read'],
      });
      const category = await createTestVendorCategory();

      await createTestVendor(user.id, category.id);

      const response = await request(app)
        .get('/api/v1/vendors')
        .set(authHeader(user.token))
        .query({ status: 'DRAFT' });

      expect(response.status).toBe(200);
      response.body.data.forEach((vendor: { status: string }) => {
        expect(vendor.status).toBe('DRAFT');
      });
    });
  });

  describe('GET /api/v1/vendors/:id', () => {
    it('should return vendor by id', async () => {
      const user = await createTestUser({
        permissions: ['vendor:create', 'vendor:read'],
      });
      const category = await createTestVendorCategory();
      const vendor = await createTestVendor(user.id, category.id);

      const response = await request(app)
        .get(`/api/v1/vendors/${vendor.id}`)
        .set(authHeader(user.token));

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(vendor.id);
    });

    it('should return 404 for non-existent vendor', async () => {
      const user = await createTestUser({
        permissions: ['vendor:read'],
      });

      const response = await request(app)
        .get('/api/v1/vendors/00000000-0000-0000-0000-000000000000')
        .set(authHeader(user.token));

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/vendors/:id', () => {
    it('should update vendor in DRAFT status', async () => {
      const user = await createTestUser({
        permissions: ['vendor:create', 'vendor:read', 'vendor:update'],
      });
      const category = await createTestVendorCategory();
      const vendor = await createTestVendor(user.id, category.id);

      const response = await request(app)
        .put(`/api/v1/vendors/${vendor.id}`)
        .set(authHeader(user.token))
        .send({
          legalName: 'Updated Vendor Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.legalName).toBe('Updated Vendor Name');
    });
  });

  describe('Resubmission flow', () => {
    it('should allow resubmission for rejected vendor', async () => {
      const user = await createTestUser({
        permissions: ['vendor:read', 'vendor:resubmit'],
      });
      const category = await createTestVendorCategory();

      // Create a rejected vendor
      const vendor = await prisma.vendor.create({
        data: {
          legalName: 'Rejected Vendor',
          categoryId: category.id,
          createdBy: user.id,
          status: 'REJECTED',
          rejectionReason: 'Missing documents',
          rejectedAt: new Date(),
        },
      });

      // Check eligibility
      const eligibilityResponse = await request(app)
        .get(`/api/v1/vendors/${vendor.id}/resubmission/eligibility`)
        .set(authHeader(user.token));

      expect(eligibilityResponse.status).toBe(200);
      expect(eligibilityResponse.body.data.eligible).toBe(true);

      // Initiate resubmission
      const initiateResponse = await request(app)
        .post(`/api/v1/vendors/${vendor.id}/resubmission/initiate`)
        .set(authHeader(user.token))
        .send({ acknowledgement: true });

      expect(initiateResponse.status).toBe(201);
      expect(initiateResponse.body.data.vendorId).toBe(vendor.id);

      const resubmissionId = initiateResponse.body.data.id;

      // Submit resubmission
      const submitResponse = await request(app)
        .post(`/api/v1/vendors/${vendor.id}/resubmission/${resubmissionId}/submit`)
        .set(authHeader(user.token))
        .send({
          justification: 'I have uploaded all required documents',
          changesDescription: 'Added missing compliance documents',
          updatedFields: ['documents', 'complianceItems'],
          acknowledgement: true,
        });

      expect(submitResponse.status).toBe(200);
      expect(submitResponse.body.data.status).toBe('SUBMITTED');
    });
  });
});
