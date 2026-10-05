import { UserRole } from '../../types/enums';

// ─── Auth Response Types ─────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until accessToken expires
}

export interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  isVerified: boolean;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// ─── Internal Signup Data ────────────────────────────────────────────────────

export interface InitiateSignupData {
  email: string;
  fullName: string;
  phone?: string;
  disabilityType?: string;
}

export interface CompleteSignupData {
  registrationToken: string;
  firebaseIdToken: string;
}

// ─── OTP Response ────────────────────────────────────────────────────────────

export interface OtpSentResponse {
  message: string;
  expiresIn: number;  // seconds
  email: string;
}

export interface OtpVerifiedResponse {
  message: string;
  registrationToken?: string;
  resetToken?: string;
}
