import { z } from 'zod';
import { SchemeType, SchemeStatus } from '../types/enums';

export const createSchemeSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Scheme title is required'),
    providerName: z.string().min(2, 'Provider name is required'),
    type: z.nativeEnum(SchemeType),
    category: z.string().min(2, 'Category is required'),
    description: z.string().min(10, 'Description is required'),
    eligibilityCriteria: z.array(z.string()).default([]),
    benefits: z.array(z.string()).default([]),
    documentsRequired: z.array(z.string()).default([]),
    applicationDeadline: z.string().optional(),
    officialPortalUrl: z.string().url().optional(),
    status: z.nativeEnum(SchemeStatus).default(SchemeStatus.ACTIVE),
  }),
});

export const updateSchemeSchema = z.object({
  body: createSchemeSchema.shape.body.partial(),
});

export const applySchemeSchema = z.object({
  body: z.object({
    documentUrls: z.array(z.string().url()).default([]),
    applicantNotes: z.string().optional(),
  }),
});
