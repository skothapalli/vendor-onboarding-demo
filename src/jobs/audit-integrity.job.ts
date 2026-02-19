import { prisma } from '../infrastructure/database/prisma';
import { logger } from '../utils/logger';
import { auditService } from '../services/audit/audit.service';

export async function runAuditIntegrityJob(): Promise<void> {
  const jobLogger = logger.child({ job: 'audit-integrity' });
  jobLogger.info('Starting audit integrity verification job');

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    const result = await auditService.verifyIntegrity(startDate, endDate);

    if (!result.valid) {
      jobLogger.error(
        {
          invalidCount: result.invalidCount,
          invalidEntries: result.invalidEntries,
        },
        'Audit integrity check FAILED - hash chain broken'
      );

      const admins = await prisma.user.findMany({
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
        await prisma.notification.create({
          data: {
            userId: admin.id,
            channel: 'IN_APP',
            subject: 'CRITICAL: Audit Log Integrity Failure',
            body: `Audit log integrity check failed. ${result.invalidCount} entries have broken hash chain. Immediate investigation required.`,
            status: 'PENDING',
            metadata: {
              type: 'AUDIT_INTEGRITY_FAILURE',
              invalidCount: result.invalidCount,
              checkedRange: result.checkedRange,
            },
          },
        });
      }
    } else {
      jobLogger.info(
        { totalChecked: result.totalChecked },
        'Audit integrity check passed'
      );
    }

    await prisma.systemConfig.upsert({
      where: { key: 'audit_integrity_last_check' },
      update: {
        value: {
          timestamp: new Date().toISOString(),
          valid: result.valid,
          totalChecked: result.totalChecked,
          invalidCount: result.invalidCount,
        },
      },
      create: {
        key: 'audit_integrity_last_check',
        category: 'audit',
        value: {
          timestamp: new Date().toISOString(),
          valid: result.valid,
          totalChecked: result.totalChecked,
          invalidCount: result.invalidCount,
        },
      },
    });

    jobLogger.info('Audit integrity verification job completed');
  } catch (error) {
    jobLogger.error({ error }, 'Audit integrity verification job failed');
    throw error;
  }
}
