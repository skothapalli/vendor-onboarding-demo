import { Response } from 'express';
import { workflowService } from '../../services/workflow/workflow.service';
import { auditService } from '../../services/audit/audit.service';
import { AuditAction } from '../../domain/enums';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  CreateWorkflowConfigDto,
  ApproveStepDto,
  RejectStepDto,
  DelegateApprovalDto,
  WorkflowQueryDto,
} from '../validators/workflow.validator';

export class WorkflowController {
  async createConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as CreateWorkflowConfigDto;
    const config = await workflowService.createConfig(dto);

    await auditService.log({
      entityType: 'WorkflowConfig',
      entityId: config.id,
      action: AuditAction.CREATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { name: config.name, stepCount: config.steps.length },
    });

    res.status(201).json({
      success: true,
      data: config,
    });
  }

  async getConfigById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const config = await workflowService.getConfigById(id);

    res.json({
      success: true,
      data: config,
    });
  }

  async listConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
    const configs = await workflowService.listConfigs();

    res.json({
      success: true,
      data: configs,
    });
  }

  async getPendingApprovals(req: AuthenticatedRequest, res: Response): Promise<void> {
    const query = req.query as unknown as WorkflowQueryDto;
    const result = await workflowService.getPendingApprovals(req.user.userId, query);

    res.json({
      success: true,
      ...result,
    });
  }

  async approve(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const dto = req.body as ApproveStepDto;
    const step = await workflowService.approve(id, req.user.userId, dto.comments);

    await auditService.log({
      entityType: 'WorkflowStep',
      entityId: id,
      action: AuditAction.APPROVE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { status: step.status, requestId: step.requestId },
    });

    res.json({
      success: true,
      data: step,
    });
  }

  async reject(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const dto = req.body as RejectStepDto;
    const step = await workflowService.reject(id, req.user.userId, dto.reason, dto.comments);

    await auditService.log({
      entityType: 'WorkflowStep',
      entityId: id,
      action: AuditAction.REJECT,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { status: step.status, reason: dto.reason },
    });

    res.json({
      success: true,
      data: step,
    });
  }

  async delegate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as DelegateApprovalDto;
    const delegation = await workflowService.delegate(dto, req.user.userId);

    await auditService.log({
      entityType: 'ApprovalDelegation',
      entityId: delegation.id,
      action: AuditAction.DELEGATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: {
        toUserId: dto.toUserId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });

    res.status(201).json({
      success: true,
      data: delegation,
    });
  }

  async revokeDelegation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    await workflowService.revokeDelegation(id, req.user.userId);

    await auditService.log({
      entityType: 'ApprovalDelegation',
      entityId: id,
      action: AuditAction.DELETE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      message: 'Delegation revoked',
    });
  }

  async getStepById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const step = await workflowService.getStepById(id);

    res.json({
      success: true,
      data: step,
    });
  }
}

export const workflowController = new WorkflowController();
