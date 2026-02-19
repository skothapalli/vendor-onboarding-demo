import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';
import { WorkflowStatus, WorkflowStepStatus } from '../../domain/enums';
import { config } from '../../config';
import {
  CreateWorkflowConfigDto,
  DelegateApprovalDto,
  WorkflowQueryDto,
} from '../../api/validators/workflow.validator';

export class WorkflowService {
  async createConfig(dto: CreateWorkflowConfigDto) {
    const workflowConfig = await prisma.workflowConfig.create({
      data: {
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        riskTier: dto.riskTier,
        steps: {
          create: dto.steps.map((step, index) => ({
            stepOrder: index + 1,
            name: step.name,
            approverRoleId: step.approverRoleId,
            approverUserId: step.approverUserId,
            slaHours: step.slaHours,
            isRequired: step.isRequired,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    return workflowConfig;
  }

  async getConfigById(id: string) {
    const config = await prisma.workflowConfig.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!config) {
      throw new NotFoundError('Workflow Config', id);
    }

    return config;
  }

  async listConfigs() {
    return prisma.workflowConfig.findMany({
      where: { isActive: true },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async initializeWorkflow(requestId: string, configId: string) {
    const workflowConfig = await this.getConfigById(configId);

    const steps = await prisma.$transaction(
      workflowConfig.steps.map((configStep) => {
        const dueAt = new Date();
        dueAt.setHours(dueAt.getHours() + configStep.slaHours);

        return prisma.workflowStep.create({
          data: {
            requestId,
            stepOrder: configStep.stepOrder,
            name: configStep.name,
            status: configStep.stepOrder === 1 ? WorkflowStepStatus.PENDING : WorkflowStepStatus.PENDING,
            dueAt,
          },
        });
      })
    );

    await prisma.onboardingRequest.update({
      where: { id: requestId },
      data: {
        currentStepId: steps[0]?.id,
        status: WorkflowStatus.IN_PROGRESS,
      },
    });

    return steps;
  }

  async getPendingApprovals(userId: string, query: WorkflowQueryDto) {
    const delegations = await prisma.approvalDelegation.findMany({
      where: {
        toUserId: userId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    const delegatedFromUserIds = delegations.map((d) => d.fromUserId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const userRoleIds = user?.roles.map((ur) => ur.roleId) || [];

    const where: Prisma.WorkflowStepWhereInput = {
      status: WorkflowStepStatus.PENDING,
      OR: [
        { approverId: userId },
        { approverId: { in: delegatedFromUserIds } },
      ],
    };

    const [steps, total] = await Promise.all([
      prisma.workflowStep.findMany({
        where,
        include: {
          request: {
            include: {
              vendor: {
                select: {
                  id: true,
                  legalName: true,
                  status: true,
                  riskTier: true,
                },
              },
            },
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { dueAt: 'asc' },
      }),
      prisma.workflowStep.count({ where }),
    ]);

    return {
      data: steps,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async approve(stepId: string, userId: string, comments?: string) {
    const step = await this.getStepWithAuthorization(stepId, userId);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedStep = await tx.workflowStep.update({
        where: { id: stepId },
        data: {
          status: WorkflowStepStatus.APPROVED,
          approverId: userId,
          action: 'APPROVED',
          actionAt: new Date(),
          comments,
        },
      });

      const nextStep = await tx.workflowStep.findFirst({
        where: {
          requestId: step.requestId,
          stepOrder: step.stepOrder + 1,
        },
      });

      if (nextStep) {
        await tx.onboardingRequest.update({
          where: { id: step.requestId },
          data: { currentStepId: nextStep.id },
        });
      } else {
        await tx.onboardingRequest.update({
          where: { id: step.requestId },
          data: {
            status: WorkflowStatus.APPROVED,
            completedAt: new Date(),
          },
        });

        const request = await tx.onboardingRequest.findUnique({
          where: { id: step.requestId },
        });

        if (request) {
          await tx.vendor.update({
            where: { id: request.vendorId },
            data: {
              status: 'APPROVED',
              approvedAt: new Date(),
              updatedBy: userId,
            },
          });
        }
      }

      return updatedStep;
    });

    return updated;
  }

  async reject(stepId: string, userId: string, reason: string, comments?: string) {
    const step = await this.getStepWithAuthorization(stepId, userId);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedStep = await tx.workflowStep.update({
        where: { id: stepId },
        data: {
          status: WorkflowStepStatus.REJECTED,
          approverId: userId,
          action: 'REJECTED',
          actionAt: new Date(),
          comments: `${reason}${comments ? `\n\n${comments}` : ''}`,
        },
      });

      await tx.onboardingRequest.update({
        where: { id: step.requestId },
        data: {
          status: WorkflowStatus.REJECTED,
          completedAt: new Date(),
        },
      });

      const request = await tx.onboardingRequest.findUnique({
        where: { id: step.requestId },
      });

      if (request) {
        await tx.vendor.update({
          where: { id: request.vendorId },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason: reason,
            updatedBy: userId,
          },
        });
      }

      return updatedStep;
    });

    return updated;
  }

  async delegate(dto: DelegateApprovalDto, fromUserId: string) {
    if (dto.startDate >= dto.endDate) {
      throw new ValidationError('End date must be after start date');
    }

    const toUser = await prisma.user.findUnique({
      where: { id: dto.toUserId },
    });

    if (!toUser || !toUser.isActive) {
      throw new NotFoundError('User', dto.toUserId);
    }

    const existingDelegation = await prisma.approvalDelegation.findFirst({
      where: {
        fromUserId,
        isActive: true,
        OR: [
          {
            startDate: { lte: dto.endDate },
            endDate: { gte: dto.startDate },
          },
        ],
      },
    });

    if (existingDelegation) {
      throw new ValidationError('An active delegation already exists for the specified period');
    }

    const delegation = await prisma.approvalDelegation.create({
      data: {
        fromUserId,
        toUserId: dto.toUserId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason,
        isActive: true,
      },
      include: {
        toUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return delegation;
  }

  async revokeDelegation(delegationId: string, userId: string) {
    const delegation = await prisma.approvalDelegation.findUnique({
      where: { id: delegationId },
    });

    if (!delegation) {
      throw new NotFoundError('Approval Delegation', delegationId);
    }

    if (delegation.fromUserId !== userId) {
      throw new ForbiddenError('Cannot revoke another user\'s delegation');
    }

    return prisma.approvalDelegation.update({
      where: { id: delegationId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });
  }

  async getStepById(stepId: string) {
    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: {
        request: {
          include: {
            vendor: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!step) {
      throw new NotFoundError('Workflow Step', stepId);
    }

    return step;
  }

  private async getStepWithAuthorization(stepId: string, userId: string) {
    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: {
        request: true,
      },
    });

    if (!step) {
      throw new NotFoundError('Workflow Step', stepId);
    }

    if (step.status !== WorkflowStepStatus.PENDING) {
      throw new ValidationError('Step has already been processed');
    }

    const canApprove = await this.canUserApproveStep(step, userId);

    if (!canApprove) {
      throw new ForbiddenError('Not authorized to approve this step');
    }

    return step;
  }

  private async canUserApproveStep(
    step: { approverId: string | null; requestId: string },
    userId: string
  ): Promise<boolean> {
    if (step.approverId === userId) {
      return true;
    }

    const delegation = await prisma.approvalDelegation.findFirst({
      where: {
        fromUserId: step.approverId || undefined,
        toUserId: userId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    return !!delegation;
  }
}

export const workflowService = new WorkflowService();
