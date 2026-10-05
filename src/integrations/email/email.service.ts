import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../config/logger';

let brevoSmtpTransporter: Transporter | null = null;

// Auto-detect if user provided an SMTP key (starts with xsmtpsib-) or REST API key (starts with xkeysib-)
const isSmtpKey = config.brevo.apiKey && config.brevo.apiKey.startsWith('xsmtpsib-');

if (isSmtpKey) {
  brevoSmtpTransporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // TLS
    auth: {
      user: config.brevo.fromEmail, // Your Brevo account email (knotnex.developer@gmail.com)
      pass: config.brevo.apiKey,    // Your SMTP key (xsmtpsib-...)
    },
  });
  logger.info('Brevo SMTP relay transporter initialized successfully', {
    host: 'smtp-relay.brevo.com',
    user: config.brevo.fromEmail,
  });
} else if (config.brevo.apiKey) {
  logger.info('Brevo REST API email service initialized');
}

export class EmailService {
  /**
   * Send customized HTML emails via Brevo (supports both SMTP and REST API automatically)
   */
  static async sendEmail(to: string, subject: string, htmlContent: string, textContent?: string) {
    // Skip external Brevo API calls for test recipients to preserve daily quota (300/day)
    if (to.endsWith('@knotnex.test') || to.startsWith('loadtest_') || process.env.NODE_ENV === 'test') {
      logger.debug('[EmailService] Test recipient detected, simulated email dispatch', { to, subject });
      return { success: true, messageId: 'simulated-test-email-id', provider: 'test_mock' };
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
    logger.warn('No Brevo API/SMTP key configured. Email logged to console.', {
      to,
      subject,
      preview: textContent || 'HTML Email Body',
    });
    return { success: true, status: 'logged_only' };
  }

  /**
   * Helper to wrap customized HTML content in a branded Knotnex template
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
          .btn { display: inline-block; background-color: #4F46E5; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; text-align: center; }
          .card { background-color: #f8fafc; border-left: 4px solid #4F46E5; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0; }
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
            <p>You received this email regarding your Knotnex account or activities.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 4-Digit OTP Email — Branded Template
   * type: 'signup' | 'reset'
   */
  static async sendOtpEmail(to: string, name: string, otp: string, type: 'signup' | 'reset') {
    const isSignup = type === 'signup';
    const subject = isSignup
      ? 'Your Knotnex Verification Code'
      : 'Your Knotnex Password Reset Code';

    const heading = isSignup
      ? `Verify Your Email${name ? `, ${name}` : ''} ✉️`
      : 'Reset Your Password 🔑';

    const description = isSignup
      ? "You're almost there! Use the verification code below to complete your Knotnex registration:"
      : 'We received a request to reset your Knotnex account password. Use the code below:';

    const footer = isSignup
      ? 'This code is valid for <strong>10 minutes</strong>. If you didn\'t request this, you can safely ignore this email.'
      : 'This code is valid for <strong>15 minutes</strong>. If you didn\'t request a password reset, please secure your account immediately.';

    const digits = otp.split('');

    const body = `
      <h2>${heading}</h2>
      <p>${description}</p>

      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-flex; gap: 12px; justify-content: center;">
          ${digits.map(d => `
            <div style="
              width: 56px;
              height: 64px;
              background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
              border-radius: 12px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 32px;
              font-weight: 800;
              color: #ffffff;
              letter-spacing: 0;
              box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
            ">${d}</div>
          `).join('')}
        </div>
        <p style="margin: 16px 0 0; font-size: 13px; color: #64748b; letter-spacing: 4px; font-weight: 600;">
          ${otp}
        </p>
      </div>

      <div class="card">
        <p style="margin: 0; font-size: 13px;">⏱️ ${footer}</p>
      </div>

      <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
        For your security, never share this code with anyone — Knotnex will never ask for your OTP.
      </p>
    `;

    const html = this.wrapInBrandedTemplate(body);
    return this.sendEmail(to, subject, html, `Your verification code is: ${otp}`);
  }

  /**
   * Branded Welcome Email
   */
  static async sendWelcomeEmail(to: string, name: string) {
    const body = `
      <h2>Welcome, ${name}! 🎉</h2>
      <p>We're thrilled to welcome you to <strong>Knotnex</strong> — the platform designed to connect specially-abled individuals with accessible events, inclusive employment opportunities, and government/NGO support schemes.</p>
      
      <div class="card">
        <strong>What you can do next:</strong>
        <ul>
          <li>Browse accessible workshops & networking events</li>
          <li>Explore disability-friendly job openings with accommodations</li>
          <li>Apply for assistive tech grants and support schemes</li>
        </ul>
      </div>

      <p style="text-align: center;">
        <a href="https://knotnex.com" class="btn">Explore Knotnex</a>
      </p>

      <p>Need any assistance? Reply directly to this email or visit our Support Hub.</p>
    `;

    const html = this.wrapInBrandedTemplate(body);
    return this.sendEmail(to, 'Welcome to Knotnex Platform!', html);
  }

  /**
   * Event Registration with QR Pass
   */
  static async sendEventRegistrationConfirmation(to: string, eventTitle: string, qrPassUrl: string) {
    const body = `
      <h2>Your Event Pass is Ready! 🎟️</h2>
      <p>Your registration for <strong>${eventTitle}</strong> is officially confirmed.</p>
      
      <div class="card" style="text-align: center;">
        <p style="margin-top: 0; font-weight: 600;">Present this QR code at the entrance venue:</p>
        <img src="${qrPassUrl}" alt="Event Pass QR Code" style="width: 220px; height: 220px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #fff;" />
      </div>

      <p style="text-align: center;">
        <a href="${qrPassUrl}" class="btn">Download Pass</a>
      </p>

      <p>If you requested accessibility accommodations (wheelchair, sign language interpreter), our organizing team has been notified.</p>
    `;

    const html = this.wrapInBrandedTemplate(body);
    return this.sendEmail(to, `Registration Confirmed: ${eventTitle}`, html);
  }

  /**
   * Support Ticket Update
   */
  static async sendTicketUpdateNotification(to: string, ticketSubject: string, replyMessage: string) {
    const body = `
      <h2>New Update on Your Support Ticket 💬</h2>
      <p>A new response has been posted on ticket: <strong>"${ticketSubject}"</strong></p>

      <div class="card">
        <p style="margin: 0; font-style: italic;">"${replyMessage}"</p>
      </div>

      <p style="text-align: center;">
        <a href="https://knotnex.com/tickets" class="btn">View Ticket Thread</a>
      </p>
    `;

    const html = this.wrapInBrandedTemplate(body);
    return this.sendEmail(to, `Update on Ticket: ${ticketSubject}`, html);
  }
}
