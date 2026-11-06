import { renderEmailLayout, renderInfoCard, renderCallout, escapeHtml } from '../email.renderer';
import { EMAIL_LINKS } from '../email.constants';
import { RenderedEmail } from '../email.types';

export function buildOrgVerificationSubmittedEmail(
  to: string,
  applicantName: string,
  orgName: string,
  category: string
): RenderedEmail {
  const greeting = applicantName ? `Hi ${applicantName},` : 'Hello,';
  const title = 'Verification Application Received 📋';
  const preheader = `We received your organization verification request for ${orgName}.`;

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15px; line-height: 24px; color: #4F5A68;">
          Thank you for applying to verify <strong>${escapeHtml(orgName)}</strong> on the Knotnex Platform. Our administration team reviews every organization to ensure trust and authenticity for our community members.
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: 'Organization Name', value: orgName },
      { label: 'Category', value: category },
      { label: 'Status', value: 'Under Review (24–48 Hours)' },
      { label: 'Applicant Email', value: to },
    ])}

    ${renderCallout('Our team typically reviews and validates verification requests within <strong>1 to 2 business days</strong>.', 'info')}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Verification Pending',
      bg: '#EEF2FF',
      color: '#4338CA',
    },
    contentHtml,
    cta: {
      text: 'Check Application Status',
      url: EMAIL_LINKS.USER_APP,
    },
    secondaryNotice: 'You will receive an email confirmation once our verification team completes review of your application.',
  });
}

export function buildOrgVerificationApprovedEmail(
  to: string,
  applicantName: string,
  orgName: string,
  slug: string
): RenderedEmail {
  const greeting = applicantName ? `Congratulations, ${applicantName}! 🎉` : 'Congratulations! 🎉';
  const title = `${escapeHtml(orgName)} is Verified! 🏢`;
  const preheader = `Congratulations! Your organization verification for ${orgName} has been approved.`;

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15.5px; line-height: 25px; color: #4F5A68;">
          Great news! Your verification application for <strong>${escapeHtml(orgName)}</strong> has been approved by the Knotnex administration team. Your account has now been upgraded to an <strong>Official Verified Organization</strong>.
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: 'Organization', value: orgName },
      { label: 'Handle / User ID', value: `@${slug}@knotnex` },
      { label: 'Badge', value: 'Verified Purple Badge Active 🟣' },
      { label: 'Dashboard Access', value: 'Full Publishing & Analytics Enabled' },
    ], { borderColor: '#C7D2FE', bgColor: '#F5F7FF' })}

    ${renderCallout('You can now publish accessible events, post inclusive jobs, list assistance schemes, and manage community attendees.', 'success')}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Verified Organization',
      bg: '#ECFDF5',
      color: '#065F46',
    },
    contentHtml,
    cta: {
      text: 'Open Organization Dashboard',
      url: EMAIL_LINKS.ORG_PORTAL,
    },
    secondaryNotice: 'Log in using your Knotnex account credentials to access your organization dashboard on web or mobile.',
  });
}

export function buildOrgVerificationRejectedEmail(
  to: string,
  applicantName: string,
  orgName: string,
  reason?: string
): RenderedEmail {
  const greeting = applicantName ? `Hi ${applicantName},` : 'Hello,';
  const title = 'Organization Application Update';
  const preheader = `Important update regarding your verification request for ${orgName}.`;
  const cleanReason = reason?.trim() || 'Required registration documents or legal identity could not be verified.';

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15px; line-height: 24px; color: #4F5A68;">
          Thank you for your interest in registering <strong>${escapeHtml(orgName)}</strong> on Knotnex. After reviewing your verification documents, our team was unable to approve the application at this time.
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: 'Organization Name', value: orgName },
      { label: 'Review Decision', value: 'Revisions Required' },
      { label: 'Reason for Decision', value: cleanReason },
    ], { borderColor: '#FED7AA', bgColor: '#FFFBF5' })}

    ${renderCallout('You can submit an updated verification request with additional supporting documentation through the Knotnex app.', 'warning')}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Action Required',
      bg: '#FEF3C7',
      color: '#92400E',
    },
    contentHtml,
    cta: {
      text: 'Contact Verification Team',
      url: EMAIL_LINKS.HELP,
    },
    secondaryNotice: 'If you have questions regarding this decision, reply directly to this email or contact support with your registration reference.',
  });
}

export function buildContentApprovalEmail(
  to: string,
  name: string,
  contentType: 'event' | 'job' | 'scheme',
  contentTitle: string,
  status: 'approved' | 'rejected',
  reason?: string
): RenderedEmail {
  const isApproved = status === 'approved';
  const typeLabel = contentType.charAt(0).toUpperCase() + contentType.slice(1);
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const title = isApproved ? `${typeLabel} Published Live! 🎉` : `${typeLabel} Review Notice`;
  const preheader = isApproved
    ? `Your ${contentType} "${contentTitle}" has been approved and is now live on Knotnex.`
    : `Update on your ${contentType} "${contentTitle}".`;

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15px; line-height: 24px; color: #4F5A68;">
          ${isApproved
            ? `Your ${contentType} <strong>"${escapeHtml(contentTitle)}"</strong> has been reviewed and approved by the moderation team. It is now visible to community members on the Knotnex Hub.`
            : `Your ${contentType} <strong>"${escapeHtml(contentTitle)}"</strong> was not approved for publication at this time.`}
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: `${typeLabel} Title`, value: contentTitle },
      { label: 'Status', value: isApproved ? 'Active & Published Live' : 'Requires Revisions' },
      ...(reason && !isApproved ? [{ label: 'Feedback', value: reason }] : []),
    ], {
      borderColor: isApproved ? '#A7F3D0' : '#FED7AA',
      bgColor: isApproved ? '#F0FDF4' : '#FFFBF5',
    })}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: isApproved ? 'Approved' : 'Review Notice',
      bg: isApproved ? '#ECFDF5' : '#FEF3C7',
      color: isApproved ? '#065F46' : '#92400E',
    },
    contentHtml,
    cta: {
      text: 'View in Dashboard',
      url: EMAIL_LINKS.ORG_PORTAL,
    },
  });
}

