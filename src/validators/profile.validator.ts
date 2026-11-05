import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(1).optional(),
    username: z.string().optional(),
    bio: z.string().max(1000).optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    address: z.string().optional(),
    pincode: z.string().optional(),
    disabilityType: z.string().optional(),
    education: z.array(z.any()).optional(),
    skills: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    socialLinks: z.record(z.any()).optional(),
    accessibility: z.record(z.any()).optional(),
    avatarUrl: z.string().nullable().optional(),
    coverUrl: z.string().nullable().optional(),
    phone: z.string().optional(),
  }),
});
