import { renderEmailLayout, renderOtpBoxes, renderCallout, escapeHtml } from '../email.renderer';
import { EMAIL_LINKS } from '../email.constants';
import { RenderedEmail } from '../email.types';

export function buildOtpEmail(to: string, name: string, otp: string, type: 'signup' | 'reset'): RenderedEmail {
  const isSignup = type === 'signup';
  const cleanName = name?.trim() || '';
  const greeting = cleanName ? `Hi ${cleanName},` : 'Hello,';
  
  const title = isSignup
    ? 'Verify your email to get started'
    : 'Reset your account password';

  const preheader = isSignup
    ? `Your Knotnex verification code is ${otp}. Please enter it to complete sign up.`
    : `Your Knotnex password reset code is ${otp}. Valid for 15 minutes.`;

  const instruction = isSignup
    ? 'Please enter this 4-digit code in the Knotnex app to verify your email address and activate your account:'
    : 'We received a request to reset your Knotnex password. Use the single-use security code below to proceed:';

  const expiryMinutes = isSignup ? '10 minutes' : '15 minutes';
  const calloutType = isSignup ? 'info' : 'warning';
  const calloutText = `This code expires in <strong>${expiryMinutes}</strong>. For your security, never share this code with anyone.`;

  const secondaryNotice = isSignup
    ? 'If you did not create an account on Knotnex, you can safely ignore this email — no account will be created without verification.'
    : 'If you did not request a password reset, someone else may have entered your email. Your account remains secure, but you may want to review your login devices.';

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15.5px; line-height: 24px; color: #4F5A68;">
          ${instruction}
        </td>
      </tr>
    </table>

    ${renderOtpBoxes(otp)}

    ${renderCallout(calloutText, calloutType)}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: isSignup ? 'Email Verification' : 'Password Reset',
      bg: isSignup ? '#EEF2FF' : '#FEF3C7',
      color: isSignup ? '#4338CA' : '#92400E',
    },
    contentHtml,
    secondaryNotice,
  });
}

export function buildAdminLoginOtpEmail(to: string, name: string, otp: string): RenderedEmail {
  const adminName = name?.trim() || 'Administrator';
  const greeting = `Hello ${adminName},`;
  const title = 'Admin Portal Access Code';
  const preheader = `Your Knotnex Super Admin verification code is ${otp}.`;

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15px; line-height: 23px; color: #4F5A68;">
          A login attempt was initiated for the <strong>Knotnex Admin Portal</strong> (admin.knotnex.com). Enter this single-use authorization code to complete your login:
        </td>
      </tr>
    </table>

    ${renderOtpBoxes(otp)}

    ${renderCallout('⏱️ This high-privilege access code expires in <strong>10 minutes</strong>.', 'warning')}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Super Admin Authorization',
      bg: '#FEF3C7',
      color: '#92400E',
    },
    contentHtml,
    secondaryNotice: 'If you did not initiate this administrator login, please contact security immediately and inspect the admin access audit logs.',
  });
}

export function buildWelcomeEmail(to: string, name: string): RenderedEmail {
  const cleanName = name?.trim() || 'Friend';
  const greeting = `Hi ${cleanName},`;
  const title = 'Welcome to Knotnex! 🎉';
  const preheader = 'Welcome to Knotnex — Connecting people. Creating opportunities.';

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15.5px; line-height: 25px; color: #4F5A68;">
          We're thrilled to welcome you to <strong>Knotnex</strong> — the unified platform dedicated to connecting specially-abled individuals with accessible opportunities, inclusive events, community support, and empowering careers.
        </td>
      </tr>
    </table>

    <div style="height: 18px;">&nbsp;</div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #F9FAFD; border: 1px solid #E0E7FF; border-radius: 16px; padding: 18px 20px;">
      <tr>
        <td>
          <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15px; font-weight: 700; color: #272E38; margin-bottom: 10px;">
            Here is what you can do right away:
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">🎟️</td>
              <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14px; line-height: 22px; color: #4F5A68; padding-bottom: 8px;">
                <strong>Discover Accessible Events:</strong> Reserve free and subsidized passes for inclusive workshops, sports, and summits.
              </td>
            </tr>
            <tr>
              <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">💼</td>
              <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14px; line-height: 22px; color: #4F5A68; padding-bottom: 8px;">
                <strong>Inclusive Careers:</strong> Apply to verified equal-opportunity employers with accessibility accommodations.
              </td>
            </tr>
            <tr>
              <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">🏛️</td>
              <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14px; line-height: 22px; color: #4F5A68; padding-bottom: 8px;">
                <strong>Government &amp; NGO Schemes:</strong> Find assistive aid, skill development, and financial grants.
              </td>
            </tr>
            <tr>
              <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">🤝</td>
              <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14px; line-height: 22px; color: #4F5A68;">
                <strong>Community Network:</strong> Share thoughts, follow organizations, and chat directly with peers.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Account Activated',
      bg: '#ECFDF5',
      color: '#065F46',
    },
    contentHtml,
    cta: {
      text: 'Explore Knotnex App',
      url: EMAIL_LINKS.WEBSITE,
    },
    secondaryNotice: 'Download the Knotnex mobile app on Android or iOS to experience accessibility features tailored for you.',
  });
}

export function buildPasswordChangedEmail(to: string, name: string): RenderedEmail {
  const cleanName = name?.trim() || 'there';
  const greeting = `Hi ${cleanName},`;
  const title = 'Your Password Was Updated 🔒';
  const preheader = 'Your Knotnex account password has been changed.';
  const timestamp = new Date().toUTCString();

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15px; line-height: 24px; color: #4F5A68;">
          This email confirms that the password for your Knotnex account (<strong>${escapeHtml(to)}</strong>) was successfully changed on <strong>${timestamp}</strong>.
        </td>
      </tr>
    </table>

    ${renderCallout('If you made this change, no further action is required.', 'success')}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 14px;">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13.5px; line-height: 21px; color: #EF4444; font-weight: 500;">
          ⚠️ If you did NOT make this change, your account may be compromised. Please reset your password immediately or contact Knotnex Support.
        </td>
      </tr>
    </table>
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Security Alert',
      bg: '#FEF2F2',
      color: '#991B1B',
    },
    contentHtml,
    cta: {
      text: 'Contact Security Support',
      url: EMAIL_LINKS.HELP,
    },
  });
}

