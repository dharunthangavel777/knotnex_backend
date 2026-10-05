-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX DATABASE MIGRATION 003
-- Home Feed Advanced Interactions:
--   • posts: add views_count, save_count, audience, category,
--            community, tagged_users, allow_comments, allow_reposts
--   • post_comments: add likes_count, is_edited
--   • post_views:   deduplicated view log (1 per user per post per day)
--   • post_shares:  share log with platform tracking
--   • comment_reactions: per-user comment likes
--   • post_reports: dedicated report table (replaces flag-only)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Extend posts table ─────────────────────────────────────
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS views_count      INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count       INTEGER       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audience         VARCHAR(30)   DEFAULT 'public'
      CHECK (audience IN ('public','connections','community','private')),
  ADD COLUMN IF NOT EXISTS category         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS community        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tagged_users     UUID[]        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allow_comments   BOOLEAN       DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_reposts    BOOLEAN       DEFAULT TRUE;

-- ── 2. Extend post_comments table ────────────────────────────
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS likes_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_edited    BOOLEAN DEFAULT FALSE;

-- ── 3. Post Views table (one row per user per post per day) ──
CREATE TABLE IF NOT EXISTS post_views (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID            REFERENCES posts(id) ON DELETE CASCADE,
    user_id     UUID            REFERENCES users(id) ON DELETE CASCADE,
    viewed_at   DATE            NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(post_id, user_id, viewed_at)
);

CREATE INDEX IF NOT EXISTS idx_post_views_post    ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user    ON post_views(user_id);

-- ── 4. Post Shares table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_shares (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID            REFERENCES posts(id) ON DELETE CASCADE,
    user_id     UUID            REFERENCES users(id) ON DELETE CASCADE,
    platform    VARCHAR(50)     DEFAULT 'internal',
    shared_at   TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_shares_post   ON post_shares(post_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_user   ON post_shares(user_id);

-- ── 5. Comment Reactions (per-user comment likes) ─────────────
CREATE TABLE IF NOT EXISTS comment_reactions (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id      UUID    REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id         UUID    REFERENCES users(id) ON DELETE CASCADE,
    reaction_type   VARCHAR(20) DEFAULT 'like',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user    ON comment_reactions(user_id);

-- ── 6. Post Reports (dedicated table) ────────────────────────
CREATE TABLE IF NOT EXISTS post_reports (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID            REFERENCES posts(id) ON DELETE CASCADE,
    reporter_id UUID            REFERENCES users(id) ON DELETE CASCADE,
    reason      VARCHAR(100)    NOT NULL,
    details     TEXT,
    status      VARCHAR(20)     DEFAULT 'pending'
        CHECK (status IN ('pending','reviewed','dismissed','actioned')),
    created_at  TIMESTAMPTZ     DEFAULT NOW(),
    UNIQUE(post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reports_post      ON post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_status    ON post_reports(status);

-- ── 7. Performance indexes ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_audience     ON posts(audience);
CREATE INDEX IF NOT EXISTS idx_posts_category     ON posts(category);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at ASC);
