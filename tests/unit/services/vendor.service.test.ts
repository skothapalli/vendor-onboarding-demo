import { VendorService } from '../../../src/services/vendor/vendor.service';
import { prisma } from '../../../src/infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../../src/utils/errors';
import { VendorStatus } from '../../../src/domain/enums';

jest.mock('../../../src/infrastructure/database/prisma', () => ({
  prisma: {
    vendor: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    vendorCategory: {
      findUnique: jest.fn(),
    },
    onboardingRequest: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('VendorService', () => {
  let vendorService: VendorService;

  beforeEach(() => {
    vendorService = new VendorService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockCategory = { id: 'cat-123', name: 'IT Services' };
    const createDto = {
      legalName: 'Test Vendor',
      categoryId: 'cat-123',
    };

    it('should create a vendor successfully', async () => {
      const mockVendor = {
        id: 'vendor-123',
        legalName: 'Test Vendor',
        categoryId: 'cat-123',
        status: VendorStatus.DRAFT,
        category: mockCategory,
      };

      (prisma.vendorCategory.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.vendor.create as jest.Mock).mockResolvedValue(mockVendor);

      const result = await vendorService.create(createDto, 'user-123');

      expect(prisma.vendorCategory.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-123' },
      });
      expect(prisma.vendor.create).toHaveBeenCalled();
      expect(result.legalName).toBe('Test Vendor');
      expect(result.status).toBe(VendorStatus.DRAFT);
    });

    it('should throw NotFoundError if category does not exist', async () => {
      (prisma.vendorCategory.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(vendorService.create(createDto, 'user-123')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getById', () => {
    it('should return vendor with relations', async () => {
      const mockVendor = {
        id: 'vendor-123',
        legalName: 'Test Vendor',
        status: VendorStatus.DRAFT,
        category: { id: 'cat-123', name: 'IT Services' },
        complianceItems: [],
        documents: [],
        onboardingRequests: [],
      };

      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue(mockVendor);

      const result = await vendorService.getById('vendor-123');

      expect(result.id).toBe('vendor-123');
      expect(prisma.vendor.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vendor-123' },
        })
      );
    });

    it('should throw NotFoundError if vendor does not exist', async () => {
      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(vendorService.getById('non-existent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('submit', () => {
    it('should submit vendor for review', async () => {
      const mockVendor = {
        id: 'vendor-123',
        status: VendorStatus.DRAFT,
        complianceItems: [
          { id: 'item-1', status: 'COMPLETED' },
          { id: 'item-2', status: 'WAIVED' },
        ],
      };

      const updatedVendor = {
        ...mockVendor,
        status: VendorStatus.PENDING_REVIEW,
        submittedAt: new Date(),
      };

      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue(mockVendor);
      (prisma.$transaction as jest.Mock).mockResolvedValue(updatedVendor);

      const result = await vendorService.submit('vendor-123', 'user-123');

      expect(result.status).toBe(VendorStatus.PENDING_REVIEW);
    });

    it('should throw ValidationError if compliance items are incomplete', async () => {
      const mockVendor = {
        id: 'vendor-123',
        status: VendorStatus.DRAFT,
        complianceItems: [
          { id: 'item-1', status: 'COMPLETED', name: 'Item 1' },
          { id: 'item-2', status: 'PENDING', name: 'Item 2' },
        ],
      };

      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue(mockVendor);

      await expect(vendorService.submit('vendor-123', 'user-123')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('status transitions', () => {
    it('should approve vendor from UNDER_REVIEW status', async () => {
      const mockVendor = {
        id: 'vendor-123',
        status: VendorStatus.UNDER_REVIEW,
      };

      const approvedVendor = {
        ...mockVendor,
        status: VendorStatus.APPROVED,
        approvedAt: new Date(),
      };

      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue(mockVendor);
      (prisma.vendor.update as jest.Mock).mockResolvedValue(approvedVendor);

      const result = await vendorService.approve('vendor-123', 'user-123');

      expect(result.status).toBe(VendorStatus.APPROVED);
    });

    it('should reject invalid status transition', async () => {
      const mockVendor = {
        id: 'vendor-123',
        status: VendorStatus.DRAFT, // Cannot approve from DRAFT
      };

      (prisma.vendor.findUnique as jest.Mock).mockResolvedValue(mockVendor);

      await expect(
        vendorService.approve('vendor-123', 'user-123')
      ).rejects.toThrow(ValidationError);
    });
  });
});
