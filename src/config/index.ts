import dotenv from 'dotenv';
dotenv.config();

// ─── KnotNex Backend Configuration ──────────────────────────────────────────
// GCP Project: knotnex (lively-welder-512304-n4)  |  Region: asia-south1
// Architecture: Cloud Run + Cloud SQL + Cloud Storage (3-service low-cost)
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  env: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  isProduction: (process.env.APP_ENV || process.env.NODE_ENV) === 'production',
  port: parseInt(process.env.PORT || '8080', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  corsOrigins: (process.env.CORS_ORIGINS || [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'https://knotnex.com',
    'https://org.knotnex.com',
    'https://api.knotnex.com',
  ].join(',')).split(',').map((s) => s.trim()),

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:knotnex%402026@34.47.245.32:5432/knotnex_db',
    // Conservative pool: 5 instances × 5 connections = 25 max (safe for db-g1-small)
    poolMin: parseInt(process.env.DB_POOL_MIN || '1', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '5', 10),
    ssl: process.env.DB_SSL === 'true',
    autoMigrate: process.env.AUTO_RUN_MIGRATIONS !== 'false',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'knotnex-f68fd',
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './keys/knotnex-f68fd-firebase-adminsdk-fbsvc-81c9923441.json',
  },

  gcs: {
    // GCP Project: knotnex | ID: lively-welder-512304-n4
    projectId: process.env.GCS_PROJECT_ID || 'lively-welder-512304-n4',
    mediaBucket: process.env.GCS_MEDIA_BUCKET || 'knotnex-media-prod',
    privateBucket: process.env.GCS_PRIVATE_BUCKET || 'knotnex-private-prod',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    fromEmail: process.env.BREVO_FROM_EMAIL || 'knotnex.developer@gmail.com',
    fromName: process.env.BREVO_FROM_NAME || 'KnotNex Platform',
  },

  email: {
    smtpHost: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    fromEmail: process.env.EMAIL_FROM || process.env.BREVO_FROM_EMAIL || 'noreply@knotnex.com',
    fromName: process.env.EMAIL_FROM_NAME || 'KnotNex Platform',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'knotnex_jwt_secret_production_2026_super_secure_auth_key',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
