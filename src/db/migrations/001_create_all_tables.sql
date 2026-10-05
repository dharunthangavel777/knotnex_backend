-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX UNIFIED DATABASE SCHEMA (PostgreSQL 15)
-- Production DDL for All 22 Relational Tables
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. USERS ───
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid    VARCHAR(128) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    full_name       VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    role            VARCHAR(20) NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'organization', 'admin')),
    is_verified     BOOLEAN DEFAULT FALSE,
    is_banned       BOOLEAN DEFAULT FALSE,
    fcm_token       TEXT,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. USER PROFILES ───
CREATE TABLE IF NOT EXISTS user_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio             TEXT,
    date_of_birth   DATE,
    gender          VARCHAR(20),
    district        VARCHAR(100),
    state           VARCHAR(100),
    pincode         VARCHAR(10),
    disability_type VARCHAR(100),
    education       JSONB DEFAULT '[]',
    skills          TEXT[] DEFAULT '{}',
    languages       TEXT[] DEFAULT '{}',
    social_links    JSONB DEFAULT '{}',
    accessibility   JSONB DEFAULT '{}',
    cover_url       TEXT,
    qr_code_url     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. USER DEVICES ───
CREATE TABLE IF NOT EXISTS user_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    device_name     VARCHAR(255),
    device_type     VARCHAR(50),
    os              VARCHAR(50),
    browser         VARCHAR(100),
    ip_address      INET,
    last_active_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. ORGANIZATIONS ───
CREATE TABLE IF NOT EXISTS organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE,
    type            VARCHAR(50) NOT NULL
                    CHECK (type IN ('NGO','CSR Company','Foundation','Hospital','School','Rehabilitation Center','Other')),
    logo_url        TEXT,
    cover_url       TEXT,
    about           TEXT,
    mission         TEXT,
    vision          TEXT,
    services        TEXT[] DEFAULT '{}',
    achievements    TEXT[] DEFAULT '{}',
    gallery         TEXT[] DEFAULT '{}',
    contact_email   VARCHAR(255),
    contact_phone   VARCHAR(20),
    website         VARCHAR(500),
    social_links    JSONB DEFAULT '{}',
    is_verified     BOOLEAN DEFAULT FALSE,
    followers_count INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. ORG TEAM MEMBERS ───
CREATE TABLE IF NOT EXISTS org_team_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    role_in_org     VARCHAR(100) NOT NULL,
    permissions     TEXT[] DEFAULT '{}',
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- ─── 6. ORG FOLLOWERS ───
CREATE TABLE IF NOT EXISTS org_followers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- ─── 7. ORG REVIEWS ───
CREATE TABLE IF NOT EXISTS org_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    rating          SMALLINT CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- ─── 8. EVENTS ───
CREATE TABLE IF NOT EXISTS events (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by             UUID REFERENCES users(id) ON DELETE SET NULL,
    title                  VARCHAR(500) NOT NULL,
    slug                   VARCHAR(500),
    category               VARCHAR(100),
    type                   VARCHAR(20) CHECK (type IN ('Online','In-Person','Hybrid')),
    cover_url              TEXT,
    short_description      TEXT,
    detailed_description   TEXT,
    language               VARCHAR(50) DEFAULT 'English',
    event_date             DATE NOT NULL,
    start_time             TIME,
    end_time               TIME,
    timezone               VARCHAR(50) DEFAULT 'Asia/Kolkata',
    registration_opens     TIMESTAMPTZ,
    registration_deadline  TIMESTAMPTZ,
    venue_name             VARCHAR(255),
    address                TEXT,
    district               VARCHAR(100),
    state                  VARCHAR(100),
    google_maps_link       TEXT,
    meeting_platform       VARCHAR(50),
    meeting_link           TEXT,
    wheelchair_accessible  BOOLEAN DEFAULT FALSE,
    sign_language          BOOLEAN DEFAULT FALSE,
    braille_material       BOOLEAN DEFAULT FALSE,
    capacity               INTEGER,
    registered_count       INTEGER DEFAULT 0,
    is_free                BOOLEAN DEFAULT TRUE,
    ticket_price           DECIMAL(10,2) DEFAULT 0,
    status                 VARCHAR(20) DEFAULT 'draft'
                           CHECK (status IN ('draft','published','upcoming','ongoing','completed','cancelled')),
    eligibility            TEXT[] DEFAULT '{}',
    sponsors               JSONB DEFAULT '[]',
    gallery                TEXT[] DEFAULT '{}',
    contact_email          VARCHAR(255),
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. EVENT REGISTRATIONS ───
CREATE TABLE IF NOT EXISTS event_registrations (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id               UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id                UUID REFERENCES users(id) ON DELETE CASCADE,
    status                 VARCHAR(20) DEFAULT 'confirmed'
                           CHECK (status IN ('pending','confirmed','cancelled','attended')),
    qr_code_hash           VARCHAR(255) UNIQUE NOT NULL,
    qr_pass_url            TEXT,
    checked_in_at          TIMESTAMPTZ,
    personal_info          JSONB NOT NULL,
    accessibility_needs    JSONB DEFAULT '{}',
    consent_given          BOOLEAN DEFAULT TRUE,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- ─── 10. JOBS ───
CREATE TABLE IF NOT EXISTS jobs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    title                   VARCHAR(255) NOT NULL,
    department              VARCHAR(100),
    type                    VARCHAR(50) NOT NULL
                            CHECK (type IN ('full-time','part-time','internship','volunteer','contract')),
    location_type           VARCHAR(50) NOT NULL
                            CHECK (location_type IN ('remote','on-site','hybrid')),
    location                VARCHAR(255),
    description             TEXT NOT NULL,
    requirements            TEXT[] DEFAULT '{}',
    responsibilities        TEXT[] DEFAULT '{}',
    disability_accommodations TEXT[] DEFAULT '{}',
    min_salary              DECIMAL(12,2),
    max_salary              DECIMAL(12,2),
    currency                VARCHAR(10) DEFAULT 'INR',
    experience_level        VARCHAR(50),
    education_level         VARCHAR(50),
    deadline                TIMESTAMPTZ,
    status                  VARCHAR(20) DEFAULT 'open'
                            CHECK (status IN ('draft','open','closed')),
    applicants_count        INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 11. JOB APPLICATIONS ───
CREATE TABLE IF NOT EXISTS job_applications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  UUID REFERENCES jobs(id) ON DELETE CASCADE,
    applicant_id            UUID REFERENCES users(id) ON DELETE CASCADE,
    resume_url              TEXT NOT NULL,
    cover_letter            TEXT,
    portfolio_url           TEXT,
    accommodation_notes     TEXT,
    stage                   VARCHAR(50) DEFAULT 'Applied'
                            CHECK (stage IN ('Applied','Under Review','Shortlisted','Interview Scheduled','Selected','Rejected')),
    reviewer_notes          TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, applicant_id)
);

-- ─── 12. SCHEMES ───
CREATE TABLE IF NOT EXISTS schemes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    title                   VARCHAR(500) NOT NULL,
    provider_name           VARCHAR(255) NOT NULL,
    type                    VARCHAR(50) NOT NULL
                            CHECK (type IN ('Government','NGO','Corporate CSR')),
    category                VARCHAR(100) NOT NULL,
    description             TEXT NOT NULL,
    eligibility_criteria    TEXT[] DEFAULT '{}',
    benefits                TEXT[] DEFAULT '{}',
    documents_required      TEXT[] DEFAULT '{}',
    application_deadline    TIMESTAMPTZ,
    official_portal_url     TEXT,
    status                  VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active','expired','upcoming')),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 13. SCHEME APPLICATIONS ───
CREATE TABLE IF NOT EXISTS scheme_applications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id               UUID REFERENCES schemes(id) ON DELETE CASCADE,
    applicant_id            UUID REFERENCES users(id) ON DELETE CASCADE,
    document_urls           TEXT[] DEFAULT '{}',
    applicant_notes         TEXT,
    status                  VARCHAR(30) DEFAULT 'submitted'
                            CHECK (status IN ('submitted','under_review','approved','rejected')),
    reviewer_notes          TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(scheme_id, applicant_id)
);

-- ─── 14. POSTS ───
CREATE TABLE IF NOT EXISTS posts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id               UUID REFERENCES users(id) ON DELETE CASCADE,
    caption                 TEXT,
    media_urls              TEXT[] DEFAULT '{}',
    post_type               VARCHAR(20) DEFAULT 'post' CHECK (post_type IN ('post','reel')),
    thumbnail_url           TEXT,
    tags                    TEXT[] DEFAULT '{}',
    location                VARCHAR(255),
    likes_count             INTEGER DEFAULT 0,
    comments_count          INTEGER DEFAULT 0,
    shares_count            INTEGER DEFAULT 0,
    is_moderated            BOOLEAN DEFAULT FALSE,
    flagged_for_review      BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 15. POST COMMENTS ───
CREATE TABLE IF NOT EXISTS post_comments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id                 UUID REFERENCES posts(id) ON DELETE CASCADE,
    author_id               UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_id               UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    content                 TEXT NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 16. POST REACTIONS ───
CREATE TABLE IF NOT EXISTS post_reactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id                 UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction_type           VARCHAR(20) DEFAULT 'like',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- ─── 17. SAVED ITEMS (Polymorphic) ───
CREATE TABLE IF NOT EXISTS saved_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL,
    item_type               VARCHAR(30) NOT NULL CHECK (item_type IN ('post','event','job','scheme')),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_id, item_type)
);

-- ─── 18. CONNECTIONS ───
CREATE TABLE IF NOT EXISTS connections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id            UUID REFERENCES users(id) ON DELETE CASCADE,
    addressee_id            UUID REFERENCES users(id) ON DELETE CASCADE,
    status                  VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','blocked')),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id)
);

-- ─── 19. TICKETS ───
CREATE TABLE IF NOT EXISTS tickets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id              UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id                  UUID REFERENCES organizations(id) ON DELETE SET NULL,
    subject                 VARCHAR(255) NOT NULL,
    category                VARCHAR(100) NOT NULL,
    priority                VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    status                  VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
    description             TEXT NOT NULL,
    attachments             TEXT[] DEFAULT '{}',
    assigned_to             UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 20. TICKET REPLIES ───
CREATE TABLE IF NOT EXISTS ticket_replies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id               UUID REFERENCES tickets(id) ON DELETE CASCADE,
    author_id               UUID REFERENCES users(id) ON DELETE CASCADE,
    message                 TEXT NOT NULL,
    attachments             TEXT[] DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 21. ANALYTICS SNAPSHOTS ───
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date           DATE NOT NULL UNIQUE,
    total_users             INTEGER DEFAULT 0,
    active_users            INTEGER DEFAULT 0,
    total_orgs              INTEGER DEFAULT 0,
    total_events            INTEGER DEFAULT 0,
    total_registrations     INTEGER DEFAULT 0,
    total_jobs              INTEGER DEFAULT 0,
    total_applications      INTEGER DEFAULT 0,
    metrics                 JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 22. AUDIT LOGS ───
CREATE TABLE IF NOT EXISTS audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id                UUID REFERENCES users(id) ON DELETE SET NULL,
    action                  VARCHAR(100) NOT NULL,
    target_entity           VARCHAR(50) NOT NULL,
    target_id               UUID,
    details                 JSONB DEFAULT '{}',
    ip_address              INET,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES FOR HIGH-TRAFFIC QUERIES ───
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_creator ON tickets(creator_id);
