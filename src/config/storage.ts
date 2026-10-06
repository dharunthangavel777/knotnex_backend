import { Storage } from '@google-cloud/storage';
import { config } from './index';
import { logger } from './logger';

import path from 'path';
import fs from 'fs';

let credentials: any = undefined;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (_) {}
}

const keyPath = config.firebase.serviceAccountKey
  ? path.resolve(process.cwd(), config.firebase.serviceAccountKey)
  : null;

export const storage = new Storage({
  projectId: config.gcs.projectId,
  ...(credentials
    ? { credentials }
    : keyPath && fs.existsSync(keyPath)
    ? { keyFilename: keyPath }
    : {}),
});

export const mediaBucket = storage.bucket(config.gcs.mediaBucket);
export const privateBucket = storage.bucket(config.gcs.privateBucket);

logger.info('Google Cloud Storage client configured', {
  mediaBucket: config.gcs.mediaBucket,
  privateBucket: config.gcs.privateBucket,
});
