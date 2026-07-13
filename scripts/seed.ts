/**
 * seed.ts — StadiumSetu zones seed script
 *
 * Inserts gates, sections, and seats into Supabase.
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/seed.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from the stadiumsetu-api directory
dotenv.config({ path: resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─────────────────────────────────────────────────────────────
// Gate definitions — evenly spaced at 90° intervals
// ─────────────────────────────────────────────────────────────
const GATES = [
  { name: 'Gate A', angle_deg: 0 },
  { name: 'Gate B', angle_deg: 90 },
  { name: 'Gate C', angle_deg: 180 },
  { name: 'Gate D', angle_deg: 270 },
] as const;

// ─────────────────────────────────────────────────────────────
// Helper: find the nearest gate for a given section angle
// Uses circular distance to handle the 0°/360° wrap-around.
// ─────────────────────────────────────────────────────────────
function nearestGateIndex(sectionAngle: number): number {
  let minDiff = Infinity;
  let nearestIdx = 0;

  GATES.forEach((gate, i) => {
    const diff = Math.abs(
      ((sectionAngle - gate.angle_deg + 180 + 360) % 360) - 180,
    );
    if (diff < minDiff) {
      minDiff = diff;
      nearestIdx = i;
    }
  });

  return nearestIdx;
}

// ─────────────────────────────────────────────────────────────
// Build 24 sections: 0–11 = Lower Tier, 12–23 = Upper Tier
// Each section_index maps to an angle: index * 15° (360° / 24)
// ─────────────────────────────────────────────────────────────
function buildSections(gateIds: string[]) {
  return Array.from({ length: 24 }, (_, i) => {
    const tier = i < 12 ? 'Lower Tier' : 'Upper Tier';
    // Prefix: L for Lower, U for Upper; number within tier
    const tierIndex = i < 12 ? i + 1 : i - 11;
    const sectionNumber = `${tier === 'Lower Tier' ? 'L' : 'U'}${String(tierIndex).padStart(2, '0')}`;
    const sectionAngle = i * 15; // 360° / 24 sections = 15° per section
    const gateIdx = nearestGateIndex(sectionAngle);

    return {
      section_number: sectionNumber,
      tier,
      section_index: i,
      nearest_gate_id: gateIds[gateIdx],
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Build 5 seats per section (rows A–E, seat 1)
// ─────────────────────────────────────────────────────────────
function buildSeats(sectionIds: string[]) {
  const rows = ['A', 'B', 'C', 'D', 'E'];
  const seats: { section_id: string; row_number: string; seat_number: string }[] =
    [];

  for (const sectionId of sectionIds) {
    for (const row of rows) {
      seats.push({ section_id: sectionId, row_number: row, seat_number: '1' });
    }
  }

  return seats;
}

// ─────────────────────────────────────────────────────────────
// Main seeding function
// ─────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱  Starting seed...\n');

  // 1. Insert gates
  const { data: gatesData, error: gatesError } = await supabase
    .from('gates')
    .insert(GATES.map((g) => ({ name: g.name, angle_deg: g.angle_deg })))
    .select('id, name, angle_deg');

  if (gatesError) {
    console.error('❌  Failed to insert gates:', gatesError.message);
    process.exit(1);
  }

  const gateIds = gatesData!.map((g) => g.id);
  console.log(`✅  Inserted ${gatesData!.length} gates:`);
  gatesData!.forEach((g) => console.log(`     • ${g.name} @ ${g.angle_deg}°`));

  // 2. Insert sections
  const sectionsPayload = buildSections(gateIds);
  const { data: sectionsData, error: sectionsError } = await supabase
    .from('sections')
    .insert(sectionsPayload)
    .select('id, section_number, tier, section_index, nearest_gate_id');

  if (sectionsError) {
    console.error('❌  Failed to insert sections:', sectionsError.message);
    process.exit(1);
  }

  const sectionIds = sectionsData!.map((s) => s.id);
  console.log(`\n✅  Inserted ${sectionsData!.length} sections:`);

  // Print a summary table
  sectionsData!.forEach((s) => {
    const gate = gatesData!.find((g) => g.id === s.nearest_gate_id);
    console.log(
      `     • [${s.section_index.toString().padStart(2, '0')}] ${s.section_number.padEnd(4)} (${s.tier}) → ${gate?.name ?? '?'}`,
    );
  });

  // 3. Insert seats
  const seatsPayload = buildSeats(sectionIds);
  const { data: seatsData, error: seatsError } = await supabase
    .from('seats')
    .insert(seatsPayload)
    .select('id');

  if (seatsError) {
    console.error('❌  Failed to insert seats:', seatsError.message);
    process.exit(1);
  }

  console.log(`\n✅  Inserted ${seatsData!.length} seats (5 per section)`);

  // 4. Summary
  console.log('\n─────────────────────────────────');
  console.log('📊  Seed summary:');
  console.log(`     Gates:    ${gatesData!.length}`);
  console.log(`     Sections: ${sectionsData!.length}`);
  console.log(`     Seats:    ${seatsData!.length}`);
  console.log('─────────────────────────────────');
  console.log('✨  Done!');
}

seed().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
