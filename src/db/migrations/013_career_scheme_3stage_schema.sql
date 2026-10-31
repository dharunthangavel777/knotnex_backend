-- Migration: 013_career_scheme_3stage_schema.sql
-- Enrich jobs, schemes, job_applications, and scheme_applications for complete 3-Stage Creation & Application Flows

-- ─── 1. JOBS ENHANCEMENTS ───
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workplace_accommodations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hiring_stages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS perks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hiring_team JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_form_config JSONB DEFAULT '{}'::jsonb;

-- ─── 2. SCHEMES ENHANCEMENTS ───
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS eligible_disabilities TEXT[] DEFAULT '{}';
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS min_disability_percentage INT DEFAULT 40;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS income_limit VARCHAR(100);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS age_limit VARCHAR(100);
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS document_checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS application_steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS support_contacts JSONB DEFAULT '{}'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS form_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS is_direct_application BOOLEAN DEFAULT TRUE;

-- ─── 3. JOB APPLICATIONS ENHANCEMENTS ───
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS requested_accommodations TEXT[] DEFAULT '{}';

-- ─── 4. SCHEME APPLICATIONS ENHANCEMENTS ───
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS dbt_bank_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS udid_number VARCHAR(100);
ALTER TABLE scheme_applications ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}'::jsonb;
