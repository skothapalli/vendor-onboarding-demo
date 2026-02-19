import { prisma } from '../infrastructure/database/prisma';
import { logger } from '../utils/logger';
import { WorkflowStepStatus } from '../domain/enums';

export async function runApprovalEscalationJob(): Promise<void> {
  const jobLogger = logger.child({ job: 'approval-escalation' });
  jobLogger.info('Starting approval escalation job');

  try {
    const overdueSteps = await prisma.workflowStep.findMany({
      where: {
        status: 'PENDING',
        dueAt: {
          lt: new Date(),
        },
        escalatedAt: null,
      },
      include: {
        request: {
          include: {
            vendor: {
              select: {
                id: true,
                legalName: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    jobLogger.info({ count: overdueSteps.length }, 'Found overdue steps to escalate');

    for (const step of overdueSteps) {
      await prisma.$transaction(async (tx) => {
        await tx.workflowStep.update({
          where: { id: step.id },
          data: {
            status: WorkflowStepStatus.ESCALATED,
            escalatedAt: new Date(),
          },
        });

        const admins = await tx.user.findMany({
          where: {
            roles: {
              some: {
                role: {
                  name: 'ADMIN',
                },
              },
            },
            isActive: true,
          },
          select: { id: true },
        });

        for (const admin of admins) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              channel: 'IN_APP',
              subject: 'Escalation: Overdue Approval',
              body: `Approval for vendor "${step.request.vendor.legalName}" is overdue and has been escalated. Original approver: ${step.approver?.email || 'Unassigned'}`,
              status: 'PENDING',
              metadata: {
                type: 'ESCALATION',
                stepId: step.id,
                vendorId: step.request.vendor.id,
                originalApproverId: step.approver?.id,
              },
            },
          });
        }
      });

      jobLogger.info({ stepId: step.id }, 'Escalated overdue step');
    }

    jobLogger.info('Approval escalation job completed');
  } catch (error) {
    jobLogger.error({ error }, 'Approval escalation job failed');
    throw error;
  }
}
