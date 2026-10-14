import { Server, Socket } from 'socket.io';
import { logger } from '../config/logger';
import { getSocketIO } from './socket.server';

/**
 * Register post/social room event listeners for a connected socket client.
 */
export const registerSocialHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  // Client views a post / opens comments sheet
  socket.on('join_post', (postId: string) => {
    if (!postId) return;
    const room = `post:${postId}`;
    socket.join(room);
    logger.debug(`Socket client ${socket.id} (user ${userId}) joined ${room}`);
  });

  // Client closes comments sheet / scrolls away from post
  socket.on('leave_post', (postId: string) => {
    if (!postId) return;
    const room = `post:${postId}`;
    socket.leave(room);
    logger.debug(`Socket client ${socket.id} (user ${userId}) left ${room}`);
  });
};

/**
 * Broadcast a newly created comment in real-time to all users currently viewing the post.
 * Matches Instagram-style instantaneous comment delivery across all connected clients.
 */
export const broadcastPostComment = (postId: string, comment: any) => {
  const io = getSocketIO();
  if (!io) return;

  const room = `post:${postId}`;
  io.to(room).emit('comment:new', {
    postId,
    comment,
    timestamp: new Date().toISOString(),
  });
  logger.debug(`Broadcasted comment:new to room ${room}`, { commentId: comment.id });
};

/**
 * Broadcast real-time like/unlike/share/save interactions on a post.
 */
export const broadcastPostInteraction = (
  postId: string,
  data: {
    action: 'like' | 'unlike' | 'save' | 'share' | 'comment';
    likesCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    savesCount?: number;
    userId?: string;
  }
) => {
  const io = getSocketIO();
  if (!io) return;

  const room = `post:${postId}`;
  io.to(room).emit('post:interaction', {
    postId,
    ...data,
    timestamp: new Date().toISOString(),
  });
  logger.debug(`Broadcasted post:interaction to room ${room}`, { action: data.action });
};

/**
 * Broadcast real-time like reaction changes on a specific comment.
 */
export const broadcastCommentReaction = (
  postId: string,
  commentId: string,
  data: {
    likesCount: number;
    isLiked: boolean;
    userId: string;
  }
) => {
  const io = getSocketIO();
  if (!io) return;

  const room = `post:${postId}`;
  io.to(room).emit('comment:interaction', {
    postId,
    commentId,
    ...data,
    timestamp: new Date().toISOString(),
  });
  logger.debug(`Broadcasted comment:interaction to room ${room}`, { commentId });
};
