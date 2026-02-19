import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors';
import { VendorStatus, VALID_STATUS_TRANSITIONS } from '../../domain/enums';
import { encryptionService } from '../../utils/encryption';
import {
  CreateVendorDto,
  UpdateVendorDto,
  VendorQueryDto,
} from '../../api/validators/vendor.validator';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class VendorService {
  async create(dto: CreateVendorDto, userId: string) {
    const category = await prisma.vendorCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundError('Vendor Category', dto.categoryId);
    }

    const taxIdEncrypted = dto.taxId ? encryptionService.encrypt(dto.taxId) : null;

    const vendor = await prisma.vendor.create({
      data: {
        legalName: dto.legalName,
        dbaName: dto.dbaName,
        taxIdEncrypted,
        categoryId: dto.categoryId,
        primaryContactName: dto.primaryContactName,
        primaryContactEmail: dto.primaryContactEmail,
        primaryContactPhone: dto.primaryContactPhone,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        createdBy: userId,
        status: VendorStatus.DRAFT,
      },
      include: {
        category: true,
      },
    });

    return this.sanitizeVendor(vendor);
  }

  async update(id: string, dto: UpdateVendorDto, userId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', id);
    }

    if (![VendorStatus.DRAFT, VendorStatus.PENDING_RESUBMISSION].includes(vendor.status as VendorStatus)) {
      throw new ValidationError('Vendor can only be updated in DRAFT or PENDING_RESUBMISSION status');
    }

    const updateData: Prisma.VendorUpdateInput = {
      ...dto,
      updatedBy: userId,
    };

    if (dto.taxId) {
      updateData.taxIdEncrypted = encryptionService.encrypt(dto.taxId);
      delete (updateData as Record<string, unknown>).taxId;
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });

    return this.sanitizeVendor(updated);
  }

  async getById(id: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        category: true,
        complianceItems: {
          orderBy: { createdAt: 'asc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        onboardingRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            workflowSteps: {
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', id);
    }

    return this.sanitizeVendor(vendor);
  }

  async list(query: VendorQueryDto): Promise<PaginatedResult<ReturnType<typeof this.sanitizeVendor>>> {
    const where: Prisma.VendorWhereInput = {};

    if (query.search) {
      where.OR = [
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { dbaName: { contains: query.search, mode: 'insensitive' } },
        { primaryContactEmail: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.riskTier) {
      where.riskTier = query.riskTier;
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.vendor.count({ where }),
    ]);

    return {
      data: vendors.map((v) => this.sanitizeVendor(v)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async submit(id: string, userId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        complianceItems: true,
      },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', id);
    }

    this.validateStatusTransition(vendor.status as VendorStatus, VendorStatus.PENDING_REVIEW);

    const incompleteItems = vendor.complianceItems.filter(
      (item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS'
    );

    if (incompleteItems.length > 0) {
      throw new ValidationError('All compliance items must be completed before submission', {
        incompleteItems: incompleteItems.map((i) => i.name),
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedVendor = await tx.vendor.update({
        where: { id },
        data: {
          status: VendorStatus.PENDING_REVIEW,
          submittedAt: new Date(),
          updatedBy: userId,
        },
      });

      await tx.onboardingRequest.create({
        data: {
          vendorId: id,
          status: 'PENDING',
          submittedAt: new Date(),
          submittedBy: userId,
        },
      });

      return updatedVendor;
    });

    return this.sanitizeVendor(updated);
  }

  async approve(id: string, userId: string, comments?: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', id);
    }

    this.validateStatusTransition(vendor.status as VendorStatus, VendorStatus.APPROVED);

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: VendorStatus.APPROVED,
        approvedAt: new Date(),
        updatedBy: userId,
        rejectionReason: null,
      },
    });

    return this.sanitizeVendor(updated);
  }

  async reject(id: string, userId: string, reason: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', id);
    }

    this.validateStatusTransition(vendor.status as VendorStatus, VendorStatus.REJECTED);

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: VendorStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedBy: userId,
      },
    });

    return this.sanitizeVendor(updated);
  }

  async deactivate(id: string, userId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', id);
    }

    this.validateStatusTransition(vendor.status as VendorStatus, VendorStatus.INACTIVE);

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: VendorStatus.INACTIVE,
        updatedBy: userId,
      },
    });

    return this.sanitizeVendor(updated);
  }

  async terminate(id: string, userId: string, reason: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', id);
    }

    this.validateStatusTransition(vendor.status as VendorStatus, VendorStatus.TERMINATED);

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: VendorStatus.TERMINATED,
        terminatedAt: new Date(),
        terminationReason: reason,
        updatedBy: userId,
      },
    });

    return this.sanitizeVendor(updated);
  }

  async markForResubmission(id: string, userId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', id);
    }

    this.validateStatusTransition(vendor.status as VendorStatus, VendorStatus.PENDING_RESUBMISSION);

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: VendorStatus.PENDING_RESUBMISSION,
        updatedBy: userId,
      },
    });

    return this.sanitizeVendor(updated);
  }

  private validateStatusTransition(currentStatus: VendorStatus, newStatus: VendorStatus): void {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private sanitizeVendor<T extends { taxIdEncrypted?: string | null; taxId?: string | null }>(
    vendor: T
  ): Omit<T, 'taxIdEncrypted'> & { taxId: string | null } {
    const { taxIdEncrypted, ...rest } = vendor;
    return {
      ...rest,
      taxId: taxIdEncrypted ? encryptionService.maskSensitiveData(encryptionService.decrypt(taxIdEncrypted)) : null,
    };
  }
}

export const vendorService = new VendorService();
