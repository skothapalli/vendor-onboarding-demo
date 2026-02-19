import { prisma } from '../infrastructure/database/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function runApprovalReminderJob(): Promise<void> {
  const jobLogger = logger.child({ job: 'approval-reminder' });
  jobLogger.info('Starting approval reminder job');

  try {
    const slaThreshold = new Date();
    slaThreshold.setHours(slaThreshold.getHours() + 24);

    const pendingSteps = await prisma.workflowStep.findMany({
      where: {
        status: 'PENDING',
        dueAt: {
          lte: slaThreshold,
          gte: new Date(),
        },
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
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    jobLogger.info({ count: pendingSteps.length }, 'Found pending steps approaching SLA');

    for (const step of pendingSteps) {
      if (!step.approver) {
        jobLogger.warn({ stepId: step.id }, 'Step has no assigned approver');
        continue;
      }

      await prisma.notification.create({
        data: {
          userId: step.approver.id,
          channel: 'IN_APP',
          subject: 'Approval Reminder: SLA Approaching',
          body: `Your approval is required for vendor "${step.request.vendor.legalName}". SLA deadline: ${step.dueAt?.toISOString()}`,
          status: 'PENDING',
          metadata: {
            type: 'APPROVAL_REMINDER',
            stepId: step.id,
            vendorId: step.request.vendor.id,
            dueAt: step.dueAt?.toISOString(),
          },
        },
      });

      jobLogger.info(
        { stepId: step.id, approverId: step.approver.id },
        'Created reminder notification'
      );
    }

    jobLogger.info('Approval reminder job completed');
  } catch (error) {
    jobLogger.error({ error }, 'Approval reminder job failed');
    throw error;
  }
}
