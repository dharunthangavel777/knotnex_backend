import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:8080').split(','),

  database: {
    url: process.env.DATABASE_URL || 'postgresql://knotnex_user:knotnex_password@localhost:5432/knotnex_db',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    ssl: process.env.DB_SSL === 'true',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'knotnex-dev',
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './keys/firebase-sa.json',
  },

  gcs: {
    mediaBucket: process.env.GCS_MEDIA_BUCKET || 'knotnex-media-dev',
    privateBucket: process.env.GCS_PRIVATE_BUCKET || 'knotnex-private-dev',
    projectId: process.env.GCS_PROJECT_ID || 'knotnex-dev',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    fromEmail: process.env.BREVO_FROM_EMAIL || 'noreply@knotnex.com',
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

  pubsub: {
    projectId: process.env.PUBSUB_PROJECT_ID || 'knotnex-dev',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'knotnex_secret_fallback_key',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
