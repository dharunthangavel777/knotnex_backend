-- Migration 008: Create SSO Exchange Codes Table for KnotNex Org Web Portal Handoff
CREATE TABLE IF NOT EXISTS sso_exchange_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_exchange_codes_code ON sso_exchange_codes(code);
CREATE INDEX IF NOT EXISTS idx_sso_exchange_codes_user_id ON sso_exchange_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_exchange_codes_expires_at ON sso_exchange_codes(expires_at);
