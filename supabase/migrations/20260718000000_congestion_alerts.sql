-- ============================================================
-- Migration: congestion_alerts
-- Adds per-section crowd congestion tracking and AI-generated
-- alert storage for the StadiumSetu ops dashboard.
-- Tables: section_congestion, alerts
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. SECTION_CONGESTION
--    One row per section; tracks synthetic device count and
--    congestion level. Seeded via scripts/seed-congestion.ts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.section_congestion (
  section_id   uuid        PRIMARY KEY REFERENCES public.sections (id) ON DELETE CASCADE,
  device_count int         NOT NULL DEFAULT 0,
  level        text        NOT NULL DEFAULT 'low' CHECK (level IN ('low', 'medium', 'high')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. ALERTS
--    Stores Groq-generated crowd-management alerts.
--    section_id is nullable so future global alerts are possible.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid        REFERENCES public.sections (id) ON DELETE SET NULL,
  message     text        NOT NULL,
  severity    text        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved    boolean     NOT NULL DEFAULT false
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Matches the public-read pattern used by gates/sections/zone_congestion.
-- The backend always uses the service-role key which bypasses RLS;
-- no write policies are needed here.
-- ═══════════════════════════════════════════════════════════════

-- section_congestion — public read
ALTER TABLE public.section_congestion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "section_congestion_public_read" ON public.section_congestion;
CREATE POLICY "section_congestion_public_read"
  ON public.section_congestion FOR SELECT
  USING (true);

-- alerts — public read
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_public_read" ON public.alerts;
CREATE POLICY "alerts_public_read"
  ON public.alerts FOR SELECT
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- REALTIME
-- Enables Supabase Realtime for live dashboard updates.
-- Safe to run in the SQL editor; is a no-op if the publication
-- does not yet exist in this project.
-- ═══════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.section_congestion;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
