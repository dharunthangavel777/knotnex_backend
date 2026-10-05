import { auth } from '../../config/firebase';
import { logger } from '../../config/logger';

export class FirebaseAuthIntegration {
  static async verifyToken(token: string) {
    // In development or test mode, allow simulated tokens for testing without remote Firebase calls
    if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && token.startsWith('mock_firebase_')) {
      const payloadStr = token.replace('mock_firebase_', '');
      const parts = payloadStr.split(':');
      const uid = parts[0] || 'mock-user-uid';
      const email = parts[1] || `${uid}@knotnex.test`;
      const name = parts[2] || 'Test User';
      return {
        uid,
        email,
        name,
        email_verified: true,
        picture: null,
      } as any;
    }

    try {
      return await auth.verifyIdToken(token);
    } catch (error: any) {
      logger.error('Firebase token verification error', { error: error.message });
      throw error;
    }
  }

  static async setCustomUserClaims(uid: string, claims: { role: string; orgId?: string; isVerified?: boolean }) {
    if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && uid.startsWith('mock_')) {
      logger.debug('Simulated custom claims updated for test user', { uid, claims });
      return;
    }

    try {
      await auth.setCustomUserClaims(uid, claims);
      logger.info('Custom claims updated for user', { uid, claims });
    } catch (error: any) {
      logger.error('Failed to set custom claims', { uid, error: error.message });
      throw error;
    }
  }

  static async createFirebaseUser(email: string, password?: string, displayName?: string) {
    try {
      return await auth.createUser({
        email,
        password,
        displayName,
      });
    } catch (error: any) {
      logger.error('Failed to create Firebase user', { email, error: error.message });
      throw error;
    }
  }

  static async deleteFirebaseUser(uid: string) {
    try {
      await auth.deleteUser(uid);
      logger.info('Firebase user deleted', { uid });
    } catch (error: any) {
      logger.error('Failed to delete Firebase user', { uid, error: error.message });
      throw error;
    }
  }
}
