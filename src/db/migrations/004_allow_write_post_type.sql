-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX DATABASE MIGRATION 004
-- Allow 'write' as valid post_type for text/thought posts
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_post_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_post_type_check CHECK (post_type IN ('post', 'reel', 'write'));
