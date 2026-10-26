import { z } from 'zod';
import { JobType, JobLocationType, JobStatus } from '../types/enums';

export const createJobSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    role: z.string().optional(),
    department: z.string().optional(),
    dept: z.string().optional(),
    type: z.string().optional().default('full-time'),
    locationType: z.string().optional().default('on-site'),
    location: z.string().optional().default('Remote'),
    description: z.string().optional().default('Opportunity at KnotNex Organization'),
    requirements: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional().default([]),
    skills: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional(),
    responsibilities: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional().default([]),
    disabilityAccommodations: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional().default([]),
    accommodations: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional(),
    minSalary: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional(),
    maxSalary: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional(),
    currency: z.string().default('INR').optional(),
    experienceLevel: z.string().optional().nullish(),
    educationLevel: z.string().optional().nullish(),
    deadline: z.string().optional().nullish(),
    status: z.string().default('pending_verification').optional(),
    orgId: z.string().optional(),
    org_id: z.string().optional(),
  }).passthrough(),
});

export const updateJobSchema = z.object({
  body: createJobSchema.shape.body.partial(),
});
