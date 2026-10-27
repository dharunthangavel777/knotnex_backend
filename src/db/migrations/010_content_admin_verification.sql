-- ═══════════════════════════════════════════════════════════════
-- 010_CONTENT_ADMIN_VERIFICATION.SQL
-- Multi-entity Admin Verification Workflow for Events, Jobs & Schemes
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. EVENTS VERIFICATION COLUMNS & CONSTRAINTS ───
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
    ALTER TABLE events ADD CONSTRAINT events_status_check
        CHECK (status IN ('draft','published','upcoming','ongoing','completed','cancelled','pending_verification','rejected'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_verification ON events(is_verified, status);

-- ─── 2. JOBS VERIFICATION COLUMNS & CONSTRAINTS ───
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
    ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
        CHECK (status IN ('draft','open','closed','pending_verification','rejected'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_verification ON jobs(is_verified, status);

-- ─── 3. SCHEMES VERIFICATION COLUMNS & CONSTRAINTS ───
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
    ALTER TABLE schemes DROP CONSTRAINT IF EXISTS schemes_status_check;
    ALTER TABLE schemes ADD CONSTRAINT schemes_status_check
        CHECK (status IN ('active','expired','upcoming','pending_verification','rejected'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_schemes_verification ON schemes(is_verified, status);
