import { z } from 'zod';
import { RegistrationStatus } from '../types/enums';

export const registerEventSchema = z.object({
  body: z.object({
    eventId: z.string().optional(),
    event_id: z.string().optional(),
    ticket_type: z.string().optional(),
    personalInfo: z.any().optional(),
    full_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    accessibilityNeeds: z.any().optional(),
    consentGiven: z.boolean().optional(),
    consent_given: z.boolean().optional(),
  }).refine(data => !!(data.eventId || data.event_id), {
    message: 'Event ID is required',
  }),
});

export const updateRegistrationStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(RegistrationStatus),
  }),
});
