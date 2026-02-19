import { z } from 'zod';
import { RiskTier } from '../../domain/enums';

export const createWorkflowConfigSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional(),
  riskTier: z.nativeEnum(RiskTier).optional(),
  steps: z.array(
    z.object({
      name: z.string().min(2).max(255),
      approverRoleId: z.string().uuid().optional(),
      approverUserId: z.string().uuid().optional(),
      slaHours: z.number().int().positive().default(48),
      isRequired: z.boolean().default(true),
    })
  ).min(1),
});

export const updateWorkflowConfigSchema = createWorkflowConfigSchema.partial();

export const approveStepSchema = z.object({
  comments: z.string().max(2000).optional(),
});

export const rejectStepSchema = z.object({
  reason: z.string().min(10).max(1000),
  comments: z.string().max(2000).optional(),
});

export const delegateApprovalSchema = z.object({
  toUserId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().max(500).optional(),
});

export const workflowQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
  assignedToMe: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateWorkflowConfigDto = z.infer<typeof createWorkflowConfigSchema>;
export type UpdateWorkflowConfigDto = z.infer<typeof updateWorkflowConfigSchema>;
export type ApproveStepDto = z.infer<typeof approveStepSchema>;
export type RejectStepDto = z.infer<typeof rejectStepSchema>;
export type DelegateApprovalDto = z.infer<typeof delegateApprovalSchema>;
export type WorkflowQueryDto = z.infer<typeof workflowQuerySchema>;
