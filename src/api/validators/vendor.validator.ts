import { z } from 'zod';
import { RiskTier, VendorStatus } from '../../domain/enums';

export const createVendorSchema = z.object({
  legalName: z.string().min(2).max(255),
  dbaName: z.string().max(255).optional(),
  taxId: z
    .string()
    .regex(/^\d{2}-\d{7}$/, 'Tax ID must be in format XX-XXXXXXX')
    .optional(),
  categoryId: z.string().uuid(),
  primaryContactName: z.string().min(2).max(100).optional(),
  primaryContactEmail: z.string().email().optional(),
  primaryContactPhone: z.string().max(20).optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const vendorQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(VendorStatus).optional(),
  categoryId: z.string().uuid().optional(),
  riskTier: z.nativeEnum(RiskTier).optional(),
  sortBy: z.enum(['legalName', 'createdAt', 'status', 'riskTier']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const submitVendorSchema = z.object({
  acknowledgement: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the submission terms',
  }),
});

export const rejectVendorSchema = z.object({
  reason: z.string().min(10).max(1000),
  comments: z.string().max(2000).optional(),
});

export const terminateVendorSchema = z.object({
  reason: z.string().min(10).max(1000),
  effectiveDate: z.coerce.date().optional(),
});

export type CreateVendorDto = z.infer<typeof createVendorSchema>;
export type UpdateVendorDto = z.infer<typeof updateVendorSchema>;
export type VendorQueryDto = z.infer<typeof vendorQuerySchema>;
export type SubmitVendorDto = z.infer<typeof submitVendorSchema>;
export type RejectVendorDto = z.infer<typeof rejectVendorSchema>;
export type TerminateVendorDto = z.infer<typeof terminateVendorSchema>;
