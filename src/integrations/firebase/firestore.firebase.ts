import { firestore } from '../../config/firebase';
import { COLLECTIONS } from '../../config/firestore';
import { logger } from '../../config/logger';

export class FirestoreIntegration {
  static async updateUserPresence(userId: string, isOnline: boolean, device: string = 'mobile') {
    try {
      await firestore.collection(COLLECTIONS.PRESENCE).doc(userId).set({
        isOnline,
        lastSeen: new Date(),
        currentDevice: device,
      }, { merge: true });
    } catch (error: any) {
      logger.error('Failed to update user presence in Firestore', { userId, error: error.message });
    }
  }

  static async setTypingIndicator(conversationId: string, userId: string, isTyping: boolean) {
    try {
      await firestore
        .collection(COLLECTIONS.TYPING_INDICATORS)
        .doc(conversationId)
        .collection('users')
        .doc(userId)
        .set({
          isTyping,
          timestamp: new Date(),
        });
    } catch (error: any) {
      logger.error('Failed to update typing indicator', { conversationId, userId, error: error.message });
    }
  }

  static async incrementLiveNotificationBadge(userId: string, type: 'chat' | 'notification' | 'ticket') {
    try {
      const docRef = firestore.collection(COLLECTIONS.LIVE_NOTIFICATIONS).doc(userId);
      const field = type === 'chat' ? 'unreadChat' : type === 'ticket' ? 'unreadTickets' : 'unreadNotifications';
      
      const admin = await import('firebase-admin');
      await docRef.set({
        [field]: admin.firestore.FieldValue.increment(1),
        lastUpdated: new Date(),
      }, { merge: true });
    } catch (error: any) {
      logger.error('Failed to increment live badge', { userId, type, error: error.message });
    }
  }
}
