import { Server, Socket } from 'socket.io';
import { FirestoreIntegration } from '../integrations/firebase/firestore.firebase';
import { logger } from '../config/logger';

export const registerPresenceHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  if (userId) {
    FirestoreIntegration.updateUserPresence(userId, true, 'websocket');
    io.emit('presence_change', { userId, isOnline: true });
    logger.debug(`User ${userId} presence: online`);
  }

  socket.on('disconnect', () => {
    if (userId) {
      FirestoreIntegration.updateUserPresence(userId, false, 'websocket');
      io.emit('presence_change', { userId, isOnline: false });
      logger.debug(`User ${userId} presence: offline`);
    }
  });
};
