/**
 * zones.types.ts
 *
 * Shared TypeScript interfaces for the Zones module.
 * These mirror the Supabase `gates` and `sections` table shapes
 * and are the canonical response types for /zones endpoints.
 *
 * In a monorepo setup, this file can be re-exported from a shared
 * `packages/types` package so the Next.js frontend can import them directly.
 */

export interface GateDto {
  id: string;
  name: string;
  angle_deg: number;
  lat: number | null;
  lng: number | null;
}

export interface SectionWithGateDto {
  id: string;
  section_number: string;
  tier: 'Lower Tier' | 'Upper Tier';
  section_index: number;
  nearest_gate_id: string;
  /** Populated via the FK join on nearest_gate_id */
  gate: GateDto;
}
