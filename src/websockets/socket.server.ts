import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { auth as firebaseAuth } from '../config/firebase';
import { corsOptions } from '../config/cors';
import { registerChatHandlers } from './chat.handler';
import { registerPresenceHandlers } from './presence.handler';
import { logger } from '../config/logger';

export const initializeSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: corsOptions,
    path: '/socket.io',
  });

  // Socket authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split('Bearer ')[1];
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      if (process.env.NODE_ENV === 'development' && token.startsWith('mock_')) {
        socket.data.userId = '00000000-0000-0000-0000-000000000001';
        return next();
      }

      const decoded = await firebaseAuth.verifyIdToken(token);
      socket.data.userId = decoded.uid;
      return next();
    } catch (error: any) {
      logger.warn('Socket authentication rejected', { error: error.message });
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket client connected: ${socket.id}, User: ${socket.data.userId}`);

    registerChatHandlers(io, socket);
    registerPresenceHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket client disconnected: ${socket.id}, Reason: ${reason}`);
    });
  });

  return io;
};
