-- ═══════════════════════════════════════════════════════════════════════════
-- KNOTNEX DATABASE MIGRATION 025
-- Messaging V2: Idempotency, Grouped Attachments, Presence & Privacy,
-- Per-User Participant Ledgers, Visibility Masking, and Full-Text Search
-- Non-destructive: preserves all existing conversations, messages, reactions.
-- ═══════════════════════════════════════════════════════════════════════════

-- Attempt pg_trgm if cluster privileges permit (safe subtransaction block)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ─── 1. USER MESSAGING PRIVACY SETTINGS ─────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_last_seen BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_message_requests BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── 2. AUTHORITATIVE USER PRESENCE & LAST SEEN ─────────────────────────────
CREATE TABLE IF NOT EXISTS user_presence (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online           BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at        TIMESTAMPTZ,
    active_socket_count INTEGER NOT NULL DEFAULT 0,
    last_heartbeat_at   TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence (is_online, updated_at DESC);

INSERT INTO user_presence (user_id, is_online, last_seen_at, active_socket_count, updated_at)
SELECT
    u.id,
    FALSE,
    COALESCE(u.updated_at, u.created_at, NOW()),
    0,
    NOW()
FROM users u
ON CONFLICT (user_id) DO NOTHING;

-- ─── 3. MESSAGES TABLE HARDENING (IDEMPOTENCY, STATUS, FORWARD, SEARCH) ─────
-- Relax any legacy inline CHECK constraint on messages.message_type so new types
-- ('video', 'media_group', 'voice', 'document', etc.) are accepted safely.
DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    FOR v_constraint IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'messages'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%message_type%'
    LOOP
        EXECUTE format('ALTER TABLE messages DROP CONSTRAINT IF EXISTS %I', v_constraint);
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

ALTER TABLE messages ALTER COLUMN message_type TYPE VARCHAR(40);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(128);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS send_status VARCHAR(24) NOT NULL DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_everyone_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_everyone_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE messages
SET deleted_for_everyone = TRUE
WHERE COALESCE(is_deleted, FALSE) = TRUE AND COALESCE(deleted_for_everyone, FALSE) = FALSE;

-- Idempotency unique key: one logical message per (sender_id, client_message_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client_id
    ON messages (sender_id, client_message_id)
    WHERE client_message_id IS NOT NULL;

-- Fast reverse-chronological cursor pagination index
CREATE INDEX IF NOT EXISTS idx_messages_conv_created_id_desc
    ON messages (conversation_id, created_at DESC, id DESC);

-- Search vector maintenance trigger
CREATE OR REPLACE FUNCTION knotnex_messages_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector(
        'simple',
        COALESCE(NEW.content, '') || ' ' ||
        COALESCE(NEW.metadata->>'caption', '') || ' ' ||
        COALESCE(NEW.metadata->>'fileName', '') || ' ' ||
        COALESCE(NEW.metadata->>'sharedTitle', '') || ' ' ||
        COALESCE(NEW.metadata->>'sharedSubtitle', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_search_vector ON messages;
CREATE TRIGGER trg_messages_search_vector
    BEFORE INSERT OR UPDATE OF content, metadata
    ON messages
    FOR EACH ROW
    EXECUTE FUNCTION knotnex_messages_search_vector_trigger();

UPDATE messages
SET search_vector = to_tsvector(
    'simple',
    COALESCE(content, '') || ' ' ||
    COALESCE(metadata->>'caption', '') || ' ' ||
    COALESCE(metadata->>'fileName', '') || ' ' ||
    COALESCE(metadata->>'sharedTitle', '') || ' ' ||
    COALESCE(metadata->>'sharedSubtitle', '')
)
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_search_vector
    ON messages USING GIN (search_vector);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
            ON messages USING GIN (content gin_trgm_ops);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ─── 4. PRIVATE MEDIA ASSET REGISTRY & NORMALIZED ATTACHMENTS ───────────────
CREATE TABLE IF NOT EXISTS chat_media_assets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    conversation_id   UUID REFERENCES conversations(id) ON DELETE CASCADE,
    attachment_type   VARCHAR(24) NOT NULL DEFAULT 'document',
    storage_provider  VARCHAR(24) NOT NULL DEFAULT 'gcs_private',
    storage_path      TEXT NOT NULL,
    thumbnail_path    TEXT,
    thumbnail_url     TEXT,
    original_filename VARCHAR(255),
    mime_type         VARCHAR(120),
    file_size_bytes   BIGINT,
    width             INTEGER,
    height            INTEGER,
    duration_ms       INTEGER,
    waveform          JSONB,
    is_private        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_media_assets_uploader ON chat_media_assets (uploader_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_attachments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id        UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    asset_id          UUID REFERENCES chat_media_assets(id) ON DELETE SET NULL,
    uploader_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    attachment_index  INTEGER NOT NULL DEFAULT 0,
    attachment_type   VARCHAR(24) NOT NULL, -- 'image', 'video', 'voice', 'audio', 'document'
    storage_provider  VARCHAR(24) NOT NULL DEFAULT 'gcs_private',
    storage_path      TEXT,
    media_url         TEXT NOT NULL,
    thumbnail_path    TEXT,
    thumbnail_url     TEXT,
    original_filename VARCHAR(255),
    mime_type         VARCHAR(120),
    file_size_bytes   BIGINT,
    width             INTEGER,
    height            INTEGER,
    duration_ms       INTEGER,
    waveform          JSONB,
    upload_status     VARCHAR(24) NOT NULL DEFAULT 'uploaded',
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_msg_order
    ON message_attachments (message_id, attachment_index ASC);

CREATE INDEX IF NOT EXISTS idx_message_attachments_conv
    ON message_attachments (conversation_id, created_at DESC);

-- Non-destructive backfill for legacy single-attachment messages
INSERT INTO message_attachments (
    message_id,
    conversation_id,
    uploader_id,
    attachment_index,
    attachment_type,
    storage_provider,
    storage_path,
    media_url,
    original_filename,
    mime_type,
    file_size_bytes,
    duration_ms,
    upload_status,
    created_at
)
SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    0,
    CASE
        WHEN m.message_type IN ('image', 'video', 'voice', 'audio', 'document') THEN m.message_type
        WHEN m.message_type = 'file' THEN 'document'
        ELSE 'image'
    END,
    CASE
        WHEN m.media_url LIKE 'https://storage.googleapis.com/%' THEN 'gcs_public'
        ELSE 'external'
    END,
    NULL,
    m.media_url,
    NULLIF(m.metadata->>'fileName', ''),
    NULLIF(m.metadata->>'mimeType', ''),
    NULLIF(regexp_replace(COALESCE(m.metadata->>'fileSize', ''), '[^0-9]', '', 'g'), '')::BIGINT,
    NULLIF(regexp_replace(COALESCE(m.metadata->>'durationMs', ''), '[^0-9]', '', 'g'), '')::INTEGER,
    'uploaded',
    m.created_at
FROM messages m
WHERE m.media_url IS NOT NULL
  AND m.media_url <> ''
  AND m.message_type IN ('image', 'video', 'voice', 'audio', 'document', 'file')
  AND NOT EXISTS (
      SELECT 1 FROM message_attachments ma WHERE ma.message_id = m.id
  );

-- ─── 5. PER-USER MESSAGE VISIBILITY ("DELETE FOR ME") ────────────────────────
CREATE TABLE IF NOT EXISTS message_user_visibility (
    message_id        UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deleted_for_me_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_msg_visibility_user
    ON message_user_visibility (user_id, message_id);

-- Backfill legacy messages.deleted_for_users (UUID[] or JSONB safe)
DO $$
DECLARE
    v_type TEXT;
BEGIN
    SELECT format_type(atttypid, atttypmod)
    INTO v_type
    FROM pg_attribute
    WHERE attrelid = 'messages'::regclass
      AND attname = 'deleted_for_users';

    IF v_type IS NOT NULL AND v_type ILIKE '%[]%' THEN
        INSERT INTO message_user_visibility (message_id, user_id)
        SELECT m.id, uid
        FROM messages m
        CROSS JOIN LATERAL unnest(m.deleted_for_users) AS uid
        JOIN users u ON u.id = uid
        ON CONFLICT DO NOTHING;
    ELSIF v_type IS NOT NULL AND v_type ILIKE 'json%' THEN
        INSERT INTO message_user_visibility (message_id, user_id)
        SELECT m.id, val::UUID
        FROM messages m
        CROSS JOIN LATERAL jsonb_array_elements_text(m.deleted_for_users) AS val
        JOIN users u ON u.id::TEXT = val
        ON CONFLICT DO NOTHING;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ─── 6. CONVERSATION PARTICIPANTS LEDGER (READ, MUTE, PIN, ARCHIVE, CLEAR) ──
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id       UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id  UUID REFERENCES messages(id) ON DELETE SET NULL,
    last_read_at          TIMESTAMPTZ,
    last_delivered_at     TIMESTAMPTZ,
    cleared_before_at     TIMESTAMPTZ,
    unread_count          INTEGER NOT NULL DEFAULT 0,
    is_muted              BOOLEAN NOT NULL DEFAULT FALSE,
    muted_until           TIMESTAMPTZ,
    is_pinned             BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived           BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user
    ON conversation_participants (user_id, is_deleted, is_archived, updated_at DESC);

-- Backfill participant_one
INSERT INTO conversation_participants (
    conversation_id, user_id, unread_count, is_muted, is_pinned, is_archived, is_deleted, joined_at, updated_at
)
SELECT
    c.id,
    c.participant_one,
    COALESCE((
        SELECT COUNT(*)::INT
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> c.participant_one
          AND COALESCE(m.is_read, FALSE) = FALSE
          AND m.read_at IS NULL
          AND COALESCE(m.deleted_for_everyone, FALSE) = FALSE
    ), 0),
    COALESCE(c.participant_one = ANY(COALESCE(c.muted_by, '{}'::uuid[])), FALSE),
    COALESCE(c.participant_one = ANY(COALESCE(c.pinned_by, '{}'::uuid[])), FALSE),
    COALESCE(c.participant_one = ANY(COALESCE(c.archived_by, '{}'::uuid[])), FALSE),
    COALESCE(c.participant_one = ANY(COALESCE(c.deleted_by, '{}'::uuid[])), FALSE),
    COALESCE(c.created_at, NOW()),
    COALESCE(c.updated_at, NOW())
FROM conversations c
WHERE c.participant_one IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Backfill participant_two
INSERT INTO conversation_participants (
    conversation_id, user_id, unread_count, is_muted, is_pinned, is_archived, is_deleted, joined_at, updated_at
)
SELECT
    c.id,
    c.participant_two,
    COALESCE((
        SELECT COUNT(*)::INT
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> c.participant_two
          AND COALESCE(m.is_read, FALSE) = FALSE
          AND m.read_at IS NULL
          AND COALESCE(m.deleted_for_everyone, FALSE) = FALSE
    ), 0),
    COALESCE(c.participant_two = ANY(COALESCE(c.muted_by, '{}'::uuid[])), FALSE),
    COALESCE(c.participant_two = ANY(COALESCE(c.pinned_by, '{}'::uuid[])), FALSE),
    COALESCE(c.participant_two = ANY(COALESCE(c.archived_by, '{}'::uuid[])), FALSE),
    COALESCE(c.participant_two = ANY(COALESCE(c.deleted_by, '{}'::uuid[])), FALSE),
    COALESCE(c.created_at, NOW()),
    COALESCE(c.updated_at, NOW())
FROM conversations c
WHERE c.participant_two IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Track delivered_at / send_status cleanly for existing read messages
UPDATE messages
SET send_status = CASE
        WHEN COALESCE(is_read, FALSE) = TRUE OR read_at IS NOT NULL THEN 'seen'
        ELSE 'sent'
    END,
    delivered_at = COALESCE(delivered_at, read_at, created_at)
WHERE send_status = 'sent' AND (COALESCE(is_read, FALSE) = TRUE OR read_at IS NOT NULL);
