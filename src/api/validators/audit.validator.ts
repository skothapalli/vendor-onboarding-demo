import { z } from 'zod';
import { AuditAction } from '../../domain/enums';

export const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const complianceAuditQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  entityTypes: z.array(z.string()).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const verifyIntegritySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type AuditQueryDto = z.infer<typeof auditQuerySchema>;
export type ComplianceAuditQueryDto = z.infer<typeof complianceAuditQuerySchema>;
export type VerifyIntegrityDto = z.infer<typeof verifyIntegritySchema>;
