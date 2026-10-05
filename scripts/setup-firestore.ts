import { firestore } from '../src/config/firebase';
import { COLLECTIONS } from '../src/config/firestore';

async function setupFirestore() {
  console.log('Initializing Firestore collections structure...');
  
  // Create an initial metadata document in live_notifications to warm up collection
  const initRef = firestore.collection(COLLECTIONS.LIVE_NOTIFICATIONS).doc('_meta');
  await initRef.set({
    initializedAt: new Date(),
    status: 'ready',
    version: '1.0.0',
  });

  console.log('Firestore collections initialized successfully.');
}

setupFirestore()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Firestore setup failed:', err);
    process.exit(1);
  });
