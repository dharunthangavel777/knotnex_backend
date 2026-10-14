-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX DATABASE MIGRATION 005
-- High-scale indexes for 5,000 Concurrent Users & Real-time Feeds:
--   • posts: (is_moderated, audience, created_at DESC) for lightning fast feed queries
--   • posts: (post_type, is_moderated, created_at DESC) for instantaneous Reels queries
--   • user_followers: (following_id, follower_id) composite index
--   • post_reactions: (post_id, user_id) index
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_posts_feed_scale 
  ON posts (is_moderated, audience, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_reels_scale 
  ON posts (post_type, is_moderated, created_at DESC)
  WHERE post_type = 'reel';

CREATE INDEX IF NOT EXISTS idx_user_followers_composite
  ON user_followers (following_id, follower_id);

CREATE INDEX IF NOT EXISTS idx_post_reactions_composite
  ON post_reactions (post_id, user_id);
