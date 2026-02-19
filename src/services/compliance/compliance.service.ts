import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { ComplianceItemStatus } from '../../domain/enums';
import {
  CreateComplianceTemplateDto,
  AssignComplianceDto,
  UpdateComplianceItemDto,
  ComplianceQueryDto,
} from '../../api/validators/compliance.validator';

export class ComplianceService {
  async createTemplate(dto: CreateComplianceTemplateDto, userId: string) {
    const template = await prisma.complianceTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        riskTier: dto.riskTier,
        items: {
          create: dto.items.map((item, index) => ({
            name: item.name,
            description: item.description,
            itemOrder: index + 1,
            isRequired: item.isRequired,
            documentRequired: item.documentRequired,
          })),
        },
      },
      include: {
        items: {
          orderBy: { itemOrder: 'asc' },
        },
      },
    });

    return template;
  }

  async getTemplateById(id: string) {
    const template = await prisma.complianceTemplate.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { itemOrder: 'asc' },
        },
        category: true,
      },
    });

    if (!template) {
      throw new NotFoundError('Compliance Template', id);
    }

    return template;
  }

  async listTemplates(categoryId?: string, riskTier?: string) {
    const where: Prisma.ComplianceTemplateWhereInput = {
      isActive: true,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (riskTier) {
      where.riskTier = riskTier as Prisma.EnumRiskTierFilter;
    }

    return prisma.complianceTemplate.findMany({
      where,
      include: {
        items: {
          orderBy: { itemOrder: 'asc' },
        },
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async assignToVendor(vendorId: string, dto: AssignComplianceDto, userId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', vendorId);
    }

    const template = await prisma.complianceTemplate.findUnique({
      where: { id: dto.templateId },
      include: {
        items: {
          orderBy: { itemOrder: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundError('Compliance Template', dto.templateId);
    }

    const existingItems = await prisma.complianceItem.findMany({
      where: { vendorId },
    });

    if (existingItems.length > 0) {
      throw new ValidationError('Vendor already has compliance items assigned');
    }

    const complianceItems = await prisma.$transaction(
      template.items.map((item) =>
        prisma.complianceItem.create({
          data: {
            vendorId,
            templateItemId: item.id,
            name: item.name,
            description: item.description,
            status: ComplianceItemStatus.PENDING,
            dueDate: dto.dueDate,
          },
        })
      )
    );

    return complianceItems;
  }

  async getVendorCompliance(vendorId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundError('Vendor', vendorId);
    }

    const items = await prisma.complianceItem.findMany({
      where: { vendorId },
      include: {
        documents: true,
        completer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalItems = items.length;
    const completedItems = items.filter(
      (item) =>
        item.status === ComplianceItemStatus.COMPLETED ||
        item.status === ComplianceItemStatus.WAIVED ||
        item.status === ComplianceItemStatus.NOT_APPLICABLE
    ).length;

    return {
      vendorId,
      items,
      summary: {
        total: totalItems,
        completed: completedItems,
        pending: totalItems - completedItems,
        completionPercentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      },
    };
  }

  async updateItemStatus(itemId: string, dto: UpdateComplianceItemDto, userId: string) {
    const item = await prisma.complianceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundError('Compliance Item', itemId);
    }

    const updateData: Prisma.ComplianceItemUpdateInput = {
      status: dto.status,
      notes: dto.notes,
    };

    if (
      dto.status === ComplianceItemStatus.COMPLETED ||
      dto.status === ComplianceItemStatus.WAIVED
    ) {
      updateData.completedAt = new Date();
      updateData.completedBy = userId;
    }

    const updated = await prisma.complianceItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        documents: true,
      },
    });

    return updated;
  }

  async getItemById(itemId: string) {
    const item = await prisma.complianceItem.findUnique({
      where: { id: itemId },
      include: {
        documents: true,
        vendor: {
          select: {
            id: true,
            legalName: true,
            status: true,
          },
        },
        completer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundError('Compliance Item', itemId);
    }

    return item;
  }

  async listItems(query: ComplianceQueryDto) {
    const where: Prisma.ComplianceItemWhereInput = {};

    if (query.vendorId) {
      where.vendorId = query.vendorId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['COMPLETED', 'WAIVED', 'NOT_APPLICABLE'] };
    }

    const [items, total] = await Promise.all([
      prisma.complianceItem.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              legalName: true,
            },
          },
          documents: true,
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.complianceItem.count({ where }),
    ]);

    return {
      data: items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}

export const complianceService = new ComplianceService();
