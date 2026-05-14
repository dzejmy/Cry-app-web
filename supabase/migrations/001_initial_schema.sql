-- =============================================================================
-- 001_initial_schema.sql
-- PeakPass — full initial schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram indexes for search


-- =============================================================================
-- HELPER FUNCTIONS  (only functions that don't reference app tables go here)
-- =============================================================================

-- Generic updated_at stamp trigger function.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-creates a profile row whenever a new auth.users row is inserted.
-- Reads first_name / last_name / role from raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- TABLES  (ordered by foreign-key dependency)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- resorts
-- ---------------------------------------------------------------------------
CREATE TABLE public.resorts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL,
  region        TEXT NOT NULL,
  latitude      NUMERIC(9, 6) NOT NULL,
  longitude     NUMERIC(9, 6) NOT NULL,
  elevation_m   INTEGER,
  season_modes  TEXT[] NOT NULL DEFAULT '{}',
  amenities     TEXT[] NOT NULL DEFAULT '{}',
  image_urls    TEXT[] NOT NULL DEFAULT '{}',
  website_url   TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT resorts_season_modes_check
    CHECK (season_modes <@ ARRAY['winter','summer']::TEXT[])
);

-- ---------------------------------------------------------------------------
-- profiles  (mirrors auth.users 1-to-1)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                TEXT NOT NULL DEFAULT 'customer',
  first_name          TEXT NOT NULL DEFAULT '',
  last_name           TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL,
  phone               TEXT,
  avatar_url          TEXT,
  preferred_language  TEXT NOT NULL DEFAULT 'en',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_role_check
    CHECK (role IN ('customer', 'operator', 'admin'))
);

-- ---------------------------------------------------------------------------
-- operators
-- ---------------------------------------------------------------------------
CREATE TABLE public.operators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  logo_url    TEXT,
  website_url TEXT,
  phone       TEXT,
  email       TEXT,
  verified    BOOLEAN NOT NULL DEFAULT false,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- operator_resorts  (junction)
-- ---------------------------------------------------------------------------
CREATE TABLE public.operator_resorts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  resort_id   UUID NOT NULL REFERENCES public.resorts(id)   ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT operator_resorts_unique UNIQUE (operator_id, resort_id)
);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
CREATE TABLE public.services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id      UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  resort_id        UUID NOT NULL REFERENCES public.resorts(id)   ON DELETE RESTRICT,
  type             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  price_per_person NUMERIC(10, 2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'EUR',
  duration_minutes INTEGER NOT NULL,
  max_participants INTEGER NOT NULL,
  min_age          INTEGER,
  max_age          INTEGER,
  season_mode      TEXT NOT NULL,
  image_urls       TEXT[] NOT NULL DEFAULT '{}',
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT services_type_check
    CHECK (type IN ('ski_school', 'ski_rental', 'bike_rental', 'bike_guiding')),
  CONSTRAINT services_season_mode_check
    CHECK (season_mode IN ('winter', 'summer')),
  CONSTRAINT services_price_check
    CHECK (price_per_person >= 0),
  CONSTRAINT services_duration_check
    CHECK (duration_minutes > 0),
  CONSTRAINT services_capacity_check
    CHECK (max_participants > 0),
  CONSTRAINT services_age_check
    CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
);

-- ---------------------------------------------------------------------------
-- offer_page_content
-- ---------------------------------------------------------------------------
CREATE TABLE public.offer_page_content (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id    UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  resort_id      UUID NOT NULL REFERENCES public.resorts(id)   ON DELETE RESTRICT,
  service_id     UUID          REFERENCES public.services(id)  ON DELETE SET NULL,
  hero_image_url TEXT,
  headline       TEXT NOT NULL,
  subheadline    TEXT,
  description    TEXT NOT NULL DEFAULT '',
  highlights     TEXT[] NOT NULL DEFAULT '{}',
  seo_title      TEXT,
  seo_description TEXT,
  published      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- availability_slots
-- ---------------------------------------------------------------------------
CREATE TABLE public.availability_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES public.services(id)   ON DELETE CASCADE,
  operator_id     UUID NOT NULL REFERENCES public.operators(id)  ON DELETE CASCADE,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  capacity_total  INTEGER NOT NULL,
  capacity_booked INTEGER NOT NULL DEFAULT 0,
  price_override  NUMERIC(10, 2),
  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT slots_time_check
    CHECK (end_time > start_time),
  CONSTRAINT slots_capacity_check
    CHECK (capacity_booked <= capacity_total),
  CONSTRAINT slots_total_positive
    CHECK (capacity_total > 0),
  CONSTRAINT slots_booked_nonneg
    CHECK (capacity_booked >= 0)
);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
CREATE TABLE public.bookings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id               UUID NOT NULL REFERENCES public.profiles(id)            ON DELETE RESTRICT,
  operator_id               UUID NOT NULL REFERENCES public.operators(id)           ON DELETE RESTRICT,
  resort_id                 UUID NOT NULL REFERENCES public.resorts(id)             ON DELETE RESTRICT,
  service_id                UUID NOT NULL REFERENCES public.services(id)            ON DELETE RESTRICT,
  availability_slot_id      UUID NOT NULL REFERENCES public.availability_slots(id)  ON DELETE RESTRICT,
  type                      TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'pending',
  total_price               NUMERIC(10, 2) NOT NULL,
  currency                  CHAR(3) NOT NULL DEFAULT 'EUR',
  stripe_payment_intent_id  TEXT,
  customer_notes            TEXT,
  operator_notes            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bookings_type_check
    CHECK (type IN ('school_only', 'rental_only', 'guiding_only', 'bundle')),
  CONSTRAINT bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'arrived', 'completed', 'cancelled')),
  CONSTRAINT bookings_price_check
    CHECK (total_price >= 0)
);

-- ---------------------------------------------------------------------------
-- booking_participants
-- ---------------------------------------------------------------------------
CREATE TABLE public.booking_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  age         INTEGER,
  school_data JSONB,   -- SchoolData shape
  rental_data JSONB,   -- RentalData shape
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT participants_age_check CHECK (age IS NULL OR age >= 0)
);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE public.reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID NOT NULL UNIQUE REFERENCES public.bookings(id)  ON DELETE RESTRICT,
  customer_id    UUID NOT NULL REFERENCES public.profiles(id)          ON DELETE RESTRICT,
  operator_id    UUID NOT NULL REFERENCES public.operators(id)         ON DELETE RESTRICT,
  service_id     UUID NOT NULL REFERENCES public.services(id)          ON DELETE RESTRICT,
  rating         SMALLINT NOT NULL,
  title          TEXT,
  body           TEXT NOT NULL,
  operator_reply TEXT,
  published      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5)
);

-- ---------------------------------------------------------------------------
-- equipment_inventory
-- ---------------------------------------------------------------------------
CREATE TABLE public.equipment_inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id         UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  resort_id           UUID NOT NULL REFERENCES public.resorts(id)   ON DELETE RESTRICT,
  category            TEXT NOT NULL,
  brand               TEXT NOT NULL,
  model               TEXT NOT NULL,
  size                TEXT NOT NULL,
  quantity_total      INTEGER NOT NULL,
  quantity_available  INTEGER NOT NULL,
  condition           TEXT NOT NULL,
  season_mode         TEXT NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT inventory_category_check
    CHECK (category IN ('ski', 'snowboard', 'boot', 'helmet', 'bike', 'e-bike')),
  CONSTRAINT inventory_condition_check
    CHECK (condition IN ('new', 'good', 'fair', 'retired')),
  CONSTRAINT inventory_season_check
    CHECK (season_mode IN ('winter', 'summer')),
  CONSTRAINT inventory_total_check
    CHECK (quantity_total >= 0),
  CONSTRAINT inventory_available_check
    CHECK (quantity_available >= 0),
  CONSTRAINT inventory_quantity_check
    CHECK (quantity_available <= quantity_total)
);


-- =============================================================================
-- HELPER FUNCTIONS  (reference app tables — must come after CREATE TABLE)
-- =============================================================================

-- Returns the current user's role from profiles.
-- SECURITY DEFINER avoids RLS recursion when policies call this function.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Returns the operator.id that belongs to the current authenticated user.
CREATE OR REPLACE FUNCTION public.get_my_operator_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.operators WHERE profile_id = auth.uid();
$$;


-- =============================================================================
-- INDEXES
-- =============================================================================

-- resorts
CREATE INDEX resorts_slug_idx         ON public.resorts (slug);
CREATE INDEX resorts_country_idx      ON public.resorts (country);
CREATE INDEX resorts_active_idx       ON public.resorts (active);

-- profiles
CREATE INDEX profiles_role_idx        ON public.profiles (role);
CREATE INDEX profiles_email_idx       ON public.profiles (email);

-- operators
CREATE INDEX operators_profile_idx    ON public.operators (profile_id);
CREATE INDEX operators_verified_idx   ON public.operators (verified, active);

-- operator_resorts
CREATE INDEX op_resorts_operator_idx  ON public.operator_resorts (operator_id);
CREATE INDEX op_resorts_resort_idx    ON public.operator_resorts (resort_id);

-- services
CREATE INDEX services_operator_idx   ON public.services (operator_id);
CREATE INDEX services_resort_idx     ON public.services (resort_id);
CREATE INDEX services_type_idx       ON public.services (type);
CREATE INDEX services_season_idx     ON public.services (season_mode, active);

-- offer_page_content
CREATE INDEX offer_operator_idx      ON public.offer_page_content (operator_id);
CREATE INDEX offer_resort_idx        ON public.offer_page_content (resort_id);
CREATE INDEX offer_published_idx     ON public.offer_page_content (published);

-- availability_slots
CREATE INDEX slots_service_idx       ON public.availability_slots (service_id);
CREATE INDEX slots_operator_idx      ON public.availability_slots (operator_id);
CREATE INDEX slots_date_idx          ON public.availability_slots (date, active);

-- bookings
CREATE INDEX bookings_customer_idx   ON public.bookings (customer_id);
CREATE INDEX bookings_operator_idx   ON public.bookings (operator_id);
CREATE INDEX bookings_slot_idx       ON public.bookings (availability_slot_id);
CREATE INDEX bookings_status_idx     ON public.bookings (status);

-- booking_participants
CREATE INDEX participants_booking_idx ON public.booking_participants (booking_id);

-- reviews
CREATE INDEX reviews_operator_idx    ON public.reviews (operator_id);
CREATE INDEX reviews_service_idx     ON public.reviews (service_id);
CREATE INDEX reviews_published_idx   ON public.reviews (published);
CREATE INDEX reviews_rating_idx      ON public.reviews (rating);

-- equipment_inventory
CREATE INDEX inventory_operator_idx  ON public.equipment_inventory (operator_id);
CREATE INDEX inventory_resort_idx    ON public.equipment_inventory (resort_id);
CREATE INDEX inventory_category_idx  ON public.equipment_inventory (category, season_mode);


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- updated_at stamp on all mutable tables
CREATE TRIGGER set_updated_at_resorts
  BEFORE UPDATE ON public.resorts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_operators
  BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_services
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_offer_page_content
  BEFORE UPDATE ON public.offer_page_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_availability_slots
  BEFORE UPDATE ON public.availability_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_bookings
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_equipment_inventory
  BEFORE UPDATE ON public.equipment_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on sign-up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.resorts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_resorts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_page_content   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_inventory  ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- resorts
-- ---------------------------------------------------------------------------

-- Anyone (including anon) can read resorts.
CREATE POLICY "resorts: public read"
  ON public.resorts FOR SELECT
  USING (true);

-- Admins can do anything.
CREATE POLICY "resorts: admin all"
  ON public.resorts FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Users see only their own profile; admins see all.
CREATE POLICY "profiles: owner or admin read"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR public.get_user_role() = 'admin'
  );

-- Users update their own profile (role field cannot be self-escalated —
-- enforced at the application layer; use a server-side function if needed).
CREATE POLICY "profiles: owner update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT is handled exclusively by the handle_new_user trigger.
-- Admins may insert directly (e.g. seeding, back-office).
CREATE POLICY "profiles: admin insert"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "profiles: admin update"
  ON public.profiles FOR UPDATE
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "profiles: admin delete"
  ON public.profiles FOR DELETE
  USING (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- operators
-- ---------------------------------------------------------------------------

-- Authenticated users can browse verified, active operators.
CREATE POLICY "operators: authenticated read"
  ON public.operators FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (verified = true AND active = true)
  );

-- Admins see everything.
CREATE POLICY "operators: admin read"
  ON public.operators FOR SELECT
  USING (public.get_user_role() = 'admin');

-- An operator-role user can update their own operator record.
CREATE POLICY "operators: owner update"
  ON public.operators FOR UPDATE
  USING (
    profile_id = auth.uid()
    AND public.get_user_role() = 'operator'
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND public.get_user_role() = 'operator'
  );

-- Admins full control.
CREATE POLICY "operators: admin all"
  ON public.operators FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- operator_resorts
-- ---------------------------------------------------------------------------

-- Authenticated users can see active operator-resort links.
CREATE POLICY "operator_resorts: authenticated read"
  ON public.operator_resorts FOR SELECT
  USING (auth.role() = 'authenticated' AND active = true);

-- Admins see all.
CREATE POLICY "operator_resorts: admin read"
  ON public.operator_resorts FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Operators manage their own links.
CREATE POLICY "operator_resorts: owner write"
  ON public.operator_resorts FOR ALL
  USING (operator_id = public.get_my_operator_id())
  WITH CHECK (operator_id = public.get_my_operator_id());

-- Admins full control.
CREATE POLICY "operator_resorts: admin all"
  ON public.operator_resorts FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

-- Anon/authenticated can browse active services.
CREATE POLICY "services: public read"
  ON public.services FOR SELECT
  USING (active = true);

-- Admins can read all (including inactive).
CREATE POLICY "services: admin read"
  ON public.services FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Operators manage their own services.
CREATE POLICY "services: owner all"
  ON public.services FOR ALL
  USING (operator_id = public.get_my_operator_id())
  WITH CHECK (operator_id = public.get_my_operator_id());

-- Admins full control.
CREATE POLICY "services: admin all"
  ON public.services FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- offer_page_content
-- ---------------------------------------------------------------------------

-- Anon/authenticated can read published pages.
CREATE POLICY "offer: public read"
  ON public.offer_page_content FOR SELECT
  USING (published = true);

-- Operators manage their own offer pages.
CREATE POLICY "offer: owner all"
  ON public.offer_page_content FOR ALL
  USING (operator_id = public.get_my_operator_id())
  WITH CHECK (operator_id = public.get_my_operator_id());

-- Admins full control.
CREATE POLICY "offer: admin all"
  ON public.offer_page_content FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- availability_slots
-- ---------------------------------------------------------------------------

-- Authenticated users can see active future slots.
CREATE POLICY "slots: authenticated read"
  ON public.availability_slots FOR SELECT
  USING (auth.role() = 'authenticated' AND active = true AND date >= CURRENT_DATE);

-- Admins can see all slots.
CREATE POLICY "slots: admin read"
  ON public.availability_slots FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Operators manage their own slots.
CREATE POLICY "slots: owner all"
  ON public.availability_slots FOR ALL
  USING (operator_id = public.get_my_operator_id())
  WITH CHECK (operator_id = public.get_my_operator_id());

-- Admins full control.
CREATE POLICY "slots: admin all"
  ON public.availability_slots FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

-- Customers see their own bookings.
CREATE POLICY "bookings: customer read"
  ON public.bookings FOR SELECT
  USING (customer_id = auth.uid());

-- Customers create bookings for themselves.
CREATE POLICY "bookings: customer insert"
  ON public.bookings FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND public.get_user_role() = 'customer'
  );

-- Customers may cancel (set status = 'cancelled') their own pending/confirmed booking.
-- Finer status-transition rules are enforced at the application/function layer.
CREATE POLICY "bookings: customer update"
  ON public.bookings FOR UPDATE
  USING (
    customer_id = auth.uid()
    AND status IN ('pending', 'confirmed')
  )
  WITH CHECK (customer_id = auth.uid());

-- Operators see all bookings for their operator.
CREATE POLICY "bookings: operator read"
  ON public.bookings FOR SELECT
  USING (operator_id = public.get_my_operator_id());

-- Operators update status and notes (not financial fields — enforce in app).
CREATE POLICY "bookings: operator update"
  ON public.bookings FOR UPDATE
  USING (operator_id = public.get_my_operator_id())
  WITH CHECK (operator_id = public.get_my_operator_id());

-- Admins full control.
CREATE POLICY "bookings: admin all"
  ON public.bookings FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- booking_participants
-- ---------------------------------------------------------------------------

-- Customers see participants of their own bookings.
CREATE POLICY "participants: customer read"
  ON public.booking_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.customer_id = auth.uid()
    )
  );

-- Customers insert participants (their own booking validated above + app logic).
CREATE POLICY "participants: customer insert"
  ON public.booking_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.customer_id = auth.uid()
    )
  );

-- Operators see participants for their bookings.
CREATE POLICY "participants: operator read"
  ON public.booking_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.operator_id = public.get_my_operator_id()
    )
  );

-- Admins full control.
CREATE POLICY "participants: admin all"
  ON public.booking_participants FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

-- Anyone can read published reviews.
CREATE POLICY "reviews: public read"
  ON public.reviews FOR SELECT
  USING (published = true);

-- Customers see their own reviews regardless of published status.
CREATE POLICY "reviews: customer read own"
  ON public.reviews FOR SELECT
  USING (customer_id = auth.uid());

-- Customers create reviews only for their own completed bookings.
CREATE POLICY "reviews: customer insert"
  ON public.reviews FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.customer_id = auth.uid()
        AND b.status = 'completed'
    )
  );

-- Customers update their own review (title, body, rating — not operator_reply).
CREATE POLICY "reviews: customer update"
  ON public.reviews FOR UPDATE
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Operators update the operator_reply field on reviews for their services.
CREATE POLICY "reviews: operator reply"
  ON public.reviews FOR UPDATE
  USING (operator_id = public.get_my_operator_id())
  WITH CHECK (operator_id = public.get_my_operator_id());

-- Admins full control.
CREATE POLICY "reviews: admin all"
  ON public.reviews FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ---------------------------------------------------------------------------
-- equipment_inventory
-- ---------------------------------------------------------------------------

-- Operators manage their own inventory.
CREATE POLICY "inventory: owner all"
  ON public.equipment_inventory FOR ALL
  USING (operator_id = public.get_my_operator_id())
  WITH CHECK (operator_id = public.get_my_operator_id());

-- Admins full control.
CREATE POLICY "inventory: admin all"
  ON public.equipment_inventory FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
