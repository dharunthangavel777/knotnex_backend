-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 014_careers_schemes_persistence_fix.sql
-- Description: Unifies status constraints, adds missing columns, indexes, and FKs
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Ensure Default System Organization Exists for Resilient Fallback
INSERT INTO organizations (id, name, slug, type, is_verified)
VALUES ('20000000-0000-0000-0000-000000000001', 'KnotNex Verified Foundation', 'knotnex-foundation', 'NGO', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Jobs Status Constraint Update
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
    CHECK (status IN ('draft', 'pending_verification', 'open', 'closed', 'rejected', 'paused', 'archived'));

-- Ensure all necessary columns exist on jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recruiter_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_form_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS perks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hiring_stages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workplace_accommodations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_verification_status ON jobs(is_verified, status);

-- 3. Schemes Status Constraint Update
ALTER TABLE schemes DROP CONSTRAINT IF EXISTS schemes_status_check;
ALTER TABLE schemes ADD CONSTRAINT schemes_status_check
    CHECK (status IN ('draft', 'pending_verification', 'active', 'expired', 'upcoming', 'rejected', 'archived'));

-- Ensure all necessary columns exist on schemes
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS grant_amount VARCHAR(100);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS funding_amount DECIMAL(14,2);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS process_steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS support_email VARCHAR(255);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS support_phone VARCHAR(50);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS region VARCHAR(100) DEFAULT 'Pan India';
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schemes_org_status ON schemes(org_id, status);
CREATE INDEX IF NOT EXISTS idx_schemes_created_by ON schemes(created_by);
CREATE INDEX IF NOT EXISTS idx_schemes_verification_status ON schemes(is_verified, status);
