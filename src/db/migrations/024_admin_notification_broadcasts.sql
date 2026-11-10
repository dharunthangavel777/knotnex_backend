-- ─── 024_admin_notification_broadcasts.sql ──────────────────────────────────
-- Full Push Notification Broadcast System for KnotNex Admin Management
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    image_url TEXT,
    category VARCHAR(50) DEFAULT 'announcement', -- 'announcement', 'update', 'alert', 'promotional', 'system'
    priority VARCHAR(20) DEFAULT 'normal',      -- 'normal', 'high', 'urgent'
    deep_link TEXT,                             -- e.g. 'knotnex://events/123', 'knotnex://feed'
    action_label VARCHAR(100),                  -- e.g. 'Check Details', 'Explore Now'
    target_audience VARCHAR(50) DEFAULT 'all',  -- 'all', 'users', 'organizations', 'custom'
    target_criteria JSONB DEFAULT '{}'::jsonb,  -- filter tags, cities, user IDs, roles
    is_mandatory BOOLEAN DEFAULT FALSE,         -- ignores user mute preferences if true (critical alerts)
    status VARCHAR(30) DEFAULT 'draft',         -- 'draft', 'scheduled', 'processing', 'sent', 'failed', 'cancelled'
    total_targeted INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    total_read INT DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(150),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON notification_broadcasts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled ON notification_broadcasts (scheduled_at) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS notification_broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID NOT NULL REFERENCES notification_broadcasts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT,
    platform VARCHAR(20) DEFAULT 'android',
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'skipped'
    fcm_message_id TEXT,
    error_message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipients_broadcast_status ON notification_broadcast_recipients (broadcast_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_user ON notification_broadcast_recipients (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_recipients_fcm_token ON notification_broadcast_recipients (fcm_token);
