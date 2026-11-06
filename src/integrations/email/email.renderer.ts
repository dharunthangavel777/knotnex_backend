import { EMAIL_ASSETS, EMAIL_LINKS, EMAIL_COLORS } from './email.constants';
import { EmailLayoutOptions, RenderedEmail } from './email.types';

/**
 * Escapes unsafe HTML characters to prevent XSS / HTML injection in email clients.
 */
export function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strips HTML tags and collapses spaces to create an accessible, clean plain-text fallback.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Renders the master KnotNex email layout (exact match to knotnex_email/email.html)
 * with Cloud Storage assets, typography, greeting box, and responsive attached footer.
 */
export function renderEmailLayout(options: EmailLayoutOptions): RenderedEmail {
  const bannerUrl = options.bannerUrl || EMAIL_ASSETS.BANNER;
  const bannerAlt = options.bannerAlt || 'Connecting people. Creating opportunities.';
  const currentYear = new Date().getFullYear();

  // CTA Button with MSO Outlook VML fallback
  let ctaHtml = '';
  if (options.cta && options.cta.text && options.cta.url) {
    ctaHtml = `
      <!-- Spacer -->
      <div style="height: 26px; line-height: 26px; font-size: 26px;">&nbsp;</div>

      <!-- Professional CTA Button -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${options.cta.url}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="25%" stroke="f" fillcolor="${EMAIL_COLORS.PRIMARY}">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${escapeHtml(options.cta.text)}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <a href="${options.cta.url}" class="btn-primary" target="_blank" style="background: ${EMAIL_COLORS.PRIMARY} linear-gradient(135deg, ${EMAIL_COLORS.PRIMARY_GRADIENT_START} 0%, ${EMAIL_COLORS.PRIMARY_GRADIENT_END} 100%); color: #FFFFFF; display: inline-block; font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 16px; font-weight: 700; line-height: 20px; padding: 16px 46px; text-decoration: none; border-radius: 12px; box-shadow: 0 8px 24px rgba(99, 54, 235, 0.32); transition: all 0.25s ease; letter-spacing: 0.3px;">
              ${escapeHtml(options.cta.text)}
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    `;
  }

  // Optional Badge
  let badgeHtml = '';
  if (options.badge) {
    const bg = options.badge.bg || '#FEF3C7';
    const color = options.badge.color || '#92400E';
    badgeHtml = `
      <div style="margin-bottom: 12px;">
        <span style="background: ${bg}; color: ${color}; padding: 6px 14px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; display: inline-block;">
          ${escapeHtml(options.badge.text)}
        </span>
      </div>
    `;
  }

  // Greeting Box
  let greetingBoxHtml = '';
  if (options.greeting || options.title) {
    greetingBoxHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${EMAIL_COLORS.GREETING_BG}; border-radius: 16px; border: 1px solid #ECEFFB;">
        <tr>
          <td style="padding: 22px 24px;">
            ${badgeHtml}
            ${options.greeting ? `
              <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 17.5px; line-height: 25px; color: ${EMAIL_COLORS.TEXT_BODY}; font-weight: 400; margin-bottom: 6px;">
                ${escapeHtml(options.greeting)}
              </div>
            ` : ''}
            <div class="header-title-text" style="font-family: 'Google Sans', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 26px; line-height: 33px; color: ${EMAIL_COLORS.TEXT_HEADING}; font-weight: 700;">
              ${options.title}
            </div>
            ${options.subtitle ? `
              <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14.5px; line-height: 22px; color: ${EMAIL_COLORS.TEXT_MUTED}; margin-top: 8px;">
                ${escapeHtml(options.subtitle)}
              </div>
            ` : ''}
          </td>
        </tr>
      </table>
      <div style="height: 26px; line-height: 26px; font-size: 26px;">&nbsp;</div>
    `;
  }

  const secondaryNoticeHtml = options.secondaryNotice ? `
    <div style="height: 26px; line-height: 26px; font-size: 26px;">&nbsp;</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="font-family: 'Google Sans', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 21px; color: ${EMAIL_COLORS.TEXT_MUTED}; text-align: center;">
          ${options.secondaryNotice}
        </td>
      </tr>
    </table>
  ` : '';

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(options.title)} - Knotnex</title>

  <!-- Google Sans / Plus Jakarta Sans Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    body, table, td, a, span { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->

  <style type="text/css">
    /* Base resets */
    body, p, h1, h2, h3, h4, h5, h6 {
      margin: 0;
      padding: 0;
    }
    body {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: ${EMAIL_COLORS.BACKGROUND};
      font-family: 'Google Sans', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: ${EMAIL_COLORS.TEXT_BODY};
    }
    table, td {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
      display: block;
    }
    a {
      text-decoration: none;
    }

    /* Interactive hover states */
    .btn-primary:hover {
      background: #4E1ED4 !important;
      box-shadow: 0 10px 28px rgba(99, 54, 235, 0.45) !important;
      transform: translateY(-2px);
    }
    .store-badge-link {
      display: inline-block;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .store-badge-link:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(48, 56, 142, 0.14) !important;
    }
    .social-icon-btn {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .social-icon-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(48, 56, 142, 0.22) !important;
    }
    .footer-link:hover {
      color: ${EMAIL_COLORS.PRIMARY} !important;
    }

    /* Mobile Responsive Styles */
    @media only screen and (max-width: 640px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .mobile-padding {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }
      .card-body-padding {
        padding: 26px 18px !important;
      }
      .footer-card-padding {
        padding: 26px 18px !important;
      }
      .mobile-stack {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        text-align: center !important;
      }
      .mobile-stack-col {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin-bottom: 22px !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        text-align: left !important;
      }
      .mobile-stack-col:last-child {
        margin-bottom: 0 !important;
      }
      .mobile-center-table {
        margin: 0 auto !important;
      }
      .mobile-text-center {
        text-align: center !important;
      }
      .tagline-text {
        font-size: 19px !important;
        line-height: 25px !important;
      }
      .header-title-text {
        font-size: 22px !important;
        line-height: 28px !important;
      }
      .banner-image {
        border-top-left-radius: 20px !important;
        border-top-right-radius: 20px !important;
      }
      .app-badges-table {
        width: 100% !important;
      }
      .badge-cell {
        display: block !important;
        width: 100% !important;
        padding: 6px 0 !important;
        text-align: center !important;
      }
      .otp-digit-box {
        width: 44px !important;
        height: 52px !important;
        font-size: 26px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.BACKGROUND}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Preheader preview text in inbox -->
  <div style="display: none; font-size: 1px; color: ${EMAIL_COLORS.BACKGROUND}; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(options.preheader)}
    &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
  </div>

  <!-- Background Wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${EMAIL_COLORS.BACKGROUND}; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 24px 12px 48px 12px;" class="mobile-padding">

        <!-- Outer Email Wrapper (600px Max-Width) -->
        <!--[if mso]>
        <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td>
        <![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;" class="email-container">
          
          <!-- 1. TOP HEADER: Knotnex Cloud Storage Logo -->
          <tr>
            <td align="center" style="padding: 8px 0 20px 0;">
              <a href="${EMAIL_LINKS.WEBSITE}" target="_blank" style="text-decoration: none; display: inline-block;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <img src="${EMAIL_ASSETS.LOGO}" alt="knotnex" width="164" style="width: 164px; max-width: 100%; height: auto; display: block; border: 0;" />
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- 2. UNIFIED MAIN BODY CONTAINER -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${EMAIL_COLORS.CARD_BG}; border-radius: 28px; border: 1px solid ${EMAIL_COLORS.CARD_BORDER}; box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.04); overflow: hidden;">
                
                <!-- 2A. HERO BANNER (Flush at the top of the body) -->
                <tr>
                  <td align="center" style="padding: 0; margin: 0; line-height: 0; border-top-left-radius: 28px; border-top-right-radius: 28px; overflow: hidden; background: #E0D7FB;">
                    <img src="${bannerUrl}" alt="${escapeHtml(bannerAlt)}" width="600" class="banner-image" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0; border-top-left-radius: 28px; border-top-right-radius: 28px;" />
                  </td>
                </tr>

                <!-- 2B. BODY CONTENT -->
                <tr>
                  <td style="padding: 36px 42px 32px 42px;" class="card-body-padding">
                    ${greetingBoxHtml}
                    ${options.contentHtml}
                    ${ctaHtml}
                    ${secondaryNoticeHtml}
                  </td>
                </tr>

                <!-- 2C. ATTACHED FOOTER SECTION (KnotNex Multi-column footer) -->
                <tr>
                  <td style="padding: 0; margin: 0; background-color: ${EMAIL_COLORS.GREETING_BG}; border-top: 1px solid #E5E8F5; border-bottom-left-radius: 28px; border-bottom-right-radius: 28px; overflow: hidden;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 30px 36px 26px 36px;" class="footer-card-padding">
                      
                      <!-- Footer Row 1: Logo (Left) and Social Follow (Right) -->
                      <tr>
                        <td align="left" valign="middle" class="mobile-stack" style="padding-bottom: 6px;">
                          <a href="${EMAIL_LINKS.WEBSITE}" target="_blank" style="text-decoration: none; display: inline-block;">
                            <img src="${EMAIL_ASSETS.LOGO}" alt="knotnex" width="124" style="width: 124px; max-width: 100%; height: auto; display: block; border: 0;" />
                          </a>
                        </td>

                        <td align="right" valign="middle" class="mobile-stack" style="padding-bottom: 6px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display: inline-table;" class="mobile-center-table">
                            <tr>
                              <td valign="middle" style="padding-right: 14px; font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13.5px; font-weight: 600; color: #30388E; letter-spacing: 0.2px;">
                                Follow us
                              </td>
                              <!-- Instagram -->
                              <td valign="middle" style="padding: 0 4px;">
                                <a href="${EMAIL_LINKS.INSTAGRAM}" target="_blank" class="social-icon-btn" style="text-decoration: none; display: inline-block;">
                                  <img src="${EMAIL_ASSETS.ICON_INSTAGRAM}" alt="Instagram" width="28" height="28" style="width: 28px; height: 28px; display: block; border: 0;" />
                                </a>
                              </td>
                              <!-- LinkedIn -->
                              <td valign="middle" style="padding: 0 4px;">
                                <a href="${EMAIL_LINKS.LINKEDIN}" target="_blank" class="social-icon-btn" style="text-decoration: none; display: inline-block;">
                                  <img src="${EMAIL_ASSETS.ICON_LINKEDIN}" alt="LinkedIn" width="28" height="28" style="width: 28px; height: 28px; display: block; border: 0;" />
                                </a>
                              </td>
                              <!-- Facebook -->
                              <td valign="middle" style="padding: 0 4px;">
                                <a href="${EMAIL_LINKS.FACEBOOK}" target="_blank" class="social-icon-btn" style="text-decoration: none; display: inline-block;">
                                  <img src="${EMAIL_ASSETS.ICON_FACEBOOK}" alt="Facebook" width="28" height="28" style="width: 28px; height: 28px; display: block; border: 0;" />
                                </a>
                              </td>
                              <!-- YouTube -->
                              <td valign="middle" style="padding: 0 4px;">
                                <a href="${EMAIL_LINKS.YOUTUBE}" target="_blank" class="social-icon-btn" style="text-decoration: none; display: inline-block;">
                                  <img src="${EMAIL_ASSETS.ICON_YOUTUBE}" alt="YouTube" width="28" height="28" style="width: 28px; height: 28px; display: block; border: 0;" />
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Divider 1 -->
                      <tr>
                        <td colspan="2" style="padding: 16px 0 18px 0;">
                          <div style="border-top: 1px solid ${EMAIL_COLORS.BORDER_DIVIDER}; height: 1px; line-height: 1px; font-size: 1px;">&nbsp;</div>
                        </td>
                      </tr>

                      <!-- Footer Row 2: Two Columns (Left: Legal | Right: Help) -->
                      <tr>
                        <td colspan="2">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <!-- Column 1: Reason & Legal Links -->
                              <td width="56%" valign="top" class="mobile-stack-col" style="padding-right: 16px;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                  <tr>
                                    <td width="24" valign="top" style="padding-top: 1px;">
                                      <img src="${EMAIL_ASSETS.ICON_EMAIL}" alt="" width="19" height="19" style="width: 19px; height: 19px; display: block; border: 0;" />
                                    </td>
                                    <td valign="top" style="padding-left: 10px;">
                                      <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 12.5px; line-height: 18px; color: ${EMAIL_COLORS.TEXT_FOOTER}; margin-bottom: 6px;">
                                        ${options.customFooterText || "You're receiving this email because you joined or interacted with Knotnex."}
                                      </div>
                                      <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 11.5px; line-height: 17px; color: ${EMAIL_COLORS.TEXT_FOOTER_LINK};">
                                        <a href="${EMAIL_LINKS.PRIVACY}" class="footer-link" style="color: ${EMAIL_COLORS.TEXT_FOOTER_LINK}; text-decoration: underline;">Privacy Policy</a> &nbsp;|&nbsp;
                                        <a href="${EMAIL_LINKS.TERMS}" class="footer-link" style="color: ${EMAIL_COLORS.TEXT_FOOTER_LINK}; text-decoration: underline;">Terms of Use</a> &nbsp;|&nbsp;
                                        <a href="${EMAIL_LINKS.ACCESSIBILITY}" class="footer-link" style="color: ${EMAIL_COLORS.TEXT_FOOTER_LINK}; text-decoration: underline;">Accessibility</a>
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>

                              <!-- Column 2: Need Help & Support Links -->
                              <td width="44%" valign="top" align="right" class="mobile-stack-col" style="padding-left: 12px;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="display: inline-table;" class="mobile-center-table">
                                  <tr>
                                    <td width="24" valign="top" style="padding-top: 1px;">
                                      <img src="${EMAIL_ASSETS.ICON_SUPPORT}" alt="" width="19" height="19" style="width: 19px; height: 19px; display: block; border: 0;" />
                                    </td>
                                    <td valign="top" align="left" style="padding-left: 10px;">
                                      <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13.5px; font-weight: 700; line-height: 18px; color: ${EMAIL_COLORS.TEXT_FOOTER}; margin-bottom: 4px;">
                                        Need help?
                                      </div>
                                      <div style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 12px; line-height: 18px; color: ${EMAIL_COLORS.TEXT_FOOTER};">
                                        Visit <a href="${EMAIL_LINKS.HELP}" class="footer-link" style="color: ${EMAIL_COLORS.TEXT_FOOTER_LINK}; text-decoration: underline; font-weight: 600;">Help &amp; Support</a> or <a href="${EMAIL_LINKS.CONTACT}" class="footer-link" style="color: ${EMAIL_COLORS.TEXT_FOOTER_LINK}; text-decoration: underline; font-weight: 600;">Contact Us</a>
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Divider 2 -->
                      <tr>
                        <td colspan="2" style="padding: 18px 0 18px 0;">
                          <div style="border-top: 1px solid ${EMAIL_COLORS.BORDER_DIVIDER}; height: 1px; line-height: 1px; font-size: 1px;">&nbsp;</div>
                        </td>
                      </tr>

                      <!-- Footer Row 3: Tagline Quote -->
                      <tr>
                        <td colspan="2" align="center" style="padding-bottom: 18px;">
                          <div class="tagline-text" style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 20px; line-height: 27px; text-align: center;">
                            <span style="color: #A186F3; font-weight: 500;">&ldquo;Stay connected with</span>
                            <span style="color: #6235E9; font-weight: 700;"> what matters to you, every day&rdquo;</span>
                          </div>
                        </td>
                      </tr>

                      <!-- Footer Row 4: Store Badges -->
                      <tr>
                        <td colspan="2" align="center" style="padding-bottom: 20px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="app-badges-table">
                            <tr>
                              <!-- Google Play Badge -->
                              <td align="center" class="badge-cell" style="padding: 0 8px;">
                                <a href="${EMAIL_LINKS.GOOGLE_PLAY}" target="_blank" class="store-badge-link" style="text-decoration: none; display: inline-block;">
                                  <img src="${EMAIL_ASSETS.BTN_GOOGLE_PLAY}" alt="Get it on Google Play" width="162" height="46" style="width: 162px; height: 46px; display: block; border: 0; border-radius: 9px; box-shadow: 0 2px 8px rgba(48, 56, 142, 0.08);" />
                                </a>
                              </td>

                              <!-- App Store Badge -->
                              <td align="center" class="badge-cell" style="padding: 0 8px;">
                                <a href="${EMAIL_LINKS.APP_STORE}" target="_blank" class="store-badge-link" style="text-decoration: none; display: inline-block;">
                                  <img src="${EMAIL_ASSETS.BTN_APP_STORE}" alt="Download on the App Store" width="162" height="46" style="width: 162px; height: 46px; display: block; border: 0; border-radius: 9px; box-shadow: 0 2px 8px rgba(48, 56, 142, 0.08);" />
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Footer Row 5: Copyright -->
                      <tr>
                        <td colspan="2" align="center" style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 12px; line-height: 16px; color: ${EMAIL_COLORS.TEXT_BODY}; text-align: center;">
                          &copy; ${currentYear} Knotnex. All rights reserved.
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    html,
    text: htmlToPlainText(html),
  };
}

/**
 * Renders OTP digit blocks matching the KnotNex purple gradient design.
 */
export function renderOtpBoxes(otp: string): string {
  const digits = String(otp).trim().split('');
  return `
    <div style="text-align: center; margin: 28px 0 20px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
        <tr>
          ${digits
            .map(
              (d) => `
            <td style="padding: 0 5px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" valign="middle" class="otp-digit-box" style="
                    width: 52px;
                    height: 60px;
                    background: ${EMAIL_COLORS.PRIMARY} linear-gradient(135deg, ${EMAIL_COLORS.PRIMARY_GRADIENT_START} 0%, ${EMAIL_COLORS.PRIMARY_GRADIENT_END} 100%);
                    border-radius: 12px;
                    font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif;
                    font-size: 30px;
                    font-weight: 800;
                    color: #FFFFFF;
                    box-shadow: 0 4px 14px rgba(99, 54, 235, 0.35);
                    text-align: center;
                  ">
                    ${escapeHtml(d)}
                  </td>
                </tr>
              </table>
            </td>
          `
            )
            .join('')}
        </tr>
      </table>
      <div style="margin-top: 14px; font-family: 'Google Sans', 'Plus Jakarta Sans', monospace; font-size: 14px; letter-spacing: 5px; font-weight: 700; color: ${EMAIL_COLORS.TEXT_MUTED};">
        ${escapeHtml(otp)}
      </div>
    </div>
  `;
}

/**
 * Renders a structured info card for key/value metadata (e.g. event details, application info).
 */
export function renderInfoCard(
  items: Array<{ label: string; value: string; icon?: string }>,
  options?: { borderColor?: string; bgColor?: string }
): string {
  const border = options?.borderColor || '#E0E7FF';
  const bg = options?.bgColor || '#F8FAFF';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${bg}; border: 1px solid ${border}; border-radius: 16px; margin: 20px 0;">
      <tr>
        <td style="padding: 18px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${items
              .map(
                (item, index) => `
              <tr>
                <td valign="top" style="padding: ${index === 0 ? '0 0 10px 0' : '10px 0'}; ${index > 0 ? `border-top: 1px dashed ${border};` : ''}">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; color: ${EMAIL_COLORS.TEXT_MUTED};">
                        ${escapeHtml(item.label)}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 15px; line-height: 22px; font-weight: 600; color: ${EMAIL_COLORS.TEXT_HEADING}; padding-top: 2px;">
                        ${item.icon ? `${item.icon} ` : ''}${escapeHtml(item.value)}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            `
              )
              .join('')}
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Notice card with color-coded side accent
 */
export function renderCallout(
  text: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): string {
  let borderColor: string = EMAIL_COLORS.PRIMARY;
  let bgColor: string = '#F5F3FF';
  let textColor: string = '#4338CA';
  let icon: string = 'ℹ️';

  if (type === 'success') {
    borderColor = EMAIL_COLORS.SUCCESS_BORDER;
    bgColor = EMAIL_COLORS.SUCCESS_BG;
    textColor = EMAIL_COLORS.SUCCESS_TEXT;
    icon = '✅';
  } else if (type === 'warning') {
    borderColor = EMAIL_COLORS.WARNING_BORDER;
    bgColor = EMAIL_COLORS.WARNING_BG;
    textColor = EMAIL_COLORS.WARNING_TEXT;
    icon = '⏱️';
  } else if (type === 'error') {
    borderColor = EMAIL_COLORS.ERROR_BORDER;
    bgColor = EMAIL_COLORS.ERROR_BG;
    textColor = EMAIL_COLORS.ERROR_TEXT;
    icon = '⚠️';
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 0 12px 12px 0; margin: 18px 0;">
      <tr>
        <td style="padding: 14px 18px; font-family: 'Google Sans', 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13.5px; line-height: 20px; color: ${textColor}; font-weight: 500;">
          <span style="margin-right: 6px;">${icon}</span> ${text}
        </td>
      </tr>
    </table>
  `;
}

