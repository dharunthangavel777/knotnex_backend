import { z } from 'zod';
import { SchemeType, SchemeStatus } from '../types/enums';

export const createSchemeSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Scheme title is required').optional(),
    name: z.string().min(1, 'Scheme name is required').optional(),
    providerName: z.string().optional().default('KnotNex Organization'),
    provider: z.string().optional(),
    type: z.string().optional().default('NGO'),
    category: z.string().optional().default('Welfare'),
    description: z.string().optional().default('Welfare scheme program'),
    eligibilityCriteria: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional().default([]),
    eligibility: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional(),
    benefits: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional().default([]),
    documentsRequired: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional().default([]),
    documents: z.union([z.array(z.string()), z.string().transform(v => [v])]).optional(),
    applicationDeadline: z.string().optional().nullish(),
    deadline: z.string().optional().nullish(),
    officialPortalUrl: z.string().optional().nullish(),
    grantAmount: z.string().optional().nullish(),
    fundingAmount: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional(),
    processSteps: z.array(z.any()).optional().default([]),
    faqs: z.array(z.any()).optional().default([]),
    supportEmail: z.string().optional().nullish(),
    supportPhone: z.string().optional().nullish(),
    status: z.string().default('pending_verification').optional(),
    orgId: z.string().optional(),
    org_id: z.string().optional(),
  }).passthrough(),
});

export const updateSchemeSchema = z.object({
  body: createSchemeSchema.shape.body.partial(),
});

export const applySchemeSchema = z.object({
  body: z.object({
    documentUrls: z.array(z.string()).default([]),
    applicantNotes: z.string().optional(),
    requestedAmount: z.string().optional(),
    contactPerson: z.string().optional(),
    orgType: z.string().optional(),
  }).passthrough(),
});

export const updateSchemeApplicationStatusSchema = z.object({
  body: z.object({
    status: z.string().min(1, 'Status is required'),
    stage: z.string().optional(),
    reviewerNotes: z.string().optional(),
  }).passthrough(),
});

