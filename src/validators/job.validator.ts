import { z } from 'zod';
import { JobType, JobLocationType, JobStatus } from '../types/enums';

export const createJobSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title is required'),
    department: z.string().optional(),
    type: z.nativeEnum(JobType),
    locationType: z.nativeEnum(JobLocationType),
    location: z.string().optional(),
    description: z.string().min(10, 'Description is required'),
    requirements: z.array(z.string()).default([]),
    responsibilities: z.array(z.string()).default([]),
    disabilityAccommodations: z.array(z.string()).default([]),
    minSalary: z.number().nonnegative().optional(),
    maxSalary: z.number().nonnegative().optional(),
    currency: z.string().default('INR'),
    experienceLevel: z.string().optional(),
    educationLevel: z.string().optional(),
    deadline: z.string().optional(),
    status: z.nativeEnum(JobStatus).default(JobStatus.OPEN),
  }),
});

export const updateJobSchema = z.object({
  body: createJobSchema.shape.body.partial(),
});
