-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX DATABASE MIGRATION 006
-- Add category_selection_completed to users and create organization_verification_requests
-- ═══════════════════════════════════════════════════════════════

-- 1. Ensure category_selection_completed column exists on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_selection_completed BOOLEAN DEFAULT FALSE;

-- 2. Create organization_verification_requests table
CREATE TABLE IF NOT EXISTS organization_verification_requests (
    id                  UUID PRIMARY KEY
     DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_name   VARCHAR(255) NOT NULL,
    category            VARCHAR(100) NOT NULL,
    organization_email  VARCHAR(255) NOT NULL,
    phone               VARCHAR(20) NOT NULL,
    website             VARCHAR(500),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for quick admin lookup & user status queries
CREATE INDEX IF NOT EXISTS idx_org_verifications_user ON organization_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_org_verifications_status ON organization_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_org_verifications_created ON organization_verification_requests(created_at DESC);

