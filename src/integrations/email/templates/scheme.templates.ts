import { renderEmailLayout, renderInfoCard, renderCallout, escapeHtml } from '../email.renderer';
import { EMAIL_LINKS } from '../email.constants';
import { RenderedEmail } from '../email.types';

export function buildSchemeApplicationSubmittedEmail(
  to: string,
  applicantName: string,
  schemeTitle: string,
  providerName: string
): RenderedEmail {
  const greeting = applicantName ? `Hi ${applicantName},` : 'Hello,';
  const title = 'Scheme Application Submitted! 📑';
  const preheader = `Your application for ${schemeTitle} provided by ${providerName} has been submitted.`;

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15.5px; line-height: 25px; color: #4F5A68;">
          Your application for the assistance / empowerment scheme <strong>"${escapeHtml(schemeTitle)}"</strong> offered by <strong>${escapeHtml(providerName)}</strong> has been registered on Knotnex.
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: 'Scheme', value: schemeTitle, icon: '🏛️' },
      { label: 'Provider / Authority', value: providerName, icon: '🏢' },
      { label: 'Status', value: 'Submitted (Review in Progress)', icon: '⏳' },
      { label: 'Applicant Email', value: to, icon: '✉️' },
    ])}

    ${renderCallout('The organization or government department will review your submitted eligibility documents. Updates will be reflected here and in your Knotnex app.', 'info')}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Support Scheme',
      bg: '#EEF2FF',
      color: '#4338CA',
    },
    contentHtml,
    cta: {
      text: 'Track Application',
      url: EMAIL_LINKS.USER_APP,
    },
    secondaryNotice: 'Make sure your profile contact information and disability certificates are kept up-to-date in your Knotnex profile.',
  });
}

export function buildSchemeApplicationStatusUpdateEmail(
  to: string,
  applicantName: string,
  schemeTitle: string,
  providerName: string,
  status: string,
  reviewerNotes?: string
): RenderedEmail {
  const greeting = applicantName ? `Hi ${applicantName},` : 'Hello,';
  const title = `Scheme Update: ${escapeHtml(schemeTitle)} 📢`;
  const preheader = `Your application for ${schemeTitle} has been updated to: ${status}.`;

  const isApproved = status.toLowerCase().includes('approved') || status.toLowerCase().includes('sanctioned');
  const isRejected = status.toLowerCase().includes('rejected');

  let badgeBg = '#EEF2FF';
  let badgeColor = '#4338CA';
  let badgeText = `Status: ${status}`;

  if (isApproved) {
    badgeBg = '#ECFDF5';
    badgeColor = '#065F46';
    badgeText = 'Approved / Sanctioned ✅';
  } else if (isRejected) {
    badgeBg = '#FEF2F2';
    badgeColor = '#991B1B';
    badgeText = 'Application Closed';
  }

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15.5px; line-height: 25px; color: #4F5A68;">
          There is an official status update for your scheme application:
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: 'Scheme', value: schemeTitle, icon: '🏛️' },
      { label: 'Provider / Authority', value: providerName, icon: '🏢' },
      { label: 'Updated Status', value: status.toUpperCase(), icon: '📋' },
    ])}

    ${reviewerNotes ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #F8FAFF; border-left: 4px solid #6336EB; border-radius: 0 12px 12px 0; margin: 18px 0; padding: 16px 20px;">
        <tr>
          <td>
            <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13px; font-weight: 700; color: #4338CA; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Remarks from Reviewer
            </div>
            <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14.5px; line-height: 22px; color: #1E1B4B;">
              ${escapeHtml(reviewerNotes)}
            </div>
          </td>
        </tr>
      </table>
    ` : ''}

    ${isApproved ? renderCallout('Your scheme application has been approved! The department or provider will contact you with disbursement or aid distribution details.', 'success') : ''}
    ${isRejected ? renderCallout('If additional documents or eligibility proof were missing, you may reapply or contact support for guidance.', 'info') : ''}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: badgeText,
      bg: badgeBg,
      color: badgeColor,
    },
    contentHtml,
    cta: {
      text: 'Check My Applications',
      url: EMAIL_LINKS.USER_APP,
    },
    secondaryNotice: 'All official government and NGO notifications are recorded securely in your Knotnex portal.',
  });
}

