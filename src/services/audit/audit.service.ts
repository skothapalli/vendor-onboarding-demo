import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { AuditAction } from '../../domain/enums';
import { hashChainService } from '../../utils/hash-chain';
import { AuditAccessScope, maskAuditFields } from '../../api/middlewares/audit-access.middleware';
import { AuditQueryDto, ComplianceAuditQueryDto } from '../../api/validators/audit.validator';

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  correlationId?: string;
}

export class AuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { hashCurrent: true },
    });

    const previousHash = lastLog?.hashCurrent || null;

    const hashEntry = hashChainService.createEntry(
      'audit',
      {
        ...entry,
        timestamp: new Date().toISOString(),
      },
      previousHash
    );

    await prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        userId: entry.userId,
        userEmail: entry.userEmail,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        before: entry.before as Prisma.InputJsonValue,
        after: entry.after as Prisma.InputJsonValue,
        changes: entry.changes as Prisma.InputJsonValue,
        correlationId: entry.correlationId,
        hashPrevious: previousHash,
        hashCurrent: hashEntry.currentHash,
      },
    });
  }

  async query(query: AuditQueryDto, scope?: AuditAccessScope) {
    const where: Prisma.AuditLogWhereInput = {};

    if (scope && scope.allowedEntityTypes.length > 0) {
      where.entityType = { in: scope.allowedEntityTypes };
    }

    if (scope && scope.allowedActions.length > 0) {
      where.action = { in: scope.allowedActions as AuditAction[] };
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = query.startDate;
      }
      if (query.endDate) {
        where.timestamp.lte = query.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: scope?.canViewUserDetails
          ? {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            }
          : undefined,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const maskedLogs = scope
      ? logs.map((log) => maskAuditFields(log as unknown as Record<string, unknown>, scope.excludedFields))
      : logs;

    return {
      data: maskedLogs,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async queryForCompliance(query: ComplianceAuditQueryDto, scope: AuditAccessScope) {
    const where: Prisma.AuditLogWhereInput = {
      entityType: { in: scope.allowedEntityTypes },
    };

    if (query.vendorId) {
      where.OR = [
        { entityId: query.vendorId, entityType: 'Vendor' },
        {
          entityType: { in: ['ComplianceItem', 'Document', 'OnboardingRequest'] },
        },
      ];
    }

    if (query.entityTypes && query.entityTypes.length > 0) {
      const allowedTypes = query.entityTypes.filter((t) =>
        scope.allowedEntityTypes.includes(t)
      );
      where.entityType = { in: allowedTypes };
    }

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = query.startDate;
      }
      if (query.endDate) {
        where.timestamp.lte = query.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const maskedLogs = logs.map((log) =>
      maskAuditFields(log as unknown as Record<string, unknown>, scope.excludedFields)
    );

    return {
      data: maskedLogs,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getEntityTrail(entityType: string, entityId: string, scope?: AuditAccessScope) {
    if (scope && scope.allowedEntityTypes.length > 0) {
      if (!scope.allowedEntityTypes.includes(entityType)) {
        return [];
      }
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { timestamp: 'desc' },
      include: scope?.canViewUserDetails
        ? {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          }
        : undefined,
    });

    return scope
      ? logs.map((log) => maskAuditFields(log as unknown as Record<string, unknown>, scope.excludedFields))
      : logs;
  }

  async verifyIntegrity(startDate: Date, endDate: Date) {
    const logs = await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        hashPrevious: true,
        hashCurrent: true,
        timestamp: true,
        entityType: true,
        entityId: true,
        action: true,
        before: true,
        after: true,
      },
    });

    const results: Array<{
      id: string;
      valid: boolean;
      timestamp: Date;
    }> = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      let valid = true;

      if (i > 0) {
        const previousLog = logs[i - 1];
        if (log.hashPrevious !== previousLog.hashCurrent) {
          valid = false;
        }
      }

      results.push({
        id: log.id,
        valid,
        timestamp: log.timestamp,
      });
    }

    const invalidEntries = results.filter((r) => !r.valid);

    return {
      totalChecked: logs.length,
      valid: invalidEntries.length === 0,
      invalidCount: invalidEntries.length,
      invalidEntries: invalidEntries.slice(0, 10),
      checkedRange: {
        start: startDate,
        end: endDate,
      },
    };
  }
}

export const auditService = new AuditService();
