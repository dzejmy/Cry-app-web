-- =============================================================================
-- seed.sql
-- PeakPass — local development seed data
--
-- Run against a local Supabase instance:
--   supabase db reset          (applies migrations + this seed)
--   supabase db seed           (seed only)
--
-- UUIDs are hard-coded so relationships are deterministic and re-runnable.
-- All inserts use ON CONFLICT DO NOTHING for idempotency.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Disable trigger that auto-creates profiles from auth.users while we seed,
-- so we can insert profiles with full control below.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DISABLE TRIGGER on_auth_user_created;


-- =============================================================================
-- AUTH USERS  (local dev only — never run against production)
-- =============================================================================
-- Passwords are all "Password123!" for dev convenience.

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data, is_super_admin
)
VALUES
  -- Operator 1: Alpine Adventures
  (
    'b1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'alpine@peakpass.dev',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    '{"first_name":"Alpine","last_name":"Adventures","role":"operator"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    false
  ),
  -- Operator 2: Summit Trails
  (
    'b1000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'summit@peakpass.dev',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    '{"first_name":"Summit","last_name":"Trails","role":"operator"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    false
  ),
  -- Customer
  (
    'b1000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'customer@peakpass.dev',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    '{"first_name":"Jana","last_name":"Nováková","role":"customer"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    false
  ),
  -- Admin
  (
    'b1000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@peakpass.dev',
    crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    '{"first_name":"Admin","last_name":"User","role":"admin"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    false
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- PROFILES
-- =============================================================================

INSERT INTO public.profiles (id, role, first_name, last_name, email, preferred_language)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'operator', 'Alpine',  'Adventures',  'alpine@peakpass.dev',   'en'),
  ('b1000000-0000-0000-0000-000000000002', 'operator', 'Summit',  'Trails',      'summit@peakpass.dev',   'sk'),
  ('b1000000-0000-0000-0000-000000000003', 'customer', 'Jana',    'Nováková',    'customer@peakpass.dev', 'sk'),
  ('b1000000-0000-0000-0000-000000000004', 'admin',    'Admin',   'User',        'admin@peakpass.dev',    'en')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- RESORTS  (3 Slovak, 2 Austrian)
-- =============================================================================

INSERT INTO public.resorts (
  id, name, slug, description,
  country, region,
  latitude, longitude, elevation_m,
  season_modes, amenities, website_url, active
)
VALUES
  -- 1. Jasná Nízke Tatry — Slovakia's biggest ski resort
  (
    'a1000000-0000-0000-0000-000000000001',
    'Jasná Nízke Tatry',
    'jasna-nizke-tatry',
    'The largest and most modern ski resort in Slovakia, situated in the Low Tatras. '
    'Offers 50 km of perfectly groomed runs, a modern lift system, and a vibrant '
    'après-ski scene. Transforms into a mountain-biking and hiking destination in summer.',
    'SK', 'Liptovský Mikuláš',
    48.937800, 19.593700, 2005,
    ARRAY['winter','summer'],
    ARRAY['ski lifts','snow cannons','ski rental','ski school','bike park','restaurants','hotels','parking','medical centre'],
    'https://www.jasna.sk',
    true
  ),

  -- 2. Donovaly — family-friendly Slovak resort
  (
    'a1000000-0000-0000-0000-000000000002',
    'Donovaly Park Snow',
    'donovaly',
    'A family-oriented resort in the heart of Slovakia with reliable snow cover '
    'and an excellent beginner-friendly ski school. Known for its relaxed atmosphere '
    'and beautiful Low Tatras panorama. Active in summer with hiking and cycling trails.',
    'SK', 'Banská Bystrica',
    48.887700, 19.222300, 1360,
    ARRAY['winter','summer'],
    ARRAY['ski lifts','snow cannons','ski rental','ski school','restaurants','hotels','parking','kids area'],
    'https://www.parksnow.sk',
    true
  ),

  -- 3. Snowparadise Veľká Rača — winter-only Slovak resort
  (
    'a1000000-0000-0000-0000-000000000003',
    'Snowparadise Veľká Rača',
    'velka-raca',
    'A pure winter resort nestled in the Kysuce highlands, celebrated for its '
    'natural snow cover and a wide variety of runs from gentle beginner slopes '
    'to demanding off-piste terrain. Perfect for families and freestyle enthusiasts.',
    'SK', 'Kysuce',
    49.388100, 18.965200, 1236,
    ARRAY['winter'],
    ARRAY['ski lifts','snow cannons','ski rental','ski school','restaurants','parking','snowpark'],
    'https://www.snowparadise.sk',
    true
  ),

  -- 4. Kitzbühel — iconic Austrian alpine resort
  (
    'a1000000-0000-0000-0000-000000000004',
    'Kitzbühel',
    'kitzbuehel',
    'One of the world''s most prestigious ski resorts, home to the legendary Hahnenkamm '
    'downhill race. 232 km of pistes connect a medieval town with stunning Tyrolean '
    'alpine scenery. A summer paradise for cyclists and hikers with marked trail networks.',
    'AT', 'Tirol',
    47.446200, 12.391900, 2000,
    ARRAY['winter','summer'],
    ARRAY['ski lifts','snow cannons','ski rental','ski school','bike trails','restaurants','hotels','spa','golf','parking','medical centre'],
    'https://www.kitzbuehel.com',
    true
  ),

  -- 5. Zell am See–Kaprun — Austrian glacier resort
  (
    'a1000000-0000-0000-0000-000000000005',
    'Zell am See–Kaprun',
    'zell-am-see-kaprun',
    'A unique twin-resort combining the Schmittenhöhe above the lakeside town of '
    'Zell am See with the year-round Kitzsteinhorn glacier. Outstanding for skiing '
    'in winter and a world-class e-bike and mountain-bike destination in summer.',
    'AT', 'Salzburg',
    47.323600, 12.797700, 3029,
    ARRAY['winter','summer'],
    ARRAY['ski lifts','glacier skiing','snow cannons','ski rental','ski school','bike park','e-bike rental','restaurants','hotels','lake','parking'],
    'https://www.zellamsee-kaprun.com',
    true
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- OPERATORS
-- =============================================================================

INSERT INTO public.operators (
  id, profile_id, name, description,
  logo_url, website_url, phone, email,
  verified, active
)
VALUES
  -- Alpine Adventures — ski school + ski rental (winter, operates at Jasná + Kitzbühel)
  (
    'c1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'Alpine Adventures',
    'Premium ski instruction and equipment rental with certified ISIA instructors '
    'and a modern fleet of Rossignol and Atomic gear. Founded in 2012, we have '
    'helped over 15 000 guests fall in love with skiing.',
    NULL,
    'https://alpine-adventures.example.com',
    '+421 911 100 200',
    'info@alpine-adventures.example.com',
    true, true
  ),

  -- Summit Trails — bike guiding + bike rental (summer, operates at Jasná + Zell am See)
  (
    'c1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000002',
    'Summit Trails',
    'Expert mountain-bike and e-bike tours led by certified MTB guides. '
    'We offer everything from leisurely family rides to technical enduro descents. '
    'Our rental fleet includes high-end Specialized and Scott bikes.',
    NULL,
    'https://summit-trails.example.com',
    '+421 911 300 400',
    'info@summit-trails.example.com',
    true, true
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- OPERATOR ↔ RESORT LINKS
-- =============================================================================

INSERT INTO public.operator_resorts (id, operator_id, resort_id, active)
VALUES
  -- Alpine Adventures at Jasná
  ('e1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001', true),

  -- Alpine Adventures at Kitzbühel
  ('e1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000004', true),

  -- Summit Trails at Jasná
  ('e1000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000001', true),

  -- Summit Trails at Zell am See
  ('e1000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000002',
   'a1000000-0000-0000-0000-000000000005', true)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- SERVICES
-- =============================================================================

INSERT INTO public.services (
  id, operator_id, resort_id,
  type, name, description,
  price_per_person, currency,
  duration_minutes, max_participants,
  min_age, max_age, season_mode, active
)
VALUES
  -- Alpine Adventures: Ski School (group lesson, Jasná)
  (
    'd1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'ski_school',
    'Group Ski Lesson — All Levels',
    'Small-group lessons (max 8 people) run by ISIA-certified instructors. '
    'We group participants by skill level — absolute beginners through advanced — '
    'so everyone progresses at their own pace. Helmets required (rental available).',
    45.00, 'EUR', 180, 8,
    5, NULL, 'winter', true
  ),

  -- Alpine Adventures: Ski Rental full package (Jasná)
  (
    'd1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'ski_rental',
    'Full Ski Equipment Package',
    'Complete ski package: skis (Rossignol Experience or Atomic Vantage), '
    'boots, poles, and helmet. Equipment fitted by our trained boot-fitters. '
    'Full-day and multi-day rates available. Snowboard packages also on request.',
    35.00, 'EUR', 480, 20,
    NULL, NULL, 'winter', true
  ),

  -- Summit Trails: Bike Guiding (Jasná)
  (
    'd1000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'bike_guiding',
    'Guided MTB Half-Day Tour',
    'Explore Jasná''s trail network with a certified MTB guide. Routes are chosen '
    'on the day based on skill level and conditions, covering everything from '
    'flowy singletrack to technical roots and rocks. Helmets mandatory.',
    65.00, 'EUR', 240, 10,
    12, NULL, 'summer', true
  ),

  -- Summit Trails: E-Bike Rental (Jasná)
  (
    'd1000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'bike_rental',
    'E-Bike Full-Day Rental',
    'Premium e-bike rental with Specialized Turbo Levo (full-suspension) and '
    'Scott Strike eRide options. Includes helmet, trail map, and basic toolkit. '
    'Range of frame sizes and child bikes available on request.',
    40.00, 'EUR', 480, 15,
    NULL, NULL, 'summer', true
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- OFFER PAGE CONTENT
-- =============================================================================

INSERT INTO public.offer_page_content (
  id, operator_id, resort_id, service_id,
  headline, subheadline, description,
  highlights, published
)
VALUES
  (
    'f1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'Learn to Ski at Jasná with Expert Instructors',
    'From first turns to racing lines — we have a group for every level.',
    'Our ISIA-certified instructors bring passion and patience to every lesson. '
    'Maximum 8 people per group ensures personal attention. '
    'Lessons run daily at 9:00 and 13:00 throughout the winter season.',
    ARRAY[
      'ISIA-certified instructors',
      'Max 8 participants per group',
      'All skill levels welcome from age 5',
      'Morning and afternoon sessions daily',
      'Helmet rental included'
    ],
    true
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000003',
    'Ride Jasná''s Best Trails with a Local MTB Guide',
    'Discover hidden singletrack and epic descents on the Low Tatras.',
    'Summit Trails'' guides know every corner of Jasná''s trail network. '
    'Half-day tours depart each morning and are adapted to your group''s ability. '
    'All trails are scouted fresh each season for the best conditions.',
    ARRAY[
      'Certified MTB guides',
      'Routes tailored to skill level',
      'Groups up to 10 riders',
      'Operates June through October',
      'Bike rental add-on available'
    ],
    true
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- AVAILABILITY SLOTS — next 30 days
-- Generated with generate_series for all four services.
-- Two slots per day per service (morning 09:00–12:00, afternoon 13:00–16:00).
-- =============================================================================

-- Alpine Adventures: Ski School — morning slots
INSERT INTO public.availability_slots
  (service_id, operator_id, date, start_time, end_time, capacity_total, active)
SELECT
  'd1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  gs::date,
  '09:00'::time,
  '12:00'::time,
  8,
  true
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', INTERVAL '1 day') AS gs
ON CONFLICT DO NOTHING;

-- Alpine Adventures: Ski School — afternoon slots
INSERT INTO public.availability_slots
  (service_id, operator_id, date, start_time, end_time, capacity_total, active)
SELECT
  'd1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  gs::date,
  '13:00'::time,
  '16:00'::time,
  8,
  true
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', INTERVAL '1 day') AS gs
ON CONFLICT DO NOTHING;

-- Alpine Adventures: Ski Rental — full-day slots (one per day, high capacity)
INSERT INTO public.availability_slots
  (service_id, operator_id, date, start_time, end_time, capacity_total, active)
SELECT
  'd1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000001',
  gs::date,
  '08:00'::time,
  '18:00'::time,
  20,
  true
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', INTERVAL '1 day') AS gs
ON CONFLICT DO NOTHING;

-- Summit Trails: Bike Guiding — morning tours (weekdays only for variety)
INSERT INTO public.availability_slots
  (service_id, operator_id, date, start_time, end_time, capacity_total, active)
SELECT
  'd1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000002',
  gs::date,
  '09:00'::time,
  '13:00'::time,
  10,
  true
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', INTERVAL '1 day') AS gs
WHERE EXTRACT(DOW FROM gs) NOT IN (0)   -- exclude Sundays
ON CONFLICT DO NOTHING;

-- Summit Trails: Bike Guiding — afternoon tours (weekends only)
INSERT INTO public.availability_slots
  (service_id, operator_id, date, start_time, end_time, capacity_total, active)
SELECT
  'd1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000002',
  gs::date,
  '14:00'::time,
  '18:00'::time,
  10,
  true
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', INTERVAL '1 day') AS gs
WHERE EXTRACT(DOW FROM gs) IN (6, 0)    -- Saturday and Sunday
ON CONFLICT DO NOTHING;

-- Summit Trails: E-Bike Rental — full-day slots (every day)
INSERT INTO public.availability_slots
  (service_id, operator_id, date, start_time, end_time, capacity_total, active)
SELECT
  'd1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-000000000002',
  gs::date,
  '08:00'::time,
  '19:00'::time,
  15,
  true
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', INTERVAL '1 day') AS gs
ON CONFLICT DO NOTHING;


-- =============================================================================
-- EQUIPMENT INVENTORY — representative stock for each operator
-- =============================================================================

INSERT INTO public.equipment_inventory (
  operator_id, resort_id, category, brand, model,
  size, quantity_total, quantity_available,
  condition, season_mode
)
VALUES
  -- Alpine Adventures: skis
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'ski', 'Rossignol', 'Experience 80 CA', '150cm', 10, 10, 'good', 'winter'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'ski', 'Rossignol', 'Experience 80 CA', '160cm', 12, 12, 'good', 'winter'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'ski', 'Atomic', 'Vantage 75', '170cm', 8, 8, 'new', 'winter'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'ski', 'Atomic', 'Vantage 75', '180cm', 6, 6, 'new', 'winter'),

  -- Alpine Adventures: boots
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'boot', 'Rossignol', 'Evo 70', '26.5', 8, 8, 'good', 'winter'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'boot', 'Rossignol', 'Evo 70', '28.0', 10, 10, 'good', 'winter'),

  -- Alpine Adventures: helmets
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'helmet', 'Uvex', 'Wanted', 'S', 6, 6, 'good', 'winter'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'helmet', 'Uvex', 'Wanted', 'M', 10, 10, 'good', 'winter'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'helmet', 'Uvex', 'Wanted', 'L', 8, 8, 'new', 'winter'),

  -- Summit Trails: e-bikes
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'e-bike', 'Specialized', 'Turbo Levo SL', 'S', 4, 4, 'new', 'summer'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'e-bike', 'Specialized', 'Turbo Levo SL', 'M', 6, 6, 'new', 'summer'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'e-bike', 'Scott', 'Strike eRide 930', 'L', 5, 5, 'good', 'summer'),

  -- Summit Trails: regular bikes
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'bike', 'Scott', 'Ransom 930', 'M', 4, 4, 'good', 'summer'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'bike', 'Scott', 'Ransom 930', 'L', 4, 4, 'good', 'summer'),

  -- Summit Trails: helmets
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'helmet', 'Bell', 'Super Air R MIPS', 'S', 5, 5, 'new', 'summer'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'helmet', 'Bell', 'Super Air R MIPS', 'M', 8, 8, 'new', 'summer'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'helmet', 'Bell', 'Super Air R MIPS', 'L', 5, 5, 'good', 'summer')

ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- Re-enable the new-user profile trigger
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE TRIGGER on_auth_user_created;
