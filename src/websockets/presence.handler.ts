import { Server, Socket } from 'socket.io';
import { PresenceService } from '../services/presence.service';

export const registerPresenceHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId as string | undefined;

  if (userId) {
    PresenceService.onSocketConnected(userId, socket.id)
      .then((res) => {
        if (res.becameOnline && res.showOnlineStatus) {
          io.emit('presence_change', {
            userId,
            isOnline: true,
            lastSeenAt: null,
          });
        }
      })
      .catch(() => {});
  }

  socket.on('presence_heartbeat', () => {
    if (userId) {
      PresenceService.onHeartbeat(userId).catch(() => {});
    }
  });

  socket.on(
    'presence_query',
    async (
      data: { userIds?: string[] },
      ack?: (resp: { ok: boolean; presence?: Record<string, any> }) => void
    ) => {
      if (!userId || !Array.isArray(data?.userIds)) {
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }
      try {
        const presence = await PresenceService.getPresenceForUsers(userId, data.userIds);
        if (typeof ack === 'function') ack({ ok: true, presence });
      } catch {
        if (typeof ack === 'function') ack({ ok: false });
      }
    }
  );

  socket.on('disconnect', () => {
    if (userId) {
      PresenceService.onSocketDisconnected(userId, socket.id)
        .then((res) => {
          if (res.becameOffline) {
            io.emit('presence_change', {
              userId,
              isOnline: false,
              lastSeenAt: res.lastSeenAt,
              hidden: !res.showOnlineStatus && !res.showLastSeen,
            });
          }
        })
        .catch(() => {});
    }
  });
};
