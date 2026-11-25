import { Storage } from '@google-cloud/storage';
import { config } from './index';
import { logger } from './logger';

import path from 'path';
import fs from 'fs';

let credentials: any = undefined;
let credentialSource = 'Application Default Credentials (ADC)';

if (process.env.GCS_SERVICE_ACCOUNT_JSON) {
  try {
    const parsed = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_JSON);
    if (parsed.client_email && parsed.private_key) {
      credentials = parsed;
      credentialSource = `GCS_SERVICE_ACCOUNT_JSON (${parsed.client_email})`;
    }
  } catch (err: any) {
    logger.warn('[Storage] Failed to parse GCS_SERVICE_ACCOUNT_JSON: ' + err.message);
  }
}

const rawFirebaseJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim().startsWith('{')
    ? process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim()
    : null);

if (!credentials && rawFirebaseJson) {
  try {
    const parsed = JSON.parse(rawFirebaseJson);
    if (parsed.client_email && parsed.private_key) {
      credentials = parsed;
      credentialSource = `FIREBASE_SERVICE_ACCOUNT (${parsed.client_email})`;
    }
  } catch (err: any) {
    logger.warn('[Storage] Failed to parse Firebase service account JSON: ' + err.message);
  }
}

const keyPath = config.firebase.serviceAccountKey
  ? path.resolve(process.cwd(), config.firebase.serviceAccountKey)
  : null;

if (!credentials && keyPath && fs.existsSync(keyPath)) {
  credentialSource = `keyPath (${keyPath})`;
}

// Primary Storage client (uses configured credentials or key file)
export const storage = new Storage({
  projectId: config.gcs.projectId,
  ...(credentials
    ? { credentials }
    : keyPath && fs.existsSync(keyPath)
    ? { keyFilename: keyPath }
    : {}),
});

// Secondary fallback Storage client using pure Application Default Credentials (ADC).
// On Google Cloud Run, Cloud Run's native runtime environment has ADC using the Compute Engine
// default service account, which natively belongs to project lively-welder-512304-n4!
export const adcStorage = new Storage({
  projectId: config.gcs.projectId,
});

export const mediaBucket = storage.bucket(config.gcs.mediaBucket);
export const privateBucket = storage.bucket(config.gcs.privateBucket);

logger.info('[Storage] Google Cloud Storage configured', {
  projectId: config.gcs.projectId,
  mediaBucket: config.gcs.mediaBucket,
  privateBucket: config.gcs.privateBucket,
  credentialSource,
  hasAdcFallback: true,
});
