-- ─── 020_complete_messaging_and_fcm.sql ──────────────────────────────────────────
-- Production Real-time Messaging, Reactions, Delivery Status & Multi-Device FCM Tokens
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure messages table exists and enhance with delivery receipts, soft deletion, and threaded replies
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(30) DEFAULT 'text',
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages 
    ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_delivered ON messages (receiver_id, is_delivered) WHERE is_delivered = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages (conversation_id, is_deleted);

-- 2. Message Emoji Reactions Table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_message_user_reaction UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON message_reactions (user_id);

-- 3. Blocked Users Table (Peer-to-peer and Org communication protection)
CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_diff_blocked CHECK (blocker_id <> blocked_id),
    CONSTRAINT uq_blocker_blocked_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users (blocked_id);

-- 4. Reported Messages Table for Admin Moderation
CREATE TABLE IF NOT EXISTS reported_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reported_messages_status ON reported_messages (status, created_at DESC);

-- 5. Multi-Device FCM Tokens Table for Android, iOS & Web
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT,
    platform VARCHAR(20) DEFAULT 'android',
    device_id TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all new columns exist if user_devices was previously created in migration 001
ALTER TABLE user_devices
    ADD COLUMN IF NOT EXISTS fcm_token TEXT,
    ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'android',
    ADD COLUMN IF NOT EXISTS device_id TEXT,
    ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_fcm_token'
    ) THEN
        ALTER TABLE user_devices ADD CONSTRAINT uq_user_fcm_token UNIQUE (user_id, fcm_token);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_devices_user_active ON user_devices (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_devices_token ON user_devices (fcm_token);

-- 6. Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    messages BOOLEAN DEFAULT TRUE,
    reactions BOOLEAN DEFAULT TRUE,
    comments BOOLEAN DEFAULT TRUE,
    followers BOOLEAN DEFAULT TRUE,
    events BOOLEAN DEFAULT TRUE,
    careers BOOLEAN DEFAULT TRUE,
    schemes BOOLEAN DEFAULT TRUE,
    system_alerts BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate default preferences for existing users if missing
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

