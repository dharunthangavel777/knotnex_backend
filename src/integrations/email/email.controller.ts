import { Request, Response } from 'express';
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
import { EmailService } from './email.service';
import { RenderedEmail } from './email.types';
import { logger } from '../../config/logger';

export const TEMPLATE_CATALOG = [
  {
    key: 'user_otp_signup',
    name: 'User Signup OTP Verification',
    category: 'Authentication',
    description: '4-digit OTP box email sent during user registration with 10-minute expiry.',
  },
  {
    key: 'user_otp_reset',
    name: 'Password Reset OTP Verification',
    category: 'Authentication',
    description: '4-digit security code for resetting lost account credentials.',
  },
  {
    key: 'admin_login_otp',
    name: 'Super Admin Portal Access Code',
    category: 'Authentication & Security',
    description: 'High-privilege authorization code for admin portal dashboard sign in.',
  },
  {
    key: 'user_welcome',
    name: 'Welcome to Knotnex',
    category: 'Onboarding',
    description: 'Onboarding email welcoming new community members with platform highlights.',
  },
  {
    key: 'security_password_changed',
    name: 'Password Changed Security Notice',
    category: 'Security',
    description: 'Alert sent when account password is updated, including timestamp and safety notice.',
  },
  {
    key: 'org_verification_submitted',
    name: 'Organization Verification Submitted',
    category: 'Organization',
    description: 'Confirmation email sent when an organization submits documents for verification.',
  },
  {
    key: 'org_verification_approved',
    name: 'Organization Verification Approved',
    category: 'Organization',
    description: 'Welcome and activation notice when admin approves an organization account.',
  },
  {
    key: 'org_verification_rejected',
    name: 'Organization Verification Notice',
    category: 'Organization',
    description: 'Notification with feedback/reason when organization verification requires changes.',
  },
  {
    key: 'event_registration_confirmed',
    name: 'Event Pass & QR Code Confirmation',
    category: 'Events',
    description: 'Registration pass with entrance QR code, venue details, and accessibility confirmation.',
  },
  {
    key: 'event_update',
    name: 'Event Organizer Announcement',
    category: 'Events',
    description: 'Broadcast notification to event attendees for schedule, speaker, or venue updates.',
  },
  {
    key: 'career_application_submitted',
    name: 'Career Application Confirmation',
    category: 'Careers',
    description: 'Receipt email when an applicant submits a job application to an inclusive employer.',
  },
  {
    key: 'career_application_status',
    name: 'Career Application Status Update',
    category: 'Careers',
    description: 'Notification to applicant when recruiter updates application stage.',
  },
  {
    key: 'scheme_application_submitted',
    name: 'Assistance Scheme Application Submitted',
    category: 'Schemes & Grants',
    description: 'Receipt confirmation for government or NGO assistance/aid scheme.',
  },
  {
    key: 'scheme_application_status',
    name: 'Assistance Scheme Status Update',
    category: 'Schemes & Grants',
    description: 'Official update on scheme approval, sanction, or required revisions.',
  },
  {
    key: 'support_ticket_update',
    name: 'Support Ticket Reply',
    category: 'Support',
    description: 'Helpdesk reply notification with agent message thread and link.',
  },
  {
    key: 'admin_quota_alert',
    name: 'Brevo Daily Quota Capacity Alert',
    category: 'System Operations',
    description: 'Administrator warning when daily transactional email quota exceeds 90% (270/300).',
  },
];

function renderSampleTemplate(key: string): { rendered: RenderedEmail; subject: string } {
  switch (key) {
    case 'user_otp_signup':
      return {
        rendered: buildOtpEmail('user@example.com', 'Alex Morgan', '8492', 'signup'),
        subject: '8492 is your Knotnex verification code',
      };
    case 'user_otp_reset':
      return {
        rendered: buildOtpEmail('user@example.com', 'Alex Morgan', '3109', 'reset'),
        subject: '3109 is your Knotnex password reset code',
      };
    case 'admin_login_otp':
      return {
        rendered: buildAdminLoginOtpEmail('admin@knotnex.com', 'Dharun Admin', '5920'),
        subject: '🔒 5920 — Knotnex Admin Portal Authorization Code',
      };
    case 'user_welcome':
      return {
        rendered: buildWelcomeEmail('user@example.com', 'Alex Morgan'),
        subject: 'Welcome to Knotnex! Empowering Inclusivity & Opportunity 🎉',
      };
    case 'security_password_changed':
      return {
        rendered: buildPasswordChangedEmail('user@example.com', 'Alex Morgan'),
        subject: 'Security Notice: Your Knotnex password was updated 🔒',
      };
    case 'org_verification_submitted':
      return {
        rendered: buildOrgVerificationSubmittedEmail('contact@abilityfoundation.org', 'Dr. Sarah Sen', 'Ability India Foundation', 'NGO / Non-Profit'),
        subject: 'Verification Received: Ability India Foundation 📋',
      };
    case 'org_verification_approved':
      return {
        rendered: buildOrgVerificationApprovedEmail('contact@abilityfoundation.org', 'Dr. Sarah Sen', 'Ability India Foundation', 'ability-india'),
        subject: 'Congratulations! Ability India Foundation is now an Official Verified Organization 🏢',
      };
    case 'org_verification_rejected':
      return {
        rendered: buildOrgVerificationRejectedEmail('contact@example.org', 'Ramesh Rao', 'Community Trust', 'Government 12A/80G registration certificate is blurred and expired.'),
        subject: 'Update regarding your verification request for Community Trust',
      };
    case 'event_registration_confirmed':
      return {
        rendered: buildEventRegistrationConfirmedEmail(
          'attendee@example.com',
          'Alex Morgan',
          'Tech & AI Innovators Global Summit 2026',
          'November 24, 2026 at 10:00 AM IST',
          'Bengaluru International Exhibition Centre (BIEC), Hall 3',
          'https://storage.googleapis.com/knotnex-media-prod/email/banner.png',
          'VIP Accessibility Pass',
          0
        ),
        subject: 'Your Pass is Confirmed: Tech & AI Innovators Global Summit 2026 🎟️',
      };
    case 'event_update':
      return {
        rendered: buildEventUpdateEmail(
          'attendee@example.com',
          'Alex Morgan',
          'Tech & AI Innovators Global Summit 2026',
          'Keynote Speaker Announcement & Sign Language Interpreter Schedule',
          'We are excited to announce our keynote speaker Dr. Ananya Sharma! In addition, dedicated ISL interpreters will be available at Stage A and Stage B.'
        ),
        subject: 'Update: Tech & AI Innovators Global Summit 2026 — Keynote Speaker Announcement 📢',
      };
    case 'career_application_submitted':
      return {
        rendered: buildCareerApplicationSubmittedEmail(
          'applicant@example.com',
          'Alex Morgan',
          'Senior Accessibility Frontend Engineer',
          'Infosys Inclusive Labs'
        ),
        subject: 'Application Received: Senior Accessibility Frontend Engineer at Infosys Inclusive Labs 💼',
      };
    case 'career_application_status':
      return {
        rendered: buildCareerApplicationStatusUpdateEmail(
          'applicant@example.com',
          'Alex Morgan',
          'Senior Accessibility Frontend Engineer',
          'Infosys Inclusive Labs',
          'Interview Scheduled',
          'We were impressed by your screen reader accessibility work! The hiring manager has scheduled a 45-minute virtual conversation with live captions enabled.'
        ),
        subject: 'Application Status Update: Senior Accessibility Frontend Engineer at Infosys Inclusive Labs (Interview Scheduled)',
      };
    case 'scheme_application_submitted':
      return {
        rendered: buildSchemeApplicationSubmittedEmail(
          'applicant@example.com',
          'Alex Morgan',
          'Assistive Tech & Wheelchair Subsidy Program 2026',
          'Department of Empowerment of Persons with Disabilities'
        ),
        subject: 'Application Registered: Assistive Tech & Wheelchair Subsidy Program 2026 📑',
      };
    case 'scheme_application_status':
      return {
        rendered: buildSchemeApplicationStatusUpdateEmail(
          'applicant@example.com',
          'Alex Morgan',
          'Assistive Tech & Wheelchair Subsidy Program 2026',
          'Department of Empowerment of Persons with Disabilities',
          'Approved / Sanctioned',
          'Your medical certificate has been verified by the district medical officer. Grant voucher has been credited to your Knotnex digital wallet.'
        ),
        subject: 'Scheme Application Status: Assistive Tech & Wheelchair Subsidy Program 2026 (Approved / Sanctioned) 📢',
      };
    case 'support_ticket_update':
      return {
        rendered: buildTicketUpdateEmail(
          'user@example.com',
          'Screen reader stall on assistive device registration flow',
          'Hi Alex,\n\nOur engineering team has pushed a patch for the screen reader focus trap on Android TalkBack. Could you update your app to v1.4.2 and let us know if the issue is resolved?\n\nBest regards,\nKnotnex Accessibility Team',
          'TCK-8021'
        ),
        subject: 'New Reply on Ticket: Screen reader stall on assistive device registration flow 💬',
      };
    case 'admin_quota_alert':
      return {
        rendered: buildAdminQuotaAlertEmail(275, 300),
        subject: '⚠️ KnotNex Alert: 92% Daily Email Quota Reached',
      };
    default:
      return {
        rendered: buildWelcomeEmail('user@example.com', 'Alex Morgan'),
        subject: 'Welcome to Knotnex!',
      };
  }
}

export class EmailController {
  /**
   * List all templates available in the centralized email engine
   * GET /api/v1/emails/templates
   */
  static listTemplates(req: Request, res: Response) {
    res.json({
      success: true,
      total: TEMPLATE_CATALOG.length,
      templates: TEMPLATE_CATALOG,
    });
  }

  /**
   * Preview any email template with high-fidelity rendered HTML or JSON
   * GET /api/v1/emails/preview/:templateKey?format=html|json
   */
  static previewTemplate(req: Request, res: Response) {
    const { templateKey } = req.params;
    const format = (req.query.format as string) || 'html';

    const match = TEMPLATE_CATALOG.find((t) => t.key === templateKey);
    if (!match) {
      return res.status(404).json({
        success: false,
        error: `Template "${templateKey}" not found. Available keys: ${TEMPLATE_CATALOG.map((t) => t.key).join(', ')}`,
      });
    }

    const { rendered, subject } = renderSampleTemplate(templateKey);

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(rendered.html);
    }

    return res.json({
      success: true,
      key: templateKey,
      name: match.name,
      category: match.category,
      subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  /**
   * Test dispatch a template to a specified recipient (safeguarded)
   * POST /api/v1/emails/test-send
   */
  static async testSend(req: Request, res: Response) {
    const { templateKey, to } = req.body;

    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid recipient email "to" is required' });
    }

    const match = TEMPLATE_CATALOG.find((t) => t.key === templateKey);
    if (!match) {
      return res.status(404).json({
        success: false,
        error: `Template "${templateKey}" not found. Available keys: ${TEMPLATE_CATALOG.map((t) => t.key).join(', ')}`,
      });
    }

    const { rendered, subject } = renderSampleTemplate(templateKey);

    try {
      const result = await EmailService.sendEmail(to, subject, rendered.html, rendered.text);
      logger.info(`[EmailController] Test email dispatched successfully to ${to}`, { templateKey });
      return res.json({
        success: true,
        message: `Template "${templateKey}" dispatched to ${to}`,
        subject,
        result,
      });
    } catch (err: any) {
      logger.error('[EmailController] Test email dispatch failed', { error: err.message, to, templateKey });
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to dispatch test email',
      });
    }
  }
}

