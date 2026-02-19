import { z } from 'zod';
import { ComplianceItemStatus, RiskTier } from '../../domain/enums';

export const createComplianceTemplateSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional(),
  riskTier: z.nativeEnum(RiskTier).optional(),
  items: z.array(
    z.object({
      name: z.string().min(2).max(255),
      description: z.string().max(1000).optional(),
      isRequired: z.boolean().default(true),
      documentRequired: z.boolean().default(false),
    })
  ).min(1),
});

export const updateComplianceTemplateSchema = createComplianceTemplateSchema.partial();

export const assignComplianceSchema = z.object({
  templateId: z.string().uuid(),
  dueDate: z.coerce.date().optional(),
});

export const updateComplianceItemSchema = z.object({
  status: z.nativeEnum(ComplianceItemStatus),
  notes: z.string().max(2000).optional(),
});

export const complianceQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  status: z.nativeEnum(ComplianceItemStatus).optional(),
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateComplianceTemplateDto = z.infer<typeof createComplianceTemplateSchema>;
export type UpdateComplianceTemplateDto = z.infer<typeof updateComplianceTemplateSchema>;
export type AssignComplianceDto = z.infer<typeof assignComplianceSchema>;
export type UpdateComplianceItemDto = z.infer<typeof updateComplianceItemSchema>;
export type ComplianceQueryDto = z.infer<typeof complianceQuerySchema>;
