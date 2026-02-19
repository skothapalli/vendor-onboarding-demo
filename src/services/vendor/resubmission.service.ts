import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors';
import { VendorStatus, ResubmissionStatus } from '../../domain/enums';
import { config } from '../../config';
import { SubmitResubmissionDto } from '../../api/validators/resubmission.validator';

export interface ResubmissionEligibility {
  eligible: boolean;
  reason?: string;
  attemptsUsed: number;
  maxAttempts: number;
  cooldownEndsAt?: Date;
}

export class ResubmissionService {
  async checkEligibility(vendorId: string): Promise<ResubmissionEligibility> {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', vendorId);
    }

    if (vendor.status !== VendorStatus.REJECTED && vendor.status !== VendorStatus.PENDING_RESUBMISSION) {
      return {
        eligible: false,
        reason: 'Vendor must be in REJECTED or PENDING_RESUBMISSION status',
        attemptsUsed: 0,
        maxAttempts: config.resubmission.maxAttempts,
      };
    }

    const resubmissionCount = await prisma.resubmissionRequest.count({
      where: { vendorId },
    });

    if (resubmissionCount >= config.resubmission.maxAttempts) {
      return {
        eligible: false,
        reason: 'Maximum resubmission attempts exceeded',
        attemptsUsed: resubmissionCount,
        maxAttempts: config.resubmission.maxAttempts,
      };
    }

    const lastResubmission = await prisma.resubmissionRequest.findFirst({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });

    if (lastResubmission) {
      const cooldownEnd = new Date(lastResubmission.createdAt);
      cooldownEnd.setDate(cooldownEnd.getDate() + config.resubmission.cooldownDays);

      if (cooldownEnd > new Date()) {
        return {
          eligible: false,
          reason: 'Cooldown period has not elapsed',
          attemptsUsed: resubmissionCount,
          maxAttempts: config.resubmission.maxAttempts,
          cooldownEndsAt: cooldownEnd,
        };
      }
    }

    return {
      eligible: true,
      attemptsUsed: resubmissionCount,
      maxAttempts: config.resubmission.maxAttempts,
    };
  }

  async initiate(vendorId: string, userId: string) {
    const eligibility = await this.checkEligibility(vendorId);

    if (!eligibility.eligible) {
      throw new ValidationError(eligibility.reason || 'Not eligible for resubmission');
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', vendorId);
    }

    const existingDraft = await prisma.resubmissionRequest.findFirst({
      where: {
        vendorId,
        status: ResubmissionStatus.DRAFT,
      },
    });

    if (existingDraft) {
      throw new ConflictError('A draft resubmission already exists');
    }

    const resubmission = await prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: vendorId },
        data: { status: VendorStatus.PENDING_RESUBMISSION },
      });

      return tx.resubmissionRequest.create({
        data: {
          vendorId,
          rejectionReason: vendor.rejectionReason,
          previousSubmissionCount: eligibility.attemptsUsed,
          status: ResubmissionStatus.DRAFT,
        },
      });
    });

    return {
      id: resubmission.id,
      vendorId: resubmission.vendorId,
      originalRejectionReason: resubmission.rejectionReason,
      attemptsRemaining: config.resubmission.maxAttempts - eligibility.attemptsUsed - 1,
      status: resubmission.status,
    };
  }

  async submit(resubmissionId: string, dto: SubmitResubmissionDto, userId: string) {
    const resubmission = await prisma.resubmissionRequest.findUnique({
      where: { id: resubmissionId },
      include: { vendor: true },
    });

    if (!resubmission) {
      throw new NotFoundError('Resubmission Request', resubmissionId);
    }

    if (resubmission.status !== ResubmissionStatus.DRAFT) {
      throw new ValidationError('Resubmission can only be submitted from DRAFT status');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedResubmission = await tx.resubmissionRequest.update({
        where: { id: resubmissionId },
        data: {
          resubmissionJustification: dto.justification,
          changesDescription: dto.changesDescription,
          updatedFields: dto.updatedFields,
          status: ResubmissionStatus.SUBMITTED,
          submittedAt: new Date(),
          submittedBy: userId,
        },
      });

      await tx.vendor.update({
        where: { id: resubmission.vendorId },
        data: {
          status: VendorStatus.RESUBMITTED,
          updatedBy: userId,
        },
      });

      await tx.onboardingRequest.create({
        data: {
          vendorId: resubmission.vendorId,
          status: 'PENDING',
          submittedAt: new Date(),
          submittedBy: userId,
        },
      });

      return updatedResubmission;
    });

    return updated;
  }

  async getHistory(vendorId: string) {
    const resubmissions = await prisma.resubmissionRequest.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });

    return resubmissions;
  }

  async getById(resubmissionId: string) {
    const resubmission = await prisma.resubmissionRequest.findUnique({
      where: { id: resubmissionId },
      include: { vendor: true },
    });

    if (!resubmission) {
      throw new NotFoundError('Resubmission Request', resubmissionId);
    }

    return resubmission;
  }

  async cancel(resubmissionId: string, userId: string) {
    const resubmission = await prisma.resubmissionRequest.findUnique({
      where: { id: resubmissionId },
    });

    if (!resubmission) {
      throw new NotFoundError('Resubmission Request', resubmissionId);
    }

    if (resubmission.status !== ResubmissionStatus.DRAFT) {
      throw new ValidationError('Only draft resubmissions can be cancelled');
    }

    await prisma.$transaction(async (tx) => {
      await tx.resubmissionRequest.delete({
        where: { id: resubmissionId },
      });

      await tx.vendor.update({
        where: { id: resubmission.vendorId },
        data: { status: VendorStatus.REJECTED },
      });
    });
  }

  async review(resubmissionId: string, approved: boolean, reviewerId: string, notes?: string) {
    const resubmission = await prisma.resubmissionRequest.findUnique({
      where: { id: resubmissionId },
    });

    if (!resubmission) {
      throw new NotFoundError('Resubmission Request', resubmissionId);
    }

    if (resubmission.status !== ResubmissionStatus.SUBMITTED) {
      throw new ValidationError('Resubmission must be in SUBMITTED status to review');
    }

    const newStatus = approved ? ResubmissionStatus.ACCEPTED : ResubmissionStatus.REJECTED_FINAL;
    const vendorStatus = approved ? VendorStatus.UNDER_REVIEW : VendorStatus.REJECTED;

    await prisma.$transaction(async (tx) => {
      await tx.resubmissionRequest.update({
        where: { id: resubmissionId },
        data: {
          status: newStatus,
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          reviewNotes: notes,
        },
      });

      await tx.vendor.update({
        where: { id: resubmission.vendorId },
        data: {
          status: vendorStatus,
          updatedBy: reviewerId,
        },
      });
    });
  }
}

export const resubmissionService = new ResubmissionService();
