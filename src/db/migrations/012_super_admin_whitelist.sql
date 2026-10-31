-- Migration: 012_super_admin_whitelist.sql
-- Create super admin whitelist table and register authorized super admins

CREATE TABLE IF NOT EXISTS admin_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_whitelist_email ON admin_whitelist(LOWER(email));

-- Seed authorized super admin emails
INSERT INTO admin_whitelist (email, full_name, is_active)
VALUES 
    ('dharuncod@gmail.com', 'Dharun - Super Admin', TRUE),
    ('praveen12rangasamy@gmail.com', 'Praveen - Super Admin', TRUE)
ON CONFLICT (email) DO UPDATE 
SET is_active = TRUE,
    full_name = EXCLUDED.full_name;

-- Ensure both are registered in users table with role = 'admin'
INSERT INTO users (firebase_uid, email, full_name, role, is_verified, is_banned)
VALUES 
    ('admin_dharun', 'dharuncod@gmail.com', 'Dharun', 'admin', TRUE, FALSE),
    ('admin_praveen', 'praveen12rangasamy@gmail.com', 'Praveen', 'admin', TRUE, FALSE)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin',
    is_verified = TRUE,
    is_banned = FALSE;

