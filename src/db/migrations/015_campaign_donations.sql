-- ═══════════════════════════════════════════════════════════════
-- 015_CAMPAIGN_DONATIONS.SQL
-- Enhances org_campaigns with real-time donation metrics and seed records
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE org_campaigns ADD COLUMN IF NOT EXISTS raised_amount DECIMAL(14,2) DEFAULT 0;
ALTER TABLE org_campaigns ADD COLUMN IF NOT EXISTS donor_count INTEGER DEFAULT 0;
ALTER TABLE org_campaigns ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Assistive Tech';
ALTER TABLE org_campaigns ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Seed verified default campaigns if table is empty
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM organizations LIMIT 1;
    IF v_org_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM org_campaigns LIMIT 1) THEN
        INSERT INTO org_campaigns (org_id, title, goal, raised_amount, donor_count, category, audience, description, status)
        VALUES
        (v_org_id, 'Electric Wheelchairs for Rural College Students', 250000, 184000, 78, 'Mobility Aid', 'College Students', 'Empowering 50 disabled scholars across rural colleges with automated motorized wheelchair kits and battery charging stations.', 'active'),
        (v_org_id, 'Refreshable Braille Displays for Visually Impaired Coders', 180000, 122500, 49, 'Assistive Tech', 'Visually Impaired Developers', 'Procuring 40-cell Orbit Braille readers and NVDA screen reader tactile peripherals for youth pursuing software engineering careers.', 'active'),
        (v_org_id, 'Cochlear Implant & Speech Therapy Grants', 300000, 210000, 92, 'Medical Care', 'Children & Youth', 'Subsidizing post-surgery audiology diagnostics, speech therapy sessions, and Bluetooth hearing loop receivers.', 'active');
    END IF;
END $$;

