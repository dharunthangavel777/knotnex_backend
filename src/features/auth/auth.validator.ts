import { z } from 'zod';

// ─── Step 1: Initiate Signup (send OTP) ──────────────────────────────────────

export const initiateSignupSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g. +919876543210)')
      .optional(),
    disabilityType: z.string().max(100).optional(),
  }),
});

// ─── Step 2: Verify Signup OTP ───────────────────────────────────────────────

export const verifySignupOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(4, 'OTP must be exactly 4 digits').regex(/^\d{4}$/, 'OTP must contain digits only'),
  }),
});

// ─── Step 3: Complete Signup ─────────────────────────────────────────────────

export const completeSignupSchema = z.object({
  body: z.object({
    registrationToken: z.string().min(1, 'Registration token is required'),
    firebaseIdToken: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    fullName: z.string().optional(),
    full_name: z.string().optional(),
    phone: z.string().optional(),
  }),
});

// ─── Sign In ─────────────────────────────────────────────────────────────────

export const signinSchema = z.object({
  body: z.object({
    firebaseIdToken: z.string().optional(),
    email: z.string().email('Invalid email address').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  }).refine(data => !!(data.firebaseIdToken || (data.email && data.password)), {
    message: 'Either firebaseIdToken or email and password must be provided',
  }),
});

export const signupDirectSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
    full_name: z.string().min(2, 'Full name must be at least 2 characters').optional(),
    phone: z.string().optional(),
    role: z.string().optional(),
  }).refine(data => !!(data.fullName || data.full_name), {
    message: 'Full name is required',
  }),
});

// ─── Forgot Password — Step 1: Send Reset OTP ────────────────────────────────

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

// ─── Forgot Password — Step 2: Verify Reset OTP ──────────────────────────────

export const verifyForgotOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(4, 'OTP must be exactly 4 digits').regex(/^\d{4}$/, 'OTP must contain digits only'),
  }),
});

// ─── Forgot Password — Step 3: Reset Password ────────────────────────────────

export const resetPasswordSchema = z.object({
  body: z.object({
    resetToken: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

// ─── Refresh Tokens ──────────────────────────────────────────────────────────

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// ─── Legacy Phone OTP (kept for reference, v2) ──────────────────────────────
export const sendPhoneOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Valid phone number with country code is required'),
  }),
});

export const verifyPhoneOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Valid phone number with country code is required'),
    code: z.string().length(6, 'Phone OTP must be 6 digits'),
  }),
});
