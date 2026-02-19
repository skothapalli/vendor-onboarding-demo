import { Response } from 'express';
import { vendorService } from '../../services/vendor/vendor.service';
import { resubmissionService } from '../../services/vendor/resubmission.service';
import { auditService } from '../../services/audit/audit.service';
import { AuditAction } from '../../domain/enums';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  CreateVendorDto,
  UpdateVendorDto,
  VendorQueryDto,
  RejectVendorDto,
  TerminateVendorDto,
} from '../validators/vendor.validator';
import { SubmitResubmissionDto } from '../validators/resubmission.validator';

export class VendorController {
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dto = req.body as CreateVendorDto;
    const vendor = await vendorService.create(dto, req.user.userId);

    await auditService.log({
      entityType: 'Vendor',
      entityId: vendor.id,
      action: AuditAction.CREATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { legalName: vendor.legalName, status: vendor.status },
    });

    res.status(201).json({
      success: true,
      data: vendor,
    });
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const dto = req.body as UpdateVendorDto;

    const before = await vendorService.getById(id);
    const vendor = await vendorService.update(id, dto, req.user.userId);

    await auditService.log({
      entityType: 'Vendor',
      entityId: id,
      action: AuditAction.UPDATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      before: { legalName: before.legalName },
      after: { legalName: vendor.legalName },
    });

    res.json({
      success: true,
      data: vendor,
    });
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const vendor = await vendorService.getById(id);

    res.json({
      success: true,
      data: vendor,
    });
  }

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const query = req.query as unknown as VendorQueryDto;
    const result = await vendorService.list(query);

    res.json({
      success: true,
      ...result,
    });
  }

  async submit(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const vendor = await vendorService.submit(id, req.user.userId);

    await auditService.log({
      entityType: 'Vendor',
      entityId: id,
      action: AuditAction.SUBMIT,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { status: vendor.status },
    });

    res.json({
      success: true,
      data: vendor,
    });
  }

  async approve(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { comments } = req.body;
    const vendor = await vendorService.approve(id, req.user.userId, comments);

    await auditService.log({
      entityType: 'Vendor',
      entityId: id,
      action: AuditAction.APPROVE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { status: vendor.status },
    });

    res.json({
      success: true,
      data: vendor,
    });
  }

  async reject(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const dto = req.body as RejectVendorDto;
    const vendor = await vendorService.reject(id, req.user.userId, dto.reason);

    await auditService.log({
      entityType: 'Vendor',
      entityId: id,
      action: AuditAction.REJECT,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { status: vendor.status, rejectionReason: dto.reason },
    });

    res.json({
      success: true,
      data: vendor,
    });
  }

  async deactivate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const vendor = await vendorService.deactivate(id, req.user.userId);

    await auditService.log({
      entityType: 'Vendor',
      entityId: id,
      action: AuditAction.UPDATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { status: vendor.status },
    });

    res.json({
      success: true,
      data: vendor,
    });
  }

  async terminate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const dto = req.body as TerminateVendorDto;
    const vendor = await vendorService.terminate(id, req.user.userId, dto.reason);

    await auditService.log({
      entityType: 'Vendor',
      entityId: id,
      action: AuditAction.DELETE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { status: vendor.status, terminationReason: dto.reason },
    });

    res.json({
      success: true,
      data: vendor,
    });
  }

  async initiateResubmission(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await resubmissionService.initiate(id, req.user.userId);

    await auditService.log({
      entityType: 'ResubmissionRequest',
      entityId: result.id,
      action: AuditAction.CREATE,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { vendorId: id, status: result.status },
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  }

  async submitResubmission(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id, resubmissionId } = req.params;
    const dto = req.body as SubmitResubmissionDto;
    const result = await resubmissionService.submit(resubmissionId, dto, req.user.userId);

    await auditService.log({
      entityType: 'ResubmissionRequest',
      entityId: resubmissionId,
      action: AuditAction.SUBMIT,
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: req.ip,
      correlationId: req.correlationId,
      after: { vendorId: id, status: result.status },
    });

    res.json({
      success: true,
      data: result,
    });
  }

  async getResubmissionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const history = await resubmissionService.getHistory(id);

    res.json({
      success: true,
      data: history,
    });
  }

  async getResubmissionEligibility(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const eligibility = await resubmissionService.checkEligibility(id);

    res.json({
      success: true,
      data: eligibility,
    });
  }

  async cancelResubmission(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { resubmissionId } = req.params;
    await resubmissionService.cancel(resubmissionId, req.user.userId);

    res.json({
      success: true,
      message: 'Resubmission cancelled',
    });
  }
}

export const vendorController = new VendorController();
