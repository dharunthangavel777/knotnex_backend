import { firestore } from './firebase';

export const db = firestore;

// Firestore Collection Names for Real-Time Domain
export const COLLECTIONS = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  PRESENCE: 'presence',
  TYPING_INDICATORS: 'typing_indicators',
  LIVE_NOTIFICATIONS: 'live_notifications',
} as const;

export default db;
