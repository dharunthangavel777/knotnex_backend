-- ═══════════════════════════════════════════════════════════════
-- 011_ALL_IN_ONE_DATA_SYNC.SQL
-- Schema Parity for Events, Careers, and Schemes across Flutter, Org, and Admin
-- ═══════════════════════════════════════════════════════════════

-- 1. EVENTS ENHANCEMENTS
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS speakers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS chief_guests TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS volunteers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS accessibility_features JSONB DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS contact_and_emergency JSONB DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS media_attachments JSONB DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS merchant_account JSONB DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS landmark VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_passcode VARCHAR(100);

-- 2. JOBS ENHANCEMENTS
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS benefits TEXT[] DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recruiter_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_form_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;

-- 3. SCHEMES ENHANCEMENTS
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS region VARCHAR(100) DEFAULT 'Pan India';

-- 4. PERFORMANCE & SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schemes_created_at ON schemes(created_at DESC);
