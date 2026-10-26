import { z } from 'zod';
import { EventType, EventStatus } from '../types/enums';

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').optional(),
    name: z.string().min(1, 'Name is required').optional(),
    category: z.string().optional().default('General'),
    type: z.string().optional().default('In-Person'),
    coverUrl: z.string().optional().nullish(),
    shortDescription: z.string().optional().nullish(),
    detailedDescription: z.string().optional().nullish(),
    language: z.string().default('English').optional(),
    eventDate: z.string().optional(),
    startTime: z.string().optional().nullish(),
    endTime: z.string().optional().nullish(),
    timezone: z.string().default('Asia/Kolkata').optional(),
    registrationOpens: z.string().optional().nullish(),
    registrationDeadline: z.string().optional().nullish(),
    venueName: z.string().optional().nullish(),
    address: z.string().optional().nullish(),
    district: z.string().optional().nullish(),
    state: z.string().optional().nullish(),
    googleMapsLink: z.string().optional().nullish(),
    meetingPlatform: z.string().optional().nullish(),
    meetingLink: z.string().optional().nullish(),
    wheelchairAccessible: z.boolean().default(false).optional(),
    signLanguage: z.boolean().default(false).optional(),
    brailleMaterial: z.boolean().default(false).optional(),
    capacity: z.union([z.number(), z.string().transform(v => parseInt(v, 10) || 500)]).optional(),
    isFree: z.boolean().default(true).optional(),
    ticketPrice: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).default(0).optional(),
    status: z.string().default('pending_verification').optional(),
    eligibility: z.array(z.string()).optional(),
    sponsors: z.array(z.any()).optional(),
    gallery: z.array(z.string()).optional(),
    contactEmail: z.string().optional().nullish(),
    orgId: z.string().optional(),
    org_id: z.string().optional(),
  }).passthrough(),
});

export const updateEventSchema = z.object({
  body: createEventSchema.shape.body.partial(),
});
