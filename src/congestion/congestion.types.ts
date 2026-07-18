/**
 * congestion.types.ts
 *
 * Shared TypeScript interfaces for the Congestion module.
 * Mirrors the Supabase `section_congestion` and `alerts` table shapes.
 */

export interface CongestionRow {
  section_id: string;
  device_count: number;
  level: 'low' | 'medium' | 'high';
  updated_at: string;
  /** Joined from sections table */
  section_number: string;
  tier: 'Lower Tier' | 'Upper Tier';
}

export interface AlertRow {
  id: string;
  section_id: string | null;
  message: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
  resolved: boolean;
}

export interface SimulateSpikeResult {
  updatedSections: CongestionRow[];
  newAlerts: AlertRow[];
}
