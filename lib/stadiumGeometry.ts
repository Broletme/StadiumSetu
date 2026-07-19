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
