import { z } from 'zod';
import { JobApplicationStage } from '../types/enums';

export const submitApplicationSchema = z.object({
  body: z.object({
    jobId: z.string().optional(),
    job_id: z.string().optional(),
    resumeUrl: z.string().optional(),
    resume_url: z.string().optional(),
    coverLetter: z.string().optional(),
    cover_letter: z.string().optional(),
    portfolioUrl: z.string().optional(),
    accommodationNotes: z.string().optional(),
  }).refine(data => !!(data.jobId || data.job_id), {
    message: 'Job ID is required',
  }),
});

export const updateApplicationStageSchema = z.object({
  body: z.object({
    stage: z.nativeEnum(JobApplicationStage),
    reviewerNotes: z.string().optional(),
  }),
});
