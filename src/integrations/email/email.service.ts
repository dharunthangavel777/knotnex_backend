import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../config/logger';
import {
  buildOtpEmail,
  buildAdminLoginOtpEmail,
  buildWelcomeEmail,
  buildPasswordChangedEmail,
  buildOrgVerificationSubmittedEmail,
  buildOrgVerificationApprovedEmail,
  buildOrgVerificationRejectedEmail,
  buildContentApprovalEmail,
  buildEventRegistrationConfirmedEmail,
  buildEventUpdateEmail,
  buildCareerApplicationSubmittedEmail,
  buildCareerApplicationStatusUpdateEmail,
  buildSchemeApplicationSubmittedEmail,
  buildSchemeApplicationStatusUpdateEmail,
  buildTicketUpdateEmail,
  buildAdminQuotaAlertEmail,
} from './templates';
import { SendEmailResult } from './email.types';

let brevoSmtpTransporter: Transporter | null = null;

// Auto-detect if user provided an SMTP key (starts with xsmtpsib-) or REST API key (starts with xkeysib-)
const isSmtpKey = config.brevo.apiKey && config.brevo.apiKey.startsWith('xsmtpsib-');

if (isSmtpKey) {
  brevoSmtpTransporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // TLS
    auth: {
      user: config.brevo.fromEmail, // Brevo account email (knotnex.developer@gmail.com)
      pass: config.brevo.apiKey,    // SMTP key (xsmtpsib-...)
    },
  });
  logger.info('Brevo SMTP relay transporter initialized successfully', {
    host: 'smtp-relay.brevo.com',
    user: config.brevo.fromEmail,
  });
} else if (config.brevo.apiKey) {
  logger.info('Brevo REST API email service initialized');
}

interface DailyQuotaTracker {
  date: string;
  count: number;
  alertSent: boolean;
}

let quotaTracker: DailyQuotaTracker = {
  date: new Date().toISOString().slice(0, 10),
  count: 0,
  alertSent: false,
};

export class EmailService {
  /**
   * Send customized HTML emails via Brevo (supports both SMTP and REST API automatically)
   */
  static async sendEmail(to: string, subject: string, htmlContent: string, textContent?: string): Promise<SendEmailResult> {
    // Skip external Brevo API calls for test recipients to preserve daily quota (300/day)
    if (to.endsWith('@knotnex.test') || to.startsWith('loadtest_') || process.env.NODE_ENV === 'test') {
      logger.debug('[EmailService] Test recipient detected, simulated email dispatch', { to, subject });
      return { success: true, messageId: 'simulated-test-email-id', provider: 'test_mock' };
    }

    const todayUtc = new Date().toISOString().slice(0, 10);
    if (quotaTracker.date !== todayUtc) {
      quotaTracker = { date: todayUtc, count: 0, alertSent: false };
    }

    if (quotaTracker.count >= 300) {
      logger.error('[EmailService] Daily email dispatch quota reached (300/day limit on Brevo free tier)', {
        count: quotaTracker.count,
        date: todayUtc,
        recipient: to,
      });
      throw new Error('Daily email notification limit reached. Please contact support or try again tomorrow.');
    }

    quotaTracker.count++;

    if (quotaTracker.count >= 270 && !quotaTracker.alertSent) {
      quotaTracker.alertSent = true;
      logger.warn('[EmailService] Brevo daily quota threshold reached (90% capacity: 270/300 emails today UTC)', {
        count: quotaTracker.count,
        quotaLimit: 300,
        date: todayUtc,
      });
      EmailService.sendAdminQuotaAlert(quotaTracker.count).catch((err: any) => {
        logger.error('[EmailService] Could not send admin quota alert:', { error: err.message });
      });
    }

    // 1. If key is SMTP key (xsmtpsib-...)
    if (brevoSmtpTransporter) {
      try {
        const info = await brevoSmtpTransporter.sendMail({
          from: `"${config.brevo.fromName}" <${config.brevo.fromEmail}>`,
          to,
          subject,
          text: textContent || subject,
          html: htmlContent,
        });
        logger.info('Custom HTML email dispatched via Brevo SMTP relay', { to, subject, messageId: info.messageId });
        return { success: true, messageId: info.messageId, provider: 'brevo_smtp' };
      } catch (error: any) {
        logger.error('Brevo SMTP email failed', { to, error: error.message });
        throw error;
      }
    }

    // 2. If key is REST API key (xkeysib-...)
    if (config.brevo.apiKey) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': config.brevo.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: config.brevo.fromName,
              email: config.brevo.fromEmail,
            },
            to: [{ email: to }],
            subject,
            htmlContent,
            textContent: textContent || subject,
          }),
        });

        if (!response.ok) {
          const errorData: any = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Brevo API error (Status ${response.status})`);
        }

        const data: any = await response.json();
        logger.info('Custom HTML email dispatched via Brevo REST API', { to, subject, messageId: data.messageId });
        return { success: true, messageId: data.messageId, provider: 'brevo_api' };
      } catch (error: any) {
        logger.error('Brevo REST API email failed', { to, error: error.message });
        throw error;
      }
    }

    // 3. Fallback when no key is set
    logger.error('No Brevo API/SMTP key configured. Email delivery cannot proceed.', {
      to,
      subject,
    });
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email delivery service is temporarily unavailable. Please try again shortly or contact support.');
    }
    return { success: true, status: 'logged_only' };
  }

  /**
   * Helper to wrap customized HTML content in a branded Knotnex template (legacy fallback)
   */
  static wrapInBrandedTemplate(bodyContent: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; color: #333; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
          .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0; opacity: 0.9; font-size: 14px; }
          .content { padding: 30px 24px; line-height: 1.6; font-size: 15px; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>KnotNex</h1>
            <p>Empowering Inclusivity & Opportunity</p>
          </div>
          <div class="content">
            ${bodyContent}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Knotnex Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HIGH-LEVEL STRONGLY TYPED EMAIL DISPATCH METHODS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * 4-Digit OTP Email (Signup or Password Reset)
   */
  static async sendOtpEmail(to: string, name: string, otp: string, type: 'signup' | 'reset') {
    const rendered = buildOtpEmail(to, name, otp, type);
    const subject = type === 'signup'
      ? `${otp} is your Knotnex verification code`
      : `${otp} is your Knotnex password reset code`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Super Admin Portal Login OTP
   */
  static async sendAdminLoginOtp(to: string, name: string, otp: string) {
    const rendered = buildAdminLoginOtpEmail(to, name, otp);
    const subject = `🔒 ${otp} — Knotnex Admin Portal Authorization Code`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Welcome Email for New Registered Members
   */
  static async sendWelcomeEmail(to: string, name: string) {
    const rendered = buildWelcomeEmail(to, name);
    const subject = 'Welcome to Knotnex! Empowering Inclusivity & Opportunity 🎉';
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Security Notification: Account Password Changed
   */
  static async sendPasswordChangedEmail(to: string, name: string) {
    const rendered = buildPasswordChangedEmail(to, name);
    const subject = 'Security Notice: Your Knotnex password was updated 🔒';
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Organization Verification Application Submitted Confirmation
   */
  static async sendOrgVerificationSubmitted(to: string, applicantName: string, orgName: string, category: string) {
    const rendered = buildOrgVerificationSubmittedEmail(to, applicantName, orgName, category);
    const subject = `Verification Received: ${orgName} 📋`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Organization Verification Approved Notification
   */
  static async sendOrgVerificationApproved(to: string, applicantName: string, orgName: string, slug: string) {
    const rendered = buildOrgVerificationApprovedEmail(to, applicantName, orgName, slug);
    const subject = `Congratulations! ${orgName} is now an Official Verified Organization 🏢`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Organization Verification Rejected Notification
   */
  static async sendOrgVerificationRejected(to: string, applicantName: string, orgName: string, reason?: string) {
    const rendered = buildOrgVerificationRejectedEmail(to, applicantName, orgName, reason);
    const subject = `Update regarding your verification request for ${orgName}`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Moderation Notice for Events, Jobs, or Schemes
   */
  static async sendContentApprovalNotification(
    to: string,
    name: string,
    contentType: 'event' | 'job' | 'scheme',
    title: string,
    status: 'approved' | 'rejected',
    reason?: string
  ) {
    const rendered = buildContentApprovalEmail(to, name, contentType, title, status, reason);
    const isApproved = status === 'approved';
    const typeLabel = contentType.charAt(0).toUpperCase() + contentType.slice(1);
    const subject = isApproved
      ? `Your ${typeLabel} "${title}" is now Live! 🎉`
      : `Update on your ${typeLabel} "${title}"`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Event Registration Confirmation with QR Entrance Pass
   * Supports both 3-arg overload (to, eventTitle, qrPassUrl) and full signature
   */
  static async sendEventRegistrationConfirmation(
    to: string,
    arg1: string,
    arg2?: string,
    eventDate?: string,
    venue?: string,
    qrPassUrl?: string,
    ticketType: string = 'Free Pass',
    ticketPrice: number = 0
  ) {
    let attendeeName = '';
    let eventTitle = '';
    let passUrl = '';

    if (arg2 && (arg2.startsWith('data:image') || arg2.startsWith('http') || !eventDate)) {
      // Legacy 3-arg call: (to, eventTitle, qrPassUrl)
      eventTitle = arg1;
      passUrl = arg2;
      attendeeName = '';
    } else {
      // Full signature: (to, attendeeName, eventTitle, eventDate, venue, qrPassUrl, ticketType, ticketPrice)
      attendeeName = arg1;
      eventTitle = arg2 || '';
      passUrl = qrPassUrl || '';
    }

    const rendered = buildEventRegistrationConfirmedEmail(
      to,
      attendeeName,
      eventTitle,
      eventDate || 'Upcoming Event',
      venue || 'Check app for venue location',
      passUrl,
      ticketType,
      ticketPrice
    );
    const subject = `Your Pass is Confirmed: ${eventTitle} 🎟️`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Event Announcement / Update Email
   */
  static async sendEventUpdate(
    to: string,
    attendeeName: string,
    eventTitle: string,
    updateTitle: string,
    updateMessage: string
  ) {
    const rendered = buildEventUpdateEmail(to, attendeeName, eventTitle, updateTitle, updateMessage);
    const subject = `Update: ${eventTitle} — ${updateTitle} 📢`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Career Application Received Confirmation
   */
  static async sendCareerApplicationConfirmation(
    to: string,
    applicantName: string,
    jobTitle: string,
    orgName: string
  ) {
    const rendered = buildCareerApplicationSubmittedEmail(to, applicantName, jobTitle, orgName);
    const subject = `Application Received: ${jobTitle} at ${orgName} 💼`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Career Application Status Update
   */
  static async sendCareerApplicationStatusUpdate(
    to: string,
    applicantName: string,
    jobTitle: string,
    orgName: string,
    stage: string,
    reviewerNotes?: string
  ) {
    const rendered = buildCareerApplicationStatusUpdateEmail(to, applicantName, jobTitle, orgName, stage, reviewerNotes);
    const subject = `Application Status Update: ${jobTitle} at ${orgName} (${stage})`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Assistance / Empowerment Scheme Application Submitted
   */
  static async sendSchemeApplicationConfirmation(
    to: string,
    applicantName: string,
    schemeTitle: string,
    providerName: string
  ) {
    const rendered = buildSchemeApplicationSubmittedEmail(to, applicantName, schemeTitle, providerName);
    const subject = `Application Registered: ${schemeTitle} 📑`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Scheme Application Status Update
   */
  static async sendSchemeApplicationStatusUpdate(
    to: string,
    applicantName: string,
    schemeTitle: string,
    providerName: string,
    status: string,
    reviewerNotes?: string
  ) {
    const rendered = buildSchemeApplicationStatusUpdateEmail(to, applicantName, schemeTitle, providerName, status, reviewerNotes);
    const subject = `Scheme Application Status: ${schemeTitle} (${status}) 📢`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Support Ticket Reply Notification
   */
  static async sendTicketUpdateNotification(to: string, ticketSubject: string, replyMessage: string, ticketId?: string) {
    const rendered = buildTicketUpdateEmail(to, ticketSubject, replyMessage, ticketId);
    const subject = `New Reply on Ticket: ${ticketSubject} 💬`;
    return this.sendEmail(to, subject, rendered.html, rendered.text);
  }

  /**
   * Daily Brevo Quota Warning Alert (90% capacity)
   */
  static async sendAdminQuotaAlert(currentCount: number, maxQuota: number = 300) {
    const alertRecipient = 'knotnex.developer@gmail.com';
    const rendered = buildAdminQuotaAlertEmail(currentCount, maxQuota);
    const subject = `⚠️ KnotNex Alert: ${Math.round((currentCount / maxQuota) * 100)}% Daily Email Quota Reached`;
    try {
      if (brevoSmtpTransporter) {
        await brevoSmtpTransporter.sendMail({
          from: `"${config.brevo.fromName}" <${config.brevo.fromEmail}>`,
          to: alertRecipient,
          subject,
          html: rendered.html,
          text: rendered.text,
        });
      }
    } catch (err: any) {
      logger.error('[EmailService] Failed to dispatch admin quota alert email:', { error: err.message });
    }
  }
}
