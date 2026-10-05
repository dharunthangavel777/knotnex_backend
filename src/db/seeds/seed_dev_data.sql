-- ═══════════════════════════════════════════════════════════════
-- KNOTNEX DEVELOPMENT SEED DATA
-- ═══════════════════════════════════════════════════════════════

-- 1. Insert Initial Platform Admin & Test Users
INSERT INTO users (id, firebase_uid, email, phone, full_name, role, is_verified)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin-firebase-uid', 'admin@knotnex.com', '+919876543210', 'Platform Administrator', 'admin', true),
  ('00000000-0000-0000-0000-000000000002', 'org-firebase-uid', 'coordinator@samarthya-ngo.org', '+919876543211', 'Samarthya Foundation Coordinator', 'organization', true),
  ('00000000-0000-0000-0000-000000000003', 'user-firebase-uid', 'arun.kumar@example.com', '+919876543212', 'Arun Kumar', 'user', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Profiles
INSERT INTO user_profiles (id, user_id, bio, district, state, disability_type, skills)
VALUES 
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Accessibility advocate & digital marketing enthusiast', 'Bengaluru Urban', 'Karnataka', 'Locomotor Disability', ARRAY['Digital Marketing', 'Data Analysis', 'Accessible Design'])
ON CONFLICT (user_id) DO NOTHING;

-- 3. Insert Organization
INSERT INTO organizations (id, owner_id, name, slug, type, about, mission, contact_email, website, is_verified)
VALUES 
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Samarthya Disability Empowerment', 'samarthya-empowerment', 'NGO', 'Working towards equitable education, skilling, and opportunities for specially-abled individuals.', 'Empowering 100,000 specially-abled youth by 2030.', 'contact@samarthya-ngo.org', 'https://samarthya-ngo.org', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Sample Event
INSERT INTO events (id, org_id, created_by, title, slug, category, type, event_date, start_time, end_time, venue_name, district, state, wheelchair_accessible, sign_language, is_free, status)
VALUES 
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'National Inclusive Tech & Skilling Conclave 2026', 'inclusive-tech-conclave-2026', 'Technology & Skilling', 'In-Person', CURRENT_DATE + INTERVAL '14 days', '10:00:00', '17:00:00', 'Manpho Convention Centre', 'Bengaluru Urban', 'Karnataka', true, true, true, 'published')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Sample Job
INSERT INTO jobs (id, org_id, created_by, title, department, type, location_type, location, description, disability_accommodations, min_salary, max_salary, status)
VALUES 
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Accessibility QA Analyst', 'Engineering', 'full-time', 'remote', 'Remote (India)', 'Testing web and mobile applications with screen readers and keyboard navigation.', ARRAY['Screen reader setup provided', 'Flexible work hours', 'Work from home'], 350000, 600000, 'open')
ON CONFLICT (id) DO NOTHING;

-- 6. Insert Sample Scheme
INSERT INTO schemes (id, org_id, created_by, title, provider_name, type, category, description, eligibility_criteria, benefits, status)
VALUES 
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Assistive Tech Grant Program', 'Department of Empowerment of Persons with Disabilities', 'Government', 'Assistive Devices', 'Financial grant assistance for acquiring modern assistive devices and mobility aids.', ARRAY['40%+ disability certificate', 'Annual income under ₹3,00,000'], ARRAY['Up to 100% subsidy on motorized wheelchairs and assistive tech devices'], 'active')
ON CONFLICT (id) DO NOTHING;
