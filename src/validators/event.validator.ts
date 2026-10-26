import { z } from 'zod';

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title is required'),
    category: z.string().min(2, 'Category is required'),
    type: z.string().optional().default('In-Person'),
    coverUrl: z.string().optional().nullable().or(z.literal('')),
    shortDescription: z.string().optional().nullable(),
    detailedDescription: z.string().optional().nullable(),
    language: z.string().default('English'),
    eventDate: z.string().optional().nullable(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    timezone: z.string().default('Asia/Kolkata'),
    registrationOpens: z.string().optional().nullable(),
    registrationDeadline: z.string().optional().nullable(),
    venueName: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    googleMapsLink: z.string().optional().nullable().or(z.literal('')),
    meetingPlatform: z.string().optional().nullable(),
    meetingLink: z.string().optional().nullable().or(z.literal('')),
    wheelchairAccessible: z.boolean().default(false),
    signLanguage: z.boolean().default(false),
    brailleMaterial: z.boolean().default(false),
    capacity: z.any().optional(),
    isFree: z.boolean().default(true),
    ticketPrice: z.any().default(0),
    status: z.string().default('draft'),
    eligibility: z.array(z.string()).optional(),
    sponsors: z.array(z.any()).optional(),
    gallery: z.array(z.string()).optional(),
    contactEmail: z.string().optional().nullable().or(z.literal('')),
    orgId: z.string().optional().nullable(),
    org_id: z.string().optional().nullable(),
  }).passthrough(),
});

export const updateEventSchema = z.object({
  body: createEventSchema.shape.body.partial(),
});

