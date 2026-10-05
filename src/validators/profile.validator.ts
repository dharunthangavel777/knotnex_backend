import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).optional(),
    bio: z.string().max(1000).optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    disabilityType: z.string().optional(),
    education: z.array(z.any()).optional(),
    skills: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    socialLinks: z.record(z.string()).optional(),
    accessibility: z.record(z.any()).optional(),
    avatarUrl: z.string().url().optional(),
    coverUrl: z.string().url().optional(),
  }),
});
