import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './index';
import { logger } from './logger';

let firebaseApp: admin.app.App;

try {
  const keyPath = path.resolve(process.cwd(), config.firebase.serviceAccountKey);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: config.firebase.projectId,
    });
    logger.info('Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT_JSON env variable');
  } else if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: config.firebase.projectId,
    });
    logger.info('Firebase Admin SDK initialized with Service Account Key');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: config.firebase.projectId,
    });
    logger.info('Firebase Admin SDK initialized with Application Default Credentials');
  } else {
    // Fallback initialize for dev/mock mode
    firebaseApp = admin.initializeApp({
      projectId: config.firebase.projectId,
    });
    logger.warn('Firebase Admin SDK initialized with project ID only (no credential file found)');
  }
} catch (error: any) {
  logger.error('Failed to initialize Firebase Admin SDK', { error: error.message });
  // Initialize fallback default app if none exists
  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0]!;
  } else {
    firebaseApp = admin.initializeApp();
  }
}

export const firebaseAdmin = admin;
export const auth = admin.auth();
export const firestore = admin.firestore();
export const messaging = admin.messaging();
export default firebaseApp;
