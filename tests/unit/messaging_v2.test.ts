import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeFilename,
  sanitizeFolder,
  inferAttachmentKind,
  isAllowedChatMimeAndExtension,
  verifyMagicBytes,
  maxSizeForKind,
} from '../../src/utils/media-validation.util';
import { pool } from '../../src/config/database';
import { PresenceService } from '../../src/services/presence.service';
import { ChatMessagingService } from '../../src/services/chat-messaging.service';

describe('Media Validation Utility', () => {
  test('sanitizes filenames against traversal and special chars', () => {
    assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeFilename('C:\\Users\\test\\my<doc>?.pdf'), 'my_doc_.pdf');
    assert.equal(sanitizeFilename('...'), '.');
    assert.equal(sanitizeFilename(''), 'file');
  });

  test('sanitizes folders and drops dot segments', () => {
    assert.equal(sanitizeFolder('chat/../etc/voice'), 'chat/etc/voice');
    assert.equal(sanitizeFolder('../../../', 'chat/media'), 'chat/media');
    assert.equal(sanitizeFolder('chat\\images\\2026'), 'chat/images/2026');
  });

  test('infers attachment kinds and enforces max sizes', () => {
    assert.equal(inferAttachmentKind('image/jpeg', 'pic.jpg'), 'image');
    assert.equal(inferAttachmentKind('video/mp4', 'clip.mp4'), 'video');
    assert.equal(inferAttachmentKind('audio/mp4', 'voice.m4a'), 'voice');
    assert.equal(inferAttachmentKind('application/pdf', 'doc.pdf'), 'document');
    assert.equal(maxSizeForKind('image'), 15 * 1024 * 1024);
    assert.equal(maxSizeForKind('video'), 100 * 1024 * 1024);
  });

  test('enforces MIME/extension allowlist and rejects executables', () => {
    assert.equal(isAllowedChatMimeAndExtension('image/png', 'photo.png', 'image'), true);
    assert.equal(isAllowedChatMimeAndExtension('video/mp4', 'video.mp4', 'video'), true);
    assert.equal(isAllowedChatMimeAndExtension('audio/m4a', 'note.m4a', 'voice'), true);
    assert.equal(isAllowedChatMimeAndExtension('application/pdf', 'spec.pdf', 'document'), true);
    assert.equal(isAllowedChatMimeAndExtension('application/x-msdownload', 'malware.exe', 'document'), false);
    assert.equal(isAllowedChatMimeAndExtension('text/javascript', 'payload.js', 'document'), false);
  });

  test('verifies magic bytes accurately and rejects executables/spoofed files', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const mp4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
    const ogg = Buffer.from('OggS\x00\x02\x00\x00', 'ascii');
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n', 'ascii');
    const mzExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);

    assert.equal(verifyMagicBytes(jpeg, 'image', 'image/jpeg', 'a.jpg'), true);
    assert.equal(verifyMagicBytes(png, 'image', 'image/png', 'a.png'), true);
    assert.equal(verifyMagicBytes(mp4, 'video', 'video/mp4', 'v.mp4'), true);
    assert.equal(verifyMagicBytes(ogg, 'voice', 'audio/ogg', 'a.ogg'), true);
    assert.equal(verifyMagicBytes(pdf, 'document', 'application/pdf', 'd.pdf'), true);

    assert.equal(verifyMagicBytes(mzExe, 'image', 'image/jpeg', 'evil.jpg'), false);
    assert.equal(verifyMagicBytes(elf, 'document', 'application/pdf', 'evil.pdf'), false);
    assert.equal(verifyMagicBytes(png, 'document', 'application/pdf', 'spoof.pdf'), false);
  });
});

describe('PresenceService Multi-Socket & Privacy Controls', () => {
  let originalPoolQuery: any;
  let originalPoolConnect: any;
  const userId = '11111111-1111-4111-8111-111111111111';
  const viewerId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    originalPoolQuery = pool.query;
    originalPoolConnect = pool.connect;
  });

  afterEach(() => {
    (pool as any).query = originalPoolQuery;
    (pool as any).connect = originalPoolConnect;
  });

  test('stays online across multiple sockets and goes offline only when last closes', async () => {
    (pool as any).query = async (sql: string) => {
      if (sql.includes('FROM users WHERE id =')) {
        return {
          rows: [
            {
              show_online_status: true,
              show_last_seen: true,
              read_receipts_enabled: true,
              allow_message_requests: true,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    };

    const s1 = await PresenceService.onSocketConnected(userId, 'sock-a');
    assert.equal(s1.becameOnline, true);
    assert.equal(s1.socketCount, 1);

    const s2 = await PresenceService.onSocketConnected(userId, 'sock-b');
    assert.equal(s2.becameOnline, false);
    assert.equal(s2.socketCount, 2);

    const d1 = await PresenceService.onSocketDisconnected(userId, 'sock-a');
    assert.equal(d1.becameOffline, false);
    assert.equal(PresenceService.isUserLocallyConnected(userId), true);

    const d2 = await PresenceService.onSocketDisconnected(userId, 'sock-b');
    assert.equal(d2.becameOffline, true);
    assert.ok(d2.lastSeenAt);
    assert.equal(PresenceService.isUserLocallyConnected(userId), false);
  });

  test('enforces privacy flags and block hiding in presence snapshots', async () => {
    const hiddenOnlineId = '33333333-3333-4333-8333-333333333333';
    const hiddenLastSeenId = '44444444-4444-4444-8444-444444444444';
    const blockedId = '55555555-5555-4555-8555-555555555555';

    (pool as any).query = async () => ({
      rows: [
        {
          user_id: hiddenOnlineId,
          show_online_status: false,
          show_last_seen: true,
          read_receipts_enabled: true,
          raw_is_online: true,
          raw_last_seen_at: '2026-11-10T10:00:00.000Z',
          last_heartbeat_at: new Date().toISOString(),
          is_blocked: false,
        },
        {
          user_id: hiddenLastSeenId,
          show_online_status: true,
          show_last_seen: false,
          read_receipts_enabled: false,
          raw_is_online: false,
          raw_last_seen_at: '2026-11-10T10:00:00.000Z',
          last_heartbeat_at: null,
          is_blocked: false,
        },
        {
          user_id: blockedId,
          show_online_status: true,
          show_last_seen: true,
          read_receipts_enabled: true,
          raw_is_online: true,
          raw_last_seen_at: '2026-11-10T10:00:00.000Z',
          last_heartbeat_at: new Date().toISOString(),
          is_blocked: true,
        },
      ],
      rowCount: 3,
    });

    const snapshots = await PresenceService.getPresenceForUsers(viewerId, [
      hiddenOnlineId,
      hiddenLastSeenId,
      blockedId,
    ]);

    assert.equal(snapshots[hiddenOnlineId].isOnline, false);
    assert.equal(snapshots[hiddenOnlineId].lastSeenAt, '2026-11-10T10:00:00.000Z');
    assert.equal(snapshots[hiddenLastSeenId].isOnline, false);
    assert.equal(snapshots[hiddenLastSeenId].lastSeenAt, null);
    assert.equal(snapshots[hiddenLastSeenId].readReceiptsEnabled, false);
    assert.equal(snapshots[blockedId].isOnline, false);
    assert.equal(snapshots[blockedId].lastSeenAt, null);
  });
});

describe('ChatMessagingService Idempotency, Pagination, Delete & Security', () => {
  let originalPoolQuery: any;
  let originalPoolConnect: any;
  const senderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const recipientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const convId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeEach(() => {
    originalPoolQuery = pool.query;
    originalPoolConnect = pool.connect;
  });

  afterEach(() => {
    (pool as any).query = originalPoolQuery;
    (pool as any).connect = originalPoolConnect;
  });

  test('rejects local device file paths in mediaUrl or attachments', async () => {
    await assert.rejects(
      async () =>
        ChatMessagingService.sendMessageIdempotent({
          senderId,
          recipientId,
          content: '',
          messageType: 'image',
          mediaUrl: 'file:///data/user/0/com.knotnex/cache/pic.jpg',
          clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      /Media upload did not complete/i
    );

    await assert.rejects(
      async () =>
        ChatMessagingService.sendMessageIdempotent({
          senderId,
          recipientId,
          content: '',
          messageType: 'media_group',
          attachments: [
            { attachmentType: 'image', mediaUrl: '/storage/emulated/0/DCIM/Camera/IMG_1.jpg' },
          ],
          clientMessageId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      /have not finished uploading/i
    );
  });

  test('deduplicates repeated sends sharing the same clientMessageId without opening transaction', async () => {
    const existingMsgId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    let connectCalled = false;

    (pool as any).connect = async () => {
      connectCalled = true;
      throw new Error('Transaction should not open on pre-check duplicate');
    };

    (pool as any).query = async (sql: string) => {
      if (sql.includes('WHERE sender_id = $1 AND client_message_id = $2')) {
        return { rows: [{ id: existingMsgId }], rowCount: 1 };
      }
      if (sql.includes('WHERE m.id = $1') || sql.includes('FROM messages m')) {
        return {
          rows: [
            {
              id: existingMsgId,
              conversation_id: convId,
              sender_id: senderId,
              receiver_id: recipientId,
              client_message_id: 'client-uuid-123',
              content: 'Hello',
              message_type: 'text',
              send_status: 'sent',
              is_read: false,
              is_delivered: false,
              attachments_json: [],
              reactions_json: [],
              created_at: new Date('2026-11-12T05:00:00.000Z'),
              sender_name: 'Alice',
              sender_username: 'alice',
              sender_is_verified: false,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };

    const result = await ChatMessagingService.sendMessageIdempotent({
      senderId,
      conversationId: convId,
      content: 'Hello',
      messageType: 'text',
      clientMessageId: 'client-uuid-123',
    });

    assert.equal(connectCalled, false);
    assert.equal(result.deduplicated, true);
    assert.equal(result.message?.id, existingMsgId);
    assert.equal(result.message?.clientMessageId, 'client-uuid-123');
  });

  test('rejects send when users are blocked in blocked_users', async () => {
    const mockClient = {
      query: async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('FROM conversations WHERE id = $1')) {
          return {
            rows: [
              {
                id: convId,
                participant_one: senderId,
                participant_two: recipientId,
                status: 'ACCEPTED',
                initiator_id: senderId,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM blocked_users')) {
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };

    (pool as any).connect = async () => mockClient;
    (pool as any).query = async () => ({ rows: [], rowCount: 0 });

    await assert.rejects(
      async () =>
        ChatMessagingService.sendMessageIdempotent({
          senderId,
          conversationId: convId,
          content: 'Blocked hi',
          clientMessageId: 'client-uuid-blocked',
        }),
      (err: any) => err.statusCode === 403 && /restricted/i.test(err.message)
    );
  });

  test('enforces 60-minute sender window on deleteMessage(scope="everyone")', async () => {
    const oldCreatedAt = new Date(Date.now() - 61 * 60 * 1000);
    const msgId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

    (pool as any).query = async () => ({
      rows: [
        {
          id: msgId,
          conversation_id: convId,
          sender_id: senderId,
          participant_one: senderId,
          participant_two: recipientId,
          created_at: oldCreatedAt,
        },
      ],
      rowCount: 1,
    });

    await assert.rejects(
      async () => ChatMessagingService.deleteMessage(msgId, recipientId, 'everyone'),
      (err: any) => err.statusCode === 403 && /Only the sender/i.test(err.message)
    );

    await assert.rejects(
      async () => ChatMessagingService.deleteMessage(msgId, senderId, 'everyone'),
      (err: any) => err.statusCode === 403 && /60 minutes/i.test(err.message)
    );
  });

  test('paginates messages oldest-to-newest and computes composite nextCursor', async () => {
    const m3 = '00000000-0000-4000-8000-000000000003';
    const m2 = '00000000-0000-4000-8000-000000000002';
    const m1 = '00000000-0000-4000-8000-000000000001';
    const t3 = new Date('2026-11-12T05:03:00.000Z');
    const t2 = new Date('2026-11-12T05:02:00.000Z');
    const t1 = new Date('2026-11-12T05:01:00.000Z');

    (pool as any).query = async (sql: string) => {
      if (sql.includes('FROM conversations')) {
        return {
          rows: [
            {
              id: convId,
              participant_one: senderId,
              participant_two: recipientId,
              status: 'ACCEPTED',
              initiator_id: senderId,
              muted_by: [],
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM users u')) {
        if (sql.includes('WHERE u.id = $1')) {
          return {
            rows: [{ id: recipientId, full_name: 'Bob', username: 'bob', is_verified: true }],
            rowCount: 1,
          };
        }
        return {
          rows: [
            {
              user_id: recipientId,
              show_online_status: true,
              show_last_seen: true,
              read_receipts_enabled: true,
              raw_is_online: true,
              raw_last_seen_at: null,
              last_heartbeat_at: new Date().toISOString(),
              is_blocked: false,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM conversation_participants')) {
        return { rows: [{ unread_count: 1, is_muted: false }], rowCount: 1 };
      }
      if (sql.includes('FROM messages m')) {
        // DB returns DESC order: limit+1 (3 rows for limit=2) -> hasMore=true
        return {
          rows: [
            {
              id: m3,
              conversation_id: convId,
              sender_id: recipientId,
              receiver_id: senderId,
              content: 'newest',
              message_type: 'text',
              send_status: 'sent',
              is_read: false,
              attachments_json: [],
              reactions_json: [],
              created_at: t3,
            },
            {
              id: m2,
              conversation_id: convId,
              sender_id: senderId,
              receiver_id: recipientId,
              content: 'middle',
              message_type: 'text',
              send_status: 'delivered',
              is_read: false,
              attachments_json: [],
              reactions_json: [],
              created_at: t2,
            },
            {
              id: m1,
              conversation_id: convId,
              sender_id: senderId,
              receiver_id: recipientId,
              content: 'older extra row',
              message_type: 'text',
              send_status: 'seen',
              is_read: true,
              attachments_json: [],
              reactions_json: [],
              created_at: t1,
            },
          ],
          rowCount: 3,
        };
      }
      return { rows: [], rowCount: 0 };
    };

    const page = await ChatMessagingService.getConversationMessagesPaginated(senderId, convId, { limit: 2 });
    assert.equal(page.hasMore, true);
    assert.equal(page.messages.length, 2);
    assert.equal(page.messages[0].id, m2);
    assert.equal(page.messages[1].id, m3);
    assert.equal(page.nextCursor, `${t2.toISOString()}::${m2}`);
    assert.equal(page.firstUnreadMessageId, m3);
  });
});

