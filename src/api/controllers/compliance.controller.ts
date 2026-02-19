import { Response } from 'express';
import { complianceService } from '../../services/compliance/compliance.service';
import { auditService } from '../../services/audit/audit.service';
import { AuditAction } from '../../domain/enums';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  CreateComplianceTemplateDto,
  AssignComplianceDto,
  UpdateComplianceItemDto,
  ComplianceQueryDto,
} from '../validators/compliance.validator';

export class ComplianceController {
  async createTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as CreateComplianceTemplateDto;
    const template = await complianceService.createTemplate(dto, req.user.userId);

    await auditService.log({
      entityType: 'ComplianceTemplate',
      entityId: template.id,
      action: AuditAction.CREATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { name: template.name, itemCount: template.items.length },
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  }

  async getTemplateById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const template = await complianceService.getTemplateById(id);

    res.json({
      success: true,
      data: template,
    });
  }

  async listTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { categoryId, riskTier } = req.query;
    const templates = await complianceService.listTemplates(
      categoryId as string | undefined,
      riskTier as string | undefined
    );

    res.json({
      success: true,
      data: templates,
    });
  }

  async assignToVendor(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { vendorId } = req.params;
    const dto = req.body as AssignComplianceDto;
    const items = await complianceService.assignToVendor(vendorId, dto, req.user.userId);

    await auditService.log({
      entityType: 'ComplianceChecklist',
      entityId: vendorId,
      action: AuditAction.CREATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { vendorId, templateId: dto.templateId, itemCount: items.length },
    });

    res.status(201).json({
      success: true,
      data: items,
    });
  }

  async getVendorCompliance(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { vendorId } = req.params;
    const compliance = await complianceService.getVendorCompliance(vendorId);

    res.json({
      success: true,
      data: compliance,
    });
  }

  async updateItemStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const dto = req.body as UpdateComplianceItemDto;

    const before = await complianceService.getItemById(id);
    const item = await complianceService.updateItemStatus(id, dto, req.user.userId);

    await auditService.log({
      entityType: 'ComplianceItem',
      entityId: id,
      action: AuditAction.UPDATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      before: { status: before.status },
      after: { status: item.status },
    });

    res.json({
      success: true,
      data: item,
    });
  }

  async getItemById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const item = await complianceService.getItemById(id);

    res.json({
      success: true,
      data: item,
    });
  }

  async listItems(req: AuthenticatedRequest, res: Response): Promise<void> {
    const query = req.query as unknown as ComplianceQueryDto;
    const result = await complianceService.listItems(query);

    res.json({
      success: true,
      ...result,
    });
  }
}

export const complianceController = new ComplianceController();
