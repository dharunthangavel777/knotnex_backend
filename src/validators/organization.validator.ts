import { z } from 'zod';
import { OrganizationType } from '../types/enums';

export const createOrgSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Organization name is required'),
    type: z.nativeEnum(OrganizationType),
    about: z.string().optional(),
    mission: z.string().optional(),
    vision: z.string().optional(),
    services: z.array(z.string()).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    website: z.string().url().optional(),
    socialLinks: z.record(z.string()).optional(),
    logoUrl: z.string().url().optional(),
    coverUrl: z.string().url().optional(),
  }),
});

export const updateOrgSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    type: z.nativeEnum(OrganizationType).optional(),
    about: z.string().optional(),
    mission: z.string().optional(),
    vision: z.string().optional(),
    services: z.array(z.string()).optional(),
    achievements: z.array(z.string()).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    website: z.string().url().optional(),
    socialLinks: z.record(z.string()).optional(),
    logoUrl: z.string().url().optional(),
    coverUrl: z.string().url().optional(),
  }),
});

export const createReviewSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  }),
});
