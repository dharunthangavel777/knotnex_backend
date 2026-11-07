-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX DATABASE MIGRATION 021
-- Organization Account Upgrade & Verification Documents Schema
-- ═══════════════════════════════════════════════════════════════

-- 1. Ensure table exists and extend with document verification and metadata
CREATE TABLE IF NOT EXISTS organization_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  organization_email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  website TEXT,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS document_urls TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS application_type VARCHAR(50) DEFAULT 'UPGRADE';

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS state VARCHAR(100);

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS city VARCHAR(100);

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);

ALTER TABLE organization_verification_requests 
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 2. Ensure indexes exist for rapid filtering
CREATE INDEX IF NOT EXISTS idx_org_verifications_status_created 
  ON organization_verification_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_verifications_app_type 
  ON organization_verification_requests(application_type);

