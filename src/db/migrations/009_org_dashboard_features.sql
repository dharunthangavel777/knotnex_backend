-- ═══════════════════════════════════════════════════════════════
-- 009_ORG_DASHBOARD_FEATURES.SQL
-- Full Organization Dashboard and Mobile Client Pipeline Support
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. ORG CAMPAIGNS ───
CREATE TABLE IF NOT EXISTS org_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    goal            DECIMAL(14,2) DEFAULT 50000,
    audience        VARCHAR(255),
    description     TEXT,
    spend           VARCHAR(50) DEFAULT '₹0',
    reach           VARCHAR(50) DEFAULT '0',
    conversions     INTEGER DEFAULT 0,
    status          VARCHAR(50) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_campaigns_org_id ON org_campaigns(org_id);

-- ─── 2. ORG ACHIEVEMENTS ───
CREATE TABLE IF NOT EXISTS org_achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    date            VARCHAR(50) DEFAULT '2026',
    body            VARCHAR(255),
    description     TEXT,
    badge           VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_achievements_org_id ON org_achievements(org_id);

-- ─── 3. SCHEMES ENHANCEMENTS ───
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS grant_amount VARCHAR(100);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS funding_amount DECIMAL(14,2);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS process_steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS support_email VARCHAR(255);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS support_phone VARCHAR(50);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ─── 4. SCHEME APPLICATIONS ENHANCEMENTS ───
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS stage VARCHAR(50) DEFAULT 'Under Review';
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS requested_amount VARCHAR(100);
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS score VARCHAR(50);
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS org_type VARCHAR(100);
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Relax status check constraint on scheme_applications if present
DO $$
BEGIN
    ALTER TABLE scheme_applications DROP CONSTRAINT IF EXISTS scheme_applications_status_check;
    ALTER TABLE scheme_applications ADD CONSTRAINT scheme_applications_status_check
        CHECK (status IN ('submitted','under_review','approved','rejected','disbursed','pending'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ─── 5. JOB APPLICATIONS STAGE ENHANCEMENT ───
DO $$
BEGIN
    ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_stage_check;
    ALTER TABLE job_applications ADD CONSTRAINT job_applications_stage_check
        CHECK (stage IN ('Applied','Under Review','Shortlisted','Interview Scheduled','Interviewing','Offered','Selected','Rejected'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ─── 6. TICKETS INDEX ───
CREATE INDEX IF NOT EXISTS idx_tickets_org_id ON tickets(org_id);
