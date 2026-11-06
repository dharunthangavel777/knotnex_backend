/**
 * KnotNex Centralized Email Type Definitions
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailLayoutOptions {
  preheader: string;
  greeting?: string;
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    bg?: string;
    color?: string;
  };
  contentHtml: string;
  cta?: {
    text: string;
    url: string;
  };
  secondaryNotice?: string;
  bannerUrl?: string;
  bannerAlt?: string;
  customFooterText?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  status?: string;
}

export type EmailTemplateKey =
  | 'user_otp_signup'
  | 'user_otp_reset'
  | 'admin_login_otp'
  | 'user_welcome'
  | 'security_password_changed'
  | 'org_verification_submitted'
  | 'org_verification_approved'
  | 'org_verification_rejected'
  | 'event_registration_confirmed'
  | 'career_application_submitted'
  | 'career_application_status'
  | 'scheme_application_submitted'
  | 'scheme_application_status'
  | 'support_ticket_update'
  | 'admin_quota_alert';

