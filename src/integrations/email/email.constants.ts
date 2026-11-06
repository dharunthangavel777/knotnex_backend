/**
 * KnotNex Centralized Email Constants & Google Cloud Storage Assets
 * Production Bucket: knotnex-media-prod (asia-south1)
 * Public Access: https://storage.googleapis.com/knotnex-media-prod/email/
 */

export const GCS_EMAIL_BASE_URL = 'https://storage.googleapis.com/knotnex-media-prod/email';

export const EMAIL_ASSETS = {
  // Main Brand Logos & Banners
  LOGO: `${GCS_EMAIL_BASE_URL}/knotnex-logo.png`,
  BANNER: `${GCS_EMAIL_BASE_URL}/banner.png`,

  // Social Media Icons (Verified 200 OK on GCS)
  ICON_INSTAGRAM: `${GCS_EMAIL_BASE_URL}/icon-instagram.svg`,
  ICON_LINKEDIN: `${GCS_EMAIL_BASE_URL}/icon-linkedin.svg`,
  ICON_FACEBOOK: `${GCS_EMAIL_BASE_URL}/icon-facebook.svg`,
  ICON_YOUTUBE: `${GCS_EMAIL_BASE_URL}/icon-youtube.svg`,

  // Utility & Support Icons
  ICON_EMAIL: `${GCS_EMAIL_BASE_URL}/icon-email.svg`,
  ICON_SUPPORT: `${GCS_EMAIL_BASE_URL}/icon-support.svg`,

  // App Store Download Badges
  BTN_GOOGLE_PLAY: `${GCS_EMAIL_BASE_URL}/btn-google-play.svg`,
  BTN_APP_STORE: `${GCS_EMAIL_BASE_URL}/btn-app-store.svg`,
} as const;

export const EMAIL_LINKS = {
  WEBSITE: 'https://knotnex.com',
  USER_APP: 'https://app.knotnex.com',
  ORG_PORTAL: 'https://org.knotnex.com',
  ADMIN_PORTAL: 'https://admin.knotnex.com',
  APP_STORE: 'https://apps.apple.com/app/knotnex',
  GOOGLE_PLAY: 'https://play.google.com/store/apps/details?id=com.knotnex.app',
  INSTAGRAM: 'https://instagram.com/knotnex',
  LINKEDIN: 'https://linkedin.com/company/knotnex',
  FACEBOOK: 'https://facebook.com/knotnex',
  YOUTUBE: 'https://youtube.com/@knotnex',
  PRIVACY: 'https://knotnex.com/privacy',
  TERMS: 'https://knotnex.com/terms',
  ACCESSIBILITY: 'https://knotnex.com/accessibility',
  HELP: 'https://knotnex.com/help',
  SUPPORT: 'https://knotnex.com/help',
  CONTACT: 'https://knotnex.com/contact',
  SUPPORT_EMAIL: 'support@knotnex.com',
  ADMIN_EMAIL: 'knotnex.developer@gmail.com',
} as const;

export const EMAIL_COLORS = {
  PRIMARY: '#6336EB',
  PRIMARY_GRADIENT_START: '#6B3BF7',
  PRIMARY_GRADIENT_END: '#4E1ED4',
  BACKGROUND: '#F8F9FC',
  CARD_BG: '#FFFFFF',
  CARD_BORDER: '#D9DCF3',
  GREETING_BG: '#FAFAFE',
  TEXT_HEADING: '#272E38',
  TEXT_BODY: '#4F5A68',
  TEXT_MUTED: '#717D8A',
  TEXT_FOOTER: '#3D4695',
  TEXT_FOOTER_LINK: '#313B90',
  BORDER_DIVIDER: '#E2E6F3',
  SUCCESS_BG: '#ECFDF5',
  SUCCESS_BORDER: '#10B981',
  SUCCESS_TEXT: '#065F46',
  WARNING_BG: '#FEF3C7',
  WARNING_BORDER: '#F59E0B',
  WARNING_TEXT: '#92400E',
  ERROR_BG: '#FEF2F2',
  ERROR_BORDER: '#EF4444',
  ERROR_TEXT: '#991B1B',
} as const;

