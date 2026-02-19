import { ResubmissionService } from '../../../src/services/vendor/resubmission.service';
import { prisma } from '../../../src/infrastructure/database/prisma';
import { NotFoundError, ValidationError, ConflictError } from '../../../src/utils/errors';
import { VendorStatus, ResubmissionStatus } from '../../../src/domain/enums';

jest.mock('../../../src/infrastructure/database/prisma', () => ({
  prisma: {
    vendor: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    resubmissionRequest: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    onboardingRequest: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../src/config', () => ({
  config: {
    resubmission: {
      maxAttempts: 3,
      cooldownDays: 7,
    },
  },
}));

describe('ResubmissionService', () => {
  let resubmissionService: ResubmissionService;

  beforeEach(() => {
    resubmissionService = new ResubmissionService();
    jest.clearAllMocks();
  });

  describe('checkEligibility', () => {
    it('should return eligible when vendor is rejected and under limit', async () => {
      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-123',
        status: VendorStatus.REJECTED,
      });
      (prisma.resubmissionRequest.count as jest.Mock).mockResolvedValue(1);
      (prisma.resubmissionRequest.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      });

      const result = await resubmissionService.checkEligibility('vendor-123');

      expect(result.eligible).toBe(true);
      expect(result.attemptsUsed).toBe(1);
      expect(result.maxAttempts).toBe(3);
    });

    it('should return not eligible when max attempts exceeded', async () => {
      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-123',
        status: VendorStatus.REJECTED,
      });
      (prisma.resubmissionRequest.count as jest.Mock).mockResolvedValue(3);

      const result = await resubmissionService.checkEligibility('vendor-123');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Maximum resubmission attempts exceeded');
    });

    it('should return not eligible when in cooldown period', async () => {
      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-123',
        status: VendorStatus.REJECTED,
      });
      (prisma.resubmissionRequest.count as jest.Mock).mockResolvedValue(1);
      (prisma.resubmissionRequest.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(), // Just now
      });

      const result = await resubmissionService.checkEligibility('vendor-123');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Cooldown period has not elapsed');
      expect(result.cooldownEndsAt).toBeDefined();
    });

    it('should return not eligible when vendor is not in REJECTED status', async () => {
      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-123',
        status: VendorStatus.APPROVED,
      });

      const result = await resubmissionService.checkEligibility('vendor-123');

      expect(result.eligible).toBe(false);
    });
  });

  describe('initiate', () => {
    it('should create resubmission request when eligible', async () => {
      const mockVendor = {
        id: 'vendor-123',
        status: VendorStatus.REJECTED,
        rejectionReason: 'Missing documents',
      };

      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue(mockVendor);
      (prisma.resubmissionRequest.count as jest.Mock).mockResolvedValue(0);
      (prisma.resubmissionRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const mockResubmission = {
        id: 'resub-123',
        vendorId: 'vendor-123',
        rejectionReason: 'Missing documents',
        previousSubmissionCount: 0,
        status: ResubmissionStatus.DRAFT,
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockResubmission);

      const result = await resubmissionService.initiate('vendor-123', 'user-123');

      expect(result.id).toBe('resub-123');
      expect(result.attemptsRemaining).toBe(2);
    });

    it('should throw ConflictError if draft already exists', async () => {
      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-123',
        status: VendorStatus.REJECTED,
      });
      (prisma.resubmissionRequest.count as jest.Mock).mockResolvedValue(0);
      (prisma.resubmissionRequest.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // For cooldown check
        .mockResolvedValueOnce({ id: 'existing-draft' }); // For draft check

      await expect(
        resubmissionService.initiate('vendor-123', 'user-123')
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('submit', () => {
    it('should submit resubmission request', async () => {
      const mockResubmission = {
        id: 'resub-123',
        vendorId: 'vendor-123',
        status: ResubmissionStatus.DRAFT,
        vendor: { id: 'vendor-123' },
      };

      (prisma.resubmissionRequest.findUnique as jest.Mock).mockResolvedValue(
        mockResubmission
      );

      const updatedResubmission = {
        ...mockResubmission,
        status: ResubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue(updatedResubmission);

      const result = await resubmissionService.submit(
        'resub-123',
        {
          justification: 'I have addressed all the issues',
          changesDescription: 'Updated documents',
          updatedFields: ['documents'],
          acknowledgement: true,
        },
        'user-123'
      );

      expect(result.status).toBe(ResubmissionStatus.SUBMITTED);
    });

    it('should throw ValidationError if not in DRAFT status', async () => {
      (prisma.resubmissionRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'resub-123',
        status: ResubmissionStatus.SUBMITTED,
        vendor: { id: 'vendor-123' },
      });

      await expect(
        resubmissionService.submit(
          'resub-123',
          {
            justification: 'Test',
            changesDescription: 'Test',
            updatedFields: ['documents'],
            acknowledgement: true,
          },
          'user-123'
        )
      ).rejects.toThrow(ValidationError);
    });
  });
});
