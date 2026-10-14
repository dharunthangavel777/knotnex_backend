import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { auth as firebaseAuth } from '../config/firebase';
import { corsOptions } from '../config/cors';
import { registerChatHandlers } from './chat.handler';
import { registerPresenceHandlers } from './presence.handler';
import { registerSocialHandlers } from './social.handler';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../shared/utils/jwt.util';
import { query } from '../config/database';

let ioInstance: Server | null = null;

export const getSocketIO = (): Server | null => ioInstance;

export const initializeSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: corsOptions,
    path: '/socket.io',
  });

  ioInstance = io;

  // Socket authentication middleware supporting KnotNex JWT and Firebase ID tokens
  io.use(async (socket: Socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.split('Bearer ')[1] ||
        (socket.handshake.query?.token as string);

      if (!rawToken) {
        return next(new Error('Authentication token required'));
      }

      const token = rawToken.trim();

      // 1. Development mock token
      if (process.env.NODE_ENV === 'development' && token.startsWith('mock_')) {
        socket.data.userId = '00000000-0000-0000-0000-000000000001';
        return next();
      }

      // 2. Try KnotNex Access Token (primary for Flutter client)
      try {
        const decoded = verifyAccessToken(token);
        if (decoded && decoded.sub) {
          socket.data.userId = decoded.sub;
          socket.data.email = decoded.email;
          return next();
        }
      } catch {
        // Not a KnotNex JWT or expired, try Firebase next
      }

      // 3. Try Firebase ID Token
      try {
        const fbDecoded = await firebaseAuth.verifyIdToken(token);
        // Map Firebase UID to PostgreSQL UUID if user exists
        const userRes = await query(
          'SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1',
          [fbDecoded.uid]
        );
        socket.data.userId = userRes.rows[0]?.id || fbDecoded.uid;
        socket.data.firebaseUid = fbDecoded.uid;
        return next();
      } catch (fbErr: any) {
        logger.warn('Socket token verification failed', { error: fbErr.message });
        return next(new Error('Authentication failed'));
      }
    } catch (error: any) {
      logger.warn('Socket authentication rejected', { error: error.message });
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`Socket client connected: ${socket.id}, User: ${userId}`);

    // Join personal user notification room
    if (userId) {
      socket.join(`user:${userId}`);
    }

    registerChatHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerSocialHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket client disconnected: ${socket.id}, Reason: ${reason}`);
    });
  });

  return io;
};

