// ─── Constants ────────────────────────────────────────────────────────────────

export const TOTAL_SECTIONS = 24;
export const TWO_PI = Math.PI * 2;

// ── Ellipse axes (single source of truth for bowl shape) ──────────────────────
// radiusX is the wider axis (matches pitch length), radiusZ is narrower (pitch width).
// Ratio ~1.4 : 1 mirrors the ~5 : 3.2 pitch proportions, giving an oval silhouette.
export const BASE_RADIUS_X = 7.0; // wider axis
export const BASE_RADIUS_Z = 5.0; // narrower axis

// ── Tier scale factors (inner/outer edge of each tier as fractions of base) ───
// Lower tier: inner = 0.50, outer = 0.86
// Upper tier: inner = 0.93, outer = 1.29
export const LOWER_INNER_SCALE = 0.50;
export const LOWER_OUTER_SCALE = 0.86;
export const UPPER_INNER_SCALE = 0.93;
export const UPPER_OUTER_SCALE = 1.29;

// Convenience — actual X-axis radii for each tier edge (used in arc helpers)
export const LOWER_INNER_RX = BASE_RADIUS_X * LOWER_INNER_SCALE;
export const LOWER_OUTER_RX = BASE_RADIUS_X * LOWER_OUTER_SCALE;
export const UPPER_INNER_RX = BASE_RADIUS_X * UPPER_INNER_SCALE;
export const UPPER_OUTER_RX = BASE_RADIUS_X * UPPER_OUTER_SCALE;

export const LOWER_Y = 0;
export const LOWER_DEPTH = 1.2;
export const UPPER_Y = 2.0;
export const UPPER_DEPTH = 1.8;

// Concourse — the walkable band between the bowl rim and the gates
export const CONCOURSE_INNER_SCALE = UPPER_OUTER_SCALE + 0.02;
export const CONCOURSE_OUTER_SCALE = UPPER_OUTER_SCALE + 0.26;
export const CONCOURSE_MID_SCALE   = (CONCOURSE_INNER_SCALE + CONCOURSE_OUTER_SCALE) / 2;
export const CONCOURSE_Y = UPPER_Y + UPPER_DEPTH - 0.05;
export const CONCOURSE_THICKNESS = 0.12;

// Gate markers sit on the outer edge of the concourse
export const GATE_SCALE = CONCOURSE_OUTER_SCALE + 0.06;
export const GATE_Y = CONCOURSE_Y + 0.01;

// Vomitory dimensions (tunnel opening into the seating bowl)
export const VOM_WIDTH = 0.35;
export const VOM_HEIGHT = 0.7;
export const VOM_DEPTH_SIZE = 0.5;

// Pitch dimensions (kept as-is)
export const PITCH_LENGTH = 5.0;
export const PITCH_WIDTH = 3.2;

// Roof ring scale factor (sits above the mid-upper tier)
export const ROOF_SCALE = (UPPER_INNER_SCALE + UPPER_OUTER_SCALE) / 2;
export const ROOF_Y = UPPER_Y + UPPER_DEPTH + 1.5;

// ─── Single shared position helper ───────────────────────────────────────────
//
// THIS IS THE ONLY PLACE that converts an angle to a bowl position.
// Every wedge, gate, concourse point, vomitory, and path arc must call this.
//
// Convention:
//   angleDeg = 0   → positive X axis  (right side of the oval)
//   angleDeg = 90  → positive Z axis  (far end of the oval, narrower axis)
//   radiusScale    → multiplied against BASE_RADIUS_X / BASE_RADIUS_Z
//
// Returns [x, z] — caller supplies the Y coordinate.

export function bowlPosition(angleDeg: number, radiusScale = 1): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const rx = BASE_RADIUS_X * radiusScale;
  const rz = BASE_RADIUS_Z * radiusScale;
  const x  = Math.cos(rad) * rx;
  const z  = Math.sin(rad) * rz;
  return [x, z];
}

// ─── Derived angle helpers ────────────────────────────────────────────────────

/** Convert section_index (0–23) to its centre angle in degrees */
export function sectionAngleDeg(index: number): number {
  return (index / TOTAL_SECTIONS) * 360;
}

// ─── Colors (shared across 2D and 3D views) ──────────────────────────────────

export const COLOR_LOWER_DEFAULT = '#4f46e5';
export const COLOR_UPPER_DEFAULT = '#7c3aed';
export const COLOR_HIGHLIGHTED   = '#4ade80';
export const COLOR_GATE          = '#f59e0b';
export const COLOR_PATH          = '#4ade80';
export const COLOR_PITCH         = '#16a34a';
export const COLOR_PITCH_LINES   = '#22c55e';
export const COLOR_CONCOURSE     = '#9ca3af';
export const COLOR_VOMITORY      = '#0f0f1a';

// ─── Gate Color Mapping ───────────────────────────────────────────────────────

export const GATE_COLOR_MAP: Record<string, string> = {
  'gate a': '#3b82f6', // Vivid Blue
  'gate-a': '#3b82f6',
  'a':      '#3b82f6',

  'gate b': '#f59e0b', // Amber / Gold
  'gate-b': '#f59e0b',
  'b':      '#f59e0b',

  'gate c': '#ec4899', // Hot Pink / Magenta
  'gate-c': '#ec4899',
  'c':      '#ec4899',

  'gate d': '#8b5cf6', // Violet / Purple
  'gate-d': '#8b5cf6',
  'd':      '#8b5cf6',

  'gate e': '#06b6d4', // Cyan / Teal
  'gate-e': '#06b6d4',
  'e':      '#06b6d4',

  'gate f': '#ef4444', // Red
  'gate-f': '#ef4444',
  'f':      '#ef4444',

  'gate g': '#10b981', // Emerald Green
  'gate-g': '#10b981',
  'g':      '#10b981',

  'gate h': '#f97316', // Orange
  'gate-h': '#f97316',
  'h':      '#f97316',
};

// ─── Amenity Data ────────────────────────────────────────────────────────────
// Types for stadium amenities that can be toggled in the 3D view

export type AmenityType =
  | 'restroom'
  | 'food'
  | 'merchandise'
  | 'firstaid'
  | 'elevator'
  | 'exit';

export type Amenity = {
  id: string;
  type: AmenityType;
  name: string;
  icon: string;
  angle_deg: number;
  radiusScale: number;
  y: number;
};

export const AMENITY_TYPE_COLORS: Record<AmenityType, string> = {
  restroom: '#3b82f6',
  food: '#f59e0b',
  merchandise: '#ec4899',
  firstaid: '#ef4444',
  elevator: '#10b981',
  exit: '#8b5cf6',
};

export const AMENITY_TYPE_LABELS: Record<AmenityType, string> = {
  restroom: 'Restrooms & Accessible Toilets',
  food: 'Food & Beverage',
  merchandise: 'Official Merchandise & Kiosks',
  firstaid: 'First Aid & Medical Stations',
  elevator: 'Elevators, Ramps & Step-Free Routes',
  exit: 'Exits & Emergency Evacuation Routes',
};

export const AMENITY_ICONS: Record<AmenityType, string> = {
  restroom: '\u{1F6BB}',
  food: '\u{1F37D}',
  merchandise: '\u{1F6CD}',
  firstaid: '\u{1F3E5}',
  elevator: '\u{1F6D7}',
  exit: '\u{1F6AA}',
};

const AMENITY_SCALE = CONCOURSE_OUTER_SCALE + 0.10;
const AMENITY_Y = CONCOURSE_Y + CONCOURSE_THICKNESS + 0.01;

const AMENITIES_DATA: Amenity[] = (() => {
  const list: Amenity[] = [];
  const step = 4;

  // Restrooms every 4 sections
  for (let i = 0; i < TOTAL_SECTIONS; i += step) {
    list.push({
      id: `restroom-${i}`,
      type: 'restroom',
      name: 'Restrooms',
      icon: AMENITY_ICONS.restroom,
      angle_deg: sectionAngleDeg(i),
      radiusScale: AMENITY_SCALE,
      y: AMENITY_Y,
    });
  }

  // Food & Beverage every 4 sections offset by 2
  for (let i = 2; i < TOTAL_SECTIONS; i += step) {
    list.push({
      id: `food-${i}`,
      type: 'food',
      name: 'Food & Beverage',
      icon: AMENITY_ICONS.food,
      angle_deg: sectionAngleDeg(i),
      radiusScale: AMENITY_SCALE,
      y: AMENITY_Y,
    });
  }

  // Merchandise stores/kiosks every 4 sections offset by 1
  for (let i = 1; i < TOTAL_SECTIONS; i += step) {
    list.push({
      id: `merch-${i}`,
      type: 'merchandise',
      name: i === 1 ? 'Official Merch Store' : 'Pop-up Kiosk',
      icon: AMENITY_ICONS.merchandise,
      angle_deg: sectionAngleDeg(i),
      radiusScale: AMENITY_SCALE,
      y: AMENITY_Y,
    });
  }

  // First Aid stations at 4 locations (every 6 sections offset by 3)
  for (let i = 3; i < TOTAL_SECTIONS; i += 6) {
    list.push({
      id: `firstaid-${i}`,
      type: 'firstaid',
      name: 'First Aid Station',
      icon: AMENITY_ICONS.firstaid,
      angle_deg: sectionAngleDeg(i),
      radiusScale: AMENITY_SCALE,
      y: AMENITY_Y,
    });
  }

  // Elevators / ramps / step-free routes — 4 locations on inner concourse
  for (let i = 1; i < TOTAL_SECTIONS; i += 6) {
    list.push({
      id: `elevator-${i}`,
      type: 'elevator',
      name: 'Elevator / Accessible Ramp',
      icon: AMENITY_ICONS.elevator,
      angle_deg: sectionAngleDeg(i),
      radiusScale: CONCOURSE_INNER_SCALE + 0.02,
      y: AMENITY_Y,
    });
  }

  // Emergency exits at 8 key locations
  const exitIndices = [0, 3, 6, 9, 12, 15, 18, 21];
  for (const idx of exitIndices) {
    list.push({
      id: `exit-${idx}`,
      type: 'exit',
      name: 'Emergency Exit',
      icon: AMENITY_ICONS.exit,
      angle_deg: sectionAngleDeg(idx),
      radiusScale: CONCOURSE_OUTER_SCALE + 0.08,
      y: AMENITY_Y,
    });
  }

  return list;
})();

export function getAmenitiesByType(type: AmenityType): Amenity[] {
  return AMENITIES_DATA.filter((a) => a.type === type);
}

export function getAllAmenities(): Amenity[] {
  return AMENITIES_DATA;
}

const GATE_PALETTE = [
  '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#ef4444', '#10b981', '#f97316', '#6366f1', '#14b8a6',
];

/**
 * Returns the unique color assigned to a specific gate.
 * If the gate name/ID matches a known key, returns its color.
 * Otherwise, deterministically computes a color from the string hash.
 */
export function getGateColor(gateNameOrId?: string | null): string {
  if (!gateNameOrId) return COLOR_GATE;
  const key = gateNameOrId.trim().toLowerCase();
  if (GATE_COLOR_MAP[key]) {
    return GATE_COLOR_MAP[key];
  }

  // Deterministic fallback based on character code sum
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % GATE_PALETTE.length;
  return GATE_PALETTE[idx];
}
