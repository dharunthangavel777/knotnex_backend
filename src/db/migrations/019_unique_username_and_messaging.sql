-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX DATABASE MIGRATION 019
-- Case-Insensitive Unique Usernames, Organization Slugs,
-- Follower Integrity & Real-Time Messaging Support
-- ═══════════════════════════════════════════════════════════════

-- 1. Ensure username exists on users with 3-10 lowercase alphanumeric format
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(20);

-- Standardize existing usernames to lowercase trimmed
UPDATE users SET username = LOWER(TRIM(username)) WHERE username IS NOT NULL;

-- Case-insensitive unique index on users.username
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
ON users (LOWER(username))
WHERE username IS NOT NULL AND username <> '';

-- 2. Ensure slug exists on organizations and standardize
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug VARCHAR(100);

UPDATE organizations SET slug = LOWER(TRIM(slug)) WHERE slug IS NOT NULL;

-- Case-insensitive unique index on organizations.slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug_lower
ON organizations (LOWER(slug))
WHERE slug IS NOT NULL AND slug <> '';

-- 3. Follower Integrity & Deduplication
-- Remove any self-follows or duplicates before adding constraints
DELETE FROM user_followers WHERE follower_id = following_id;

-- Add check constraint to prevent self-follows
ALTER TABLE user_followers DROP CONSTRAINT IF EXISTS chk_no_self_follow;
ALTER TABLE user_followers ADD CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id);

-- Ensure unique follower-following pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_followers_pair
ON user_followers (follower_id, following_id);

-- 4. Messaging Tables for Cloud SQL Persistence & Hybrid Backup
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_one UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_two UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_by UUID REFERENCES users(id) ON DELETE SET NULL,
    unread_count_one INT DEFAULT 0,
    unread_count_two INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_diff_participants CHECK (participant_one <> participant_two)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_participants_pair
ON conversations (LEAST(participant_one, participant_two), GREATEST(participant_one, participant_two));

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations (participant_one);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations (participant_two);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg_at ON conversations (last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(30) DEFAULT 'text',
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (receiver_id, is_read) WHERE is_read = FALSE;

