import { renderEmailLayout, renderInfoCard, renderCallout, escapeHtml } from '../email.renderer';
import { EMAIL_LINKS } from '../email.constants';
import { RenderedEmail } from '../email.types';

export function buildCareerApplicationSubmittedEmail(
  to: string,
  applicantName: string,
  jobTitle: string,
  orgName: string
): RenderedEmail {
  const greeting = applicantName ? `Hi ${applicantName},` : 'Hello,';
  const title = 'Application Submitted Successfully! 💼';
  const preheader = `Your application for ${jobTitle} at ${orgName} has been received.`;

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15.5px; line-height: 25px; color: #4F5A68;">
          Your application for the position of <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(orgName)}</strong> has been successfully submitted via Knotnex.
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: 'Role', value: jobTitle, icon: '💼' },
      { label: 'Organization', value: orgName, icon: '🏢' },
      { label: 'Current Stage', value: 'Applied (Under Review)', icon: '⏳' },
      { label: 'Applicant Email', value: to, icon: '✉️' },
    ])}

    ${renderCallout('The recruitment team will review your qualifications and accommodations requested. You will receive email notifications as your application progresses.', 'info')}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Career Application',
      bg: '#EEF2FF',
      color: '#4338CA',
    },
    contentHtml,
    cta: {
      text: 'View Application Status',
      url: EMAIL_LINKS.USER_APP,
    },
    secondaryNotice: 'Track all your job applications and status updates anytime from your Knotnex Hub.',
  });
}

export function buildCareerApplicationStatusUpdateEmail(
  to: string,
  applicantName: string,
  jobTitle: string,
  orgName: string,
  stage: string,
  reviewerNotes?: string
): RenderedEmail {
  const greeting = applicantName ? `Hi ${applicantName},` : 'Hello,';
  const title = `Application Update: ${escapeHtml(jobTitle)} 📄`;
  const preheader = `Update on your application for ${jobTitle} at ${orgName}: Current stage is ${stage}.`;

  const isHired = stage.toLowerCase().includes('offer') || stage.toLowerCase().includes('hired');
  const isRejected = stage.toLowerCase().includes('reject');

  let badgeBg = '#EEF2FF';
  let badgeColor = '#4338CA';
  let badgeText = `Stage: ${stage}`;

  if (isHired) {
    badgeBg = '#ECFDF5';
    badgeColor = '#065F46';
    badgeText = 'Offer / Hired 🎉';
  } else if (isRejected) {
    badgeBg = '#FEF2F2';
    badgeColor = '#991B1B';
    badgeText = 'Decision Finalized';
  }

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15.5px; line-height: 25px; color: #4F5A68;">
          There is an update on your application for <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(orgName)}</strong>.
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: 'Role', value: jobTitle, icon: '💼' },
      { label: 'Organization', value: orgName, icon: '🏢' },
      { label: 'New Application Stage', value: stage.toUpperCase(), icon: '📋' },
    ])}

    ${reviewerNotes ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #F8FAFF; border-left: 4px solid #6336EB; border-radius: 0 12px 12px 0; margin: 18px 0; padding: 16px 20px;">
        <tr>
          <td>
            <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13px; font-weight: 700; color: #4338CA; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Notes from Hiring Team
            </div>
            <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14.5px; line-height: 22px; color: #1E1B4B;">
              ${escapeHtml(reviewerNotes)}
            </div>
          </td>
        </tr>
      </table>
    ` : ''}

    ${isHired ? renderCallout('Congratulations on reaching this milestone! Please review any next steps from the hiring team.', 'success') : ''}
    ${isRejected ? renderCallout('While this role may not be the right match at this time, we encourage you to explore other inclusive opportunities on Knotnex.', 'info') : ''}
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
      text: 'View in Knotnex',
      url: EMAIL_LINKS.USER_APP,
    },
    secondaryNotice: 'You can check full message threads and schedule details in your Knotnex application.',
  });
}

