import { renderEmailLayout, renderInfoCard, renderCallout, escapeHtml } from '../email.renderer';
import { EMAIL_LINKS } from '../email.constants';
import { RenderedEmail } from '../email.types';

export function buildEventRegistrationConfirmedEmail(
  to: string,
  attendeeName: string,
  eventTitle: string,
  eventDate: string,
  venue: string,
  qrPassUrl: string,
  ticketType: string = 'Free Pass',
  ticketPrice: number = 0
): RenderedEmail {
  const greeting = attendeeName ? `Hi ${attendeeName},` : 'Hello,';
  const title = 'Your Event Pass is Ready! 🎟️';
  const preheader = `Your registration for ${eventTitle} is confirmed. Here is your entrance pass.`;
  const isPaid = ticketPrice > 0;
  const priceDisplay = isPaid ? `₹${ticketPrice.toFixed(0)} (Paid)` : 'Free Pass';

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15.5px; line-height: 25px; color: #4F5A68;">
          You're all set! Your registration for <strong>${escapeHtml(eventTitle)}</strong> is officially confirmed. Please save this pass to show at the event entrance.
        </td>
      </tr>
    </table>

    ${renderInfoCard([
      { label: 'Event', value: eventTitle, icon: '📅' },
      { label: 'Date & Time', value: eventDate || 'Upcoming 2026', icon: '⏰' },
      { label: 'Venue Location', value: venue || 'Venue details in app', icon: '📍' },
      { label: 'Pass Type', value: `${ticketType} — ${priceDisplay}`, icon: '🏷️' },
    ])}

    ${qrPassUrl ? `
      <!-- QR Pass Card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #FFFFFF; border: 2px dashed #C7D2FE; border-radius: 20px; margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 24px 20px;">
            <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #4338CA; margin-bottom: 12px;">
              Digital Entrance QR Pass
            </div>
            <img src="${qrPassUrl}" alt="Event QR Pass" width="200" height="200" style="width: 200px; height: 200px; display: block; border: 1px solid #E0E7FF; border-radius: 12px; padding: 8px; background: #FFFFFF;" />
            <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 12px; color: #717D8A; margin-top: 10px;">
              Present this QR code on your phone or print it for check-in
            </div>
          </td>
        </tr>
      </table>
    ` : ''}

    ${renderCallout('Accessibility accommodations requested (wheelchair ramp, sign language interpreter) have been communicated to the organizers.', 'info')}
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Confirmed Registration',
      bg: '#ECFDF5',
      color: '#065F46',
    },
    contentHtml,
    cta: {
      text: 'View in My Tickets',
      url: EMAIL_LINKS.USER_APP,
    },
    secondaryNotice: 'Need to cancel or transfer your pass? Open your Knotnex app and manage your registrations in the Hub.',
  });
}

export function buildEventUpdateEmail(
  to: string,
  attendeeName: string,
  eventTitle: string,
  updateTitle: string,
  updateMessage: string
): RenderedEmail {
  const greeting = attendeeName ? `Hi ${attendeeName},` : 'Hello,';
  const title = `Update: ${escapeHtml(eventTitle)} 📢`;
  const preheader = `Important announcement regarding ${eventTitle}: ${updateTitle}`;

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15px; line-height: 24px; color: #4F5A68;">
          The organizer has posted an announcement regarding the upcoming event <strong>"${escapeHtml(eventTitle)}"</strong>:
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #F8FAFF; border-left: 4px solid #6336EB; border-radius: 0 12px 12px 0; margin: 18px 0; padding: 16px 20px;">
      <tr>
        <td>
          <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #1E1B4B; margin-bottom: 6px;">
            ${escapeHtml(updateTitle)}
          </div>
          <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14px; line-height: 22px; color: #4B5563;">
            ${escapeHtml(updateMessage)}
          </div>
        </td>
      </tr>
    </table>
  `;

  return renderEmailLayout({
    preheader,
    greeting,
    title,
    badge: {
      text: 'Event Announcement',
      bg: '#EEF2FF',
      color: '#4338CA',
    },
    contentHtml,
    cta: {
      text: 'View Event Details',
      url: EMAIL_LINKS.USER_APP,
    },
  });
}

