import { Response } from 'express';
import { auditService } from '../../services/audit/audit.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AuditAccessScope } from '../middlewares/audit-access.middleware';
import { AuditQueryDto, ComplianceAuditQueryDto, VerifyIntegrityDto } from '../validators/audit.validator';

type AuditRequest = AuthenticatedRequest & { auditScope: AuditAccessScope };

export class AuditController {
  async getAuditTrail(req: AuditRequest, res: Response): Promise<void> {
    const query = req.query as unknown as AuditQueryDto;
    const result = await auditService.query(query, req.auditScope);

    res.json({
      success: true,
      ...result,
    });
  }

  async getEntityTrail(req: AuditRequest, res: Response): Promise<void> {
    const { entityType, entityId } = req.params;
    const trail = await auditService.getEntityTrail(entityType, entityId, req.auditScope);

    res.json({
      success: true,
      data: trail,
    });
  }

  async getComplianceAuditTrail(req: AuditRequest, res: Response): Promise<void> {
    const query = req.query as unknown as ComplianceAuditQueryDto;
    const result = await auditService.queryForCompliance(query, req.auditScope);

    res.json({
      success: true,
      ...result,
    });
  }

  async getVendorComplianceAudit(req: AuditRequest, res: Response): Promise<void> {
    const { vendorId } = req.params;
    const query: ComplianceAuditQueryDto = {
      vendorId,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await auditService.queryForCompliance(query, req.auditScope);

    res.json({
      success: true,
      ...result,
    });
  }

  async verifyIntegrity(req: AuditRequest, res: Response): Promise<void> {
    const dto = req.body as VerifyIntegrityDto;
    const result = await auditService.verifyIntegrity(dto.startDate, dto.endDate);

    res.json({
      success: true,
      data: result,
    });
  }
}

export const auditController = new AuditController();
