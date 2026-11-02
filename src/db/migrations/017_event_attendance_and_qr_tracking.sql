-- 017_event_attendance_and_qr_tracking.sql
-- Add checked_in_by and qr_status columns and indexes for high-speed QR check-ins

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_status VARCHAR(20) DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_event_reg_qr_hash ON event_registrations(qr_code_hash);
CREATE INDEX IF NOT EXISTS idx_event_reg_event_user ON event_registrations(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_event_checked_in ON event_registrations(event_id, checked_in_at);
