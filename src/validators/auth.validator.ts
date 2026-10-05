import { z } from 'zod';
import { UserRole } from '../types/enums';

export const signupSchema = z.object({
  body: z.object({
    firebaseUid: z.string().min(1, 'Firebase UID is required'),
    email: z.string().email('Invalid email address'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    phone: z.string().optional(),
    role: z.nativeEnum(UserRole).default(UserRole.USER),
    avatarUrl: z.string().url().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Valid phone number with country code is required'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Valid phone number with country code is required'),
    code: z.string().length(6, 'OTP must be 6 digits'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});
