-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX DATABASE MIGRATION 018
-- Profile Enhancements for General Users and Organizations
-- ═══════════════════════════════════════════════════════════════

-- 1. User Profile Fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- 2. Organization Fields
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS established_year VARCHAR(20);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_contact_person VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS key_activities TEXT[] DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS areas_of_operation TEXT[] DEFAULT '{}';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
