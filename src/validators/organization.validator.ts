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
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    website: z.string().optional(),
    socialLinks: z.record(z.any()).optional(),
    logoUrl: z.string().optional(),
    coverUrl: z.string().optional(),
  }),
});

export const updateOrgSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    slug: z.string().optional(),
    type: z.string().optional(),
    about: z.string().optional(),
    mission: z.string().optional(),
    vision: z.string().optional(),
    services: z.array(z.string()).optional(),
    achievements: z.array(z.string()).optional(),
    gallery: z.array(z.string()).optional(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    website: z.string().optional(),
    socialLinks: z.record(z.any()).optional(),
    logoUrl: z.string().nullable().optional(),
    coverUrl: z.string().nullable().optional(),
    registrationNumber: z.string().optional(),
    taxId: z.string().optional(),
    regNumber: z.string().optional(),
    establishedYear: z.string().optional(),
    address: z.string().optional(),
    headquarters: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
    primaryContactPerson: z.string().optional(),
    keyActivities: z.array(z.string()).optional(),
    areasOfOperation: z.array(z.string()).optional(),
  }),
});

export const createReviewSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  }),
});
