-- ─── 023_enhanced_messaging_and_requests.sql ─────────────────────────────
-- Open Messaging, Stranger Request States, and Per-User Conversation Controls
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enhance conversations table with request lifecycle and user preferences
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACCEPTED',
    ADD COLUMN IF NOT EXISTS initiator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS pinned_by UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS archived_by UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS deleted_by UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS muted_by UUID[] DEFAULT '{}';

-- 2. Indexes for fast status and request querying
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_initiator ON conversations (initiator_id);

-- 3. Ensure all existing conversations default to ACCEPTED
UPDATE conversations SET status = 'ACCEPTED' WHERE status IS NULL;

