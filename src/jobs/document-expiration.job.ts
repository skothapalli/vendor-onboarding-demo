import { prisma } from '../infrastructure/database/prisma';
import { logger } from '../utils/logger';
import { DocumentStatus } from '../domain/enums';

export async function runDocumentExpirationJob(): Promise<void> {
  const jobLogger = logger.child({ job: 'document-expiration' });
  jobLogger.info('Starting document expiration job');

  try {
    // Mark expired documents
    const expiredDocs = await prisma.document.updateMany({
      where: {
        status: {
          in: ['UPLOADED', 'VERIFIED'],
        },
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: DocumentStatus.EXPIRED,
      },
    });

    jobLogger.info({ count: expiredDocs.count }, 'Marked documents as expired');

    // Find documents expiring in the next 30 days
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 30);

    const expiringDocs = await prisma.document.findMany({
      where: {
        status: {
          in: ['UPLOADED', 'VERIFIED'],
        },
        expiresAt: {
          gte: new Date(),
          lte: warningDate,
        },
      },
      include: {
        vendor: {
          select: {
            id: true,
            legalName: true,
            createdBy: true,
          },
        },
      },
    });

    jobLogger.info({ count: expiringDocs.length }, 'Found documents expiring soon');

    const notificationsByUser = new Map<string, typeof expiringDocs>();

    for (const doc of expiringDocs) {
      const userId = doc.vendor.createdBy;
      if (!notificationsByUser.has(userId)) {
        notificationsByUser.set(userId, []);
      }
      notificationsByUser.get(userId)!.push(doc);
    }

    for (const [userId, docs] of notificationsByUser) {
      const documentList = docs
        .map((d) => `- ${d.originalName} (${d.vendor.legalName}) - Expires: ${d.expiresAt?.toLocaleDateString()}`)
        .join('\n');

      await prisma.notification.create({
        data: {
          userId,
          channel: 'IN_APP',
          subject: `${docs.length} Document(s) Expiring Soon`,
          body: `The following documents are expiring within 30 days:\n\n${documentList}`,
          status: 'PENDING',
          metadata: {
            type: 'DOCUMENT_EXPIRATION_WARNING',
            documentIds: docs.map((d) => d.id),
          },
        },
      });

      jobLogger.info({ userId, documentCount: docs.length }, 'Created expiration warning notification');
    }

    jobLogger.info('Document expiration job completed');
  } catch (error) {
    jobLogger.error({ error }, 'Document expiration job failed');
    throw error;
  }
}
