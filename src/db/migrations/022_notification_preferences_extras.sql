-- ─── 022_notification_preferences_extras.sql ─────────────────────────────
-- Ensure pause_all and sound_vibrate columns exist on notification_preferences
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS pause_all BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sound_vibrate BOOLEAN DEFAULT TRUE;
