import { z } from 'zod';

export const initiateResubmissionSchema = z.object({
  acknowledgement: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the resubmission terms',
  }),
});

export const submitResubmissionSchema = z.object({
  justification: z.string().min(20).max(2000),
  changesDescription: z.string().min(10).max(2000),
  updatedFields: z.array(z.string()).min(1),
  acknowledgement: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the resubmission terms',
  }),
});

export const reviewResubmissionSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export type InitiateResubmissionDto = z.infer<typeof initiateResubmissionSchema>;
export type SubmitResubmissionDto = z.infer<typeof submitResubmissionSchema>;
export type ReviewResubmissionDto = z.infer<typeof reviewResubmissionSchema>;
