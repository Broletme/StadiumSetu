-- ============================================================
-- Migration: zones_schema
-- Creates the seat/gate navigation data layer for StadiumSetu.
-- Tables: gates, sections, seats, zone_congestion, incidents
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. GATES
--    Each gate has an angular position (0–360°) around the bowl.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  angle_deg  numeric     NOT NULL CHECK (angle_deg >= 0 AND angle_deg < 360),
  lat        numeric,
  lng        numeric
);

-- ─────────────────────────────────────────────────────────────
-- 2. SECTIONS
--    24 sections (0–23) distributed around the bowl in two tiers.
--    nearest_gate_id is the gate closest to this section's angle.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sections (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  section_number   text    NOT NULL UNIQUE,
  tier             text    NOT NULL CHECK (tier IN ('Lower Tier', 'Upper Tier')),
  section_index    integer NOT NULL CHECK (section_index >= 0 AND section_index <= 23),
  nearest_gate_id  uuid    NOT NULL REFERENCES public.gates (id) ON DELETE RESTRICT
);

-- ─────────────────────────────────────────────────────────────
-- 3. SEATS
--    Individual seats belong to a section.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seats (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    uuid  NOT NULL REFERENCES public.sections (id) ON DELETE CASCADE,
  row_number    text  NOT NULL,
  seat_number   text  NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- 4. ZONE_CONGESTION
--    One congestion row per gate; updated by ops staff or sensors.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zone_congestion (
  gate_id     uuid        PRIMARY KEY REFERENCES public.gates (id) ON DELETE CASCADE,
  level       text        NOT NULL DEFAULT 'low' CHECK (level IN ('low', 'medium', 'high')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 5. INCIDENTS
--    Reported by authenticated ops users.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.incidents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  description         text        NOT NULL,
  severity            text        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  recommended_action  text,
  status              text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

-- gates — public read
ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gates_public_read" ON public.gates;
CREATE POLICY "gates_public_read"
  ON public.gates FOR SELECT
  USING (true);

-- sections — public read
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sections_public_read" ON public.sections;
CREATE POLICY "sections_public_read"
  ON public.sections FOR SELECT
  USING (true);

-- seats — public read
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seats_public_read" ON public.seats;
CREATE POLICY "seats_public_read"
  ON public.seats FOR SELECT
  USING (true);

-- zone_congestion — public read
ALTER TABLE public.zone_congestion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zone_congestion_public_read" ON public.zone_congestion;
CREATE POLICY "zone_congestion_public_read"
  ON public.zone_congestion FOR SELECT
  USING (true);

-- incidents — public read; authenticated insert only
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "incidents_public_read" ON public.incidents;
CREATE POLICY "incidents_public_read"
  ON public.incidents FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "incidents_authenticated_insert" ON public.incidents;
CREATE POLICY "incidents_authenticated_insert"
  ON public.incidents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
