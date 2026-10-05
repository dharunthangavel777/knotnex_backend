import { z } from 'zod';
import { EventType, EventStatus } from '../types/enums';

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Title is required'),
    category: z.string().min(2, 'Category is required'),
    type: z.nativeEnum(EventType),
    coverUrl: z.string().url().optional(),
    shortDescription: z.string().optional(),
    detailedDescription: z.string().optional(),
    language: z.string().default('English'),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    timezone: z.string().default('Asia/Kolkata'),
    registrationOpens: z.string().optional(),
    registrationDeadline: z.string().optional(),
    venueName: z.string().optional(),
    address: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    googleMapsLink: z.string().url().optional(),
    meetingPlatform: z.string().optional(),
    meetingLink: z.string().url().optional(),
    wheelchairAccessible: z.boolean().default(false),
    signLanguage: z.boolean().default(false),
    brailleMaterial: z.boolean().default(false),
    capacity: z.number().int().positive().optional(),
    isFree: z.boolean().default(true),
    ticketPrice: z.number().nonnegative().default(0),
    status: z.nativeEnum(EventStatus).default(EventStatus.DRAFT),
    eligibility: z.array(z.string()).optional(),
    sponsors: z.array(z.any()).optional(),
    gallery: z.array(z.string()).optional(),
    contactEmail: z.string().email().optional(),
  }),
});

export const updateEventSchema = z.object({
  body: createEventSchema.shape.body.partial(),
});
