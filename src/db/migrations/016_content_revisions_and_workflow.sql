-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 016_content_revisions_and_workflow.sql
-- Description: Unified Content Revision, Edit & Approval Lifecycle for Events, Jobs & Schemes
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add revision tracking columns to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30) DEFAULT 'published';
ALTER TABLE events ADD COLUMN IF NOT EXISTS current_version INT DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_pending_revision BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Add revision tracking columns to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30) DEFAULT 'open';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_version INT DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_pending_revision BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Add revision tracking columns to schemes
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30) DEFAULT 'active';
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS current_version INT DEFAULT 1;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS has_pending_revision BOOLEAN DEFAULT FALSE;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. Create content_revisions table
CREATE TABLE IF NOT EXISTS content_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL, -- 'event', 'job', 'scheme'
    entity_id UUID NOT NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    changes JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'
    rejection_reason TEXT,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_revisions_entity ON content_revisions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_content_revisions_status ON content_revisions(status);
CREATE INDEX IF NOT EXISTS idx_content_revisions_org ON content_revisions(org_id);
