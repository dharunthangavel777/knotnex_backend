import { Storage } from '@google-cloud/storage';
import { config } from './index';
import { logger } from './logger';

export const storage = new Storage({
  projectId: config.gcs.projectId,
});

export const mediaBucket = storage.bucket(config.gcs.mediaBucket);
export const privateBucket = storage.bucket(config.gcs.privateBucket);

logger.info('Google Cloud Storage client configured', {
  mediaBucket: config.gcs.mediaBucket,
  privateBucket: config.gcs.privateBucket,
});
