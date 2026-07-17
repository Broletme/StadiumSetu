'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html, Text } from '@react-three/drei';
import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

type Gate = {
  id: string;
  name: string;
  angle_deg: number;
  lat: number | null;
  lng: number | null;
};

type Zone = {
  id: string;
  section_number: string;
  tier: string;
  section_index: number;
  nearest_gate_id: string;
  gate: Gate;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_SECTIONS = 24;
const TWO_PI = Math.PI * 2;

// ── Ellipse axes (single source of truth for bowl shape) ──────────────────────
// radiusX is the wider axis (matches pitch length), radiusZ is narrower (pitch width).
// Ratio ~1.4 : 1 mirrors the ~5 : 3.2 pitch proportions, giving an oval silhouette.
const BASE_RADIUS_X = 7.0; // wider axis
const BASE_RADIUS_Z = 5.0; // narrower axis

// ── Tier scale factors (inner/outer edge of each tier as fractions of base) ───
// Lower tier: inner = 0.50, outer = 0.86
// Upper tier: inner = 0.93, outer = 1.29
const LOWER_INNER_SCALE = 0.50;
const LOWER_OUTER_SCALE = 0.86;
const UPPER_INNER_SCALE = 0.93;
const UPPER_OUTER_SCALE = 1.29;

// Convenience — actual X-axis radii for each tier edge (used in arc helpers)
const LOWER_INNER_RX = BASE_RADIUS_X * LOWER_INNER_SCALE;
const LOWER_OUTER_RX = BASE_RADIUS_X * LOWER_OUTER_SCALE;
const UPPER_INNER_RX = BASE_RADIUS_X * UPPER_INNER_SCALE;
const UPPER_OUTER_RX = BASE_RADIUS_X * UPPER_OUTER_SCALE;

const LOWER_Y = 0;
const LOWER_DEPTH = 1.2;
const UPPER_Y = 2.0;
const UPPER_DEPTH = 1.8;

// Concourse — the walkable band between the bowl rim and the gates
const CONCOURSE_INNER_SCALE = UPPER_OUTER_SCALE + 0.02;
const CONCOURSE_OUTER_SCALE = UPPER_OUTER_SCALE + 0.26;
const CONCOURSE_MID_SCALE   = (CONCOURSE_INNER_SCALE + CONCOURSE_OUTER_SCALE) / 2;
const CONCOURSE_Y = UPPER_Y + UPPER_DEPTH - 0.05;
const CONCOURSE_THICKNESS = 0.12;

// Gate markers sit on the outer edge of the concourse
const GATE_SCALE = CONCOURSE_OUTER_SCALE + 0.06;
const GATE_Y = CONCOURSE_Y + 0.01;

// Vomitory dimensions (tunnel opening into the seating bowl)
const VOM_WIDTH = 0.35;
const VOM_HEIGHT = 0.7;
const VOM_DEPTH_SIZE = 0.5;

// Pitch dimensions (kept as-is)
const PITCH_LENGTH = 5.0;
const PITCH_WIDTH = 3.2;

// Roof ring scale factor (sits above the mid-upper tier)
const ROOF_SCALE = (UPPER_INNER_SCALE + UPPER_OUTER_SCALE) / 2;
const ROOF_Y = UPPER_Y + UPPER_DEPTH + 1.5;

// Colors
const COLOR_LOWER_DEFAULT = '#4f46e5';
const COLOR_UPPER_DEFAULT = '#7c3aed';
const COLOR_HIGHLIGHTED   = '#4ade80';
const COLOR_GATE          = '#f59e0b';
const COLOR_PATH          = '#4ade80';
const COLOR_PITCH         = '#16a34a';
const COLOR_PITCH_LINES   = '#22c55e';
const COLOR_CONCOURSE     = '#9ca3af';
const COLOR_VOMITORY      = '#0f0f1a';

// Path animation
const PATH_SPHERE_COUNT  = 5;
const PATH_SPHERE_RADIUS = 0.15;

// ─── Single shared position helper ───────────────────────────────────────────
//
// THIS IS THE ONLY PLACE in the file that converts an angle to a bowl position.
// Every wedge, gate, concourse point, vomitory, and path arc must call this.
//
// Convention:
//   angleDeg = 0   → positive X axis  (right side of the oval)
//   angleDeg = 90  → positive Z axis  (far end of the oval, narrower axis)
//   radiusScale    → multiplied against BASE_RADIUS_X / BASE_RADIUS_Z
//
// Returns [x, z] — caller supplies the Y coordinate.

function bowlPosition(angleDeg: number, radiusScale = 1): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const rx = BASE_RADIUS_X * radiusScale;
  const rz = BASE_RADIUS_Z * radiusScale;
  const x  = Math.cos(rad) * rx;
  const z  = Math.sin(rad) * rz;
  return [x, z];
}

// ─── Derived angle helpers ────────────────────────────────────────────────────

/** Convert section_index (0–23) to its centre angle in degrees */
function sectionAngleDeg(index: number): number {
  return (index / TOTAL_SECTIONS) * 360;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** World-space centre of a wedge at a given tier */
function wedgeCentre(
  index: number,
  innerScale: number,
  outerScale: number,
  y: number,
  depth: number,
): THREE.Vector3 {
  const deg  = sectionAngleDeg(index);
  const midScale = (innerScale + outerScale) / 2;
  const [x, z] = bowlPosition(deg, midScale);
  return new THREE.Vector3(x, y + depth / 2, z);
}

/** Gate position from angle_deg — sits on the outer edge of the concourse */
function gatePosition(angleDeg: number): THREE.Vector3 {
  const [x, z] = bowlPosition(angleDeg, GATE_SCALE);
  return new THREE.Vector3(x, GATE_Y, z);
}

/** Point on the concourse mid-ellipse at a given angle in degrees */
function concoursePoint(angleDeg: number): THREE.Vector3 {
  const [x, z] = bowlPosition(angleDeg, CONCOURSE_MID_SCALE);
  return new THREE.Vector3(x, CONCOURSE_Y + CONCOURSE_THICKNESS + 0.05, z);
}

/**
 * Compute shortest-direction arc points along the elliptical concourse,
 * from startDeg to endDeg, returning an array of THREE.Vector3.
 */
function arcPoints(startDeg: number, endDeg: number, numPoints: number): THREE.Vector3[] {
  // Normalize the angular difference to [-180, 180] for shortest path
  let diff = endDeg - startDeg;
  while (diff > 180)  diff -= 360;
  while (diff < -180) diff += 360;

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t   = i / numPoints;
    const deg = startDeg + diff * t;
    pts.push(concoursePoint(deg));
  }
  return pts;
}

/**
 * Build an elliptical wedge (ring-sector) using a direct BufferGeometry
 * whose vertex XZ positions come straight from bowlPosition() — the same
 * formula used by buildEllipseRingGeometry, ConcourseRing, and GateMarker.
 *
 * Vertex layout per arc-step (column of 4):
 *   [0] outer-top    (y = 0)
 *   [1] outer-bottom (y = -depth)
 *   [2] inner-bottom (y = -depth)
 *   [3] inner-top    (y = 0)
 *
 * The mesh is positioned at [0, y + depth, 0], so the wedge occupies
 * world Y in [y, y + depth] (bottom = y, top = y + depth).
 */
function buildWedgeGeometry(
  innerScale: number,
  outerScale: number,
  sectionIndex: number,
  depth: number,
): THREE.BufferGeometry {
  const centreDeg  = sectionAngleDeg(sectionIndex);
  const halfSpanDeg = (360 / TOTAL_SECTIONS) * 0.46; // slight gap between wedges
  const steps = 12; // arc subdivisions per wedge

  const positions: number[] = [];
  const indices:   number[] = [];

  // ── Build vertex columns along the arc ──────────────────────────────────────
  for (let i = 0; i <= steps; i++) {
    const deg = centreDeg - halfSpanDeg + (i / steps) * halfSpanDeg * 2;
    const [ox, oz] = bowlPosition(deg, outerScale);
    const [ix, iz] = bowlPosition(deg, innerScale);

    positions.push(ox,  0,      oz);   // [0] outer-top
    positions.push(ox, -depth,  oz);   // [1] outer-bottom
    positions.push(ix, -depth,  iz);   // [2] inner-bottom
    positions.push(ix,  0,      iz);   // [3] inner-top
  }

  // ── Connect adjacent columns into quads ─────────────────────────────────────
  for (let i = 0; i < steps; i++) {
    const b = i * 4;       // base column vertex offset
    const n = (i + 1) * 4; // next column vertex offset

    // Top face (CCW from above → normal +Y)
    indices.push(b + 0, n + 3, n + 0);
    indices.push(b + 0, b + 3, n + 3);

    // Bottom face (CW from above → normal -Y)
    indices.push(b + 1, n + 1, n + 2);
    indices.push(b + 1, n + 2, b + 2);

    // Outer wall (normal points outward)
    indices.push(b + 0, n + 0, n + 1);
    indices.push(b + 0, n + 1, b + 1);

    // Inner wall (normal points inward)
    indices.push(b + 3, b + 2, n + 2);
    indices.push(b + 3, n + 2, n + 3);
  }

  // ── End caps (left and right radial edges) ───────────────────────────────────
  // Left cap (i = 0)
  indices.push(0, 3, 2);
  indices.push(0, 2, 1);

  // Right cap (i = steps)
  const last = steps * 4;
  indices.push(last + 0, last + 1, last + 2);
  indices.push(last + 0, last + 2, last + 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build a closed elliptical ring mesh (replaces THREE.TorusGeometry which is
 * always circular). The ring has an inner and outer ellipse, connected by a
 * flat top/bottom face, and is a single BufferGeometry lying in the XZ plane.
 */
function buildEllipseRingGeometry(
  innerScale: number,
  outerScale: number,
  thickness: number,
  segments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // We build two rings of vertices (outer top, inner top) and extrude by -thickness
  // Vertex layout per segment (column):
  //   0: outer-top     [outerX, +thickness/2, outerZ]
  //   1: inner-top     [innerX, +thickness/2, innerZ]
  //   2: inner-bottom  [innerX, -thickness/2, innerZ]
  //   3: outer-bottom  [outerX, -thickness/2, outerZ]

  for (let i = 0; i <= segments; i++) {
    const deg = (i / segments) * 360;
    const [ox, oz] = bowlPosition(deg, outerScale);
    const [ix, iz] = bowlPosition(deg, innerScale);
    const t = thickness / 2;

    // top-outer, top-inner, bot-inner, bot-outer
    positions.push(ox, t, oz,  ix, t, iz,  ix, -t, iz,  ox, -t, oz);
    normals.push(0, 1, 0,  0, 1, 0,  0, -1, 0,  0, -1, 0);
  }

  // Build quads: top face, bottom face, inner wall, outer wall
  for (let i = 0; i < segments; i++) {
    const base = i * 4;
    const next = (i + 1) * 4;

    // top face (outward winding)
    indices.push(base,     next,     next + 1);
    indices.push(base,     next + 1, base + 1);

    // bottom face (inward winding)
    indices.push(base + 3, base + 2, next + 2);
    indices.push(base + 3, next + 2, next + 3);

    // outer wall
    indices.push(base,     base + 3, next + 3);
    indices.push(base,     next + 3, next);

    // inner wall
    indices.push(base + 1, next + 1, next + 2);
    indices.push(base + 1, next + 2, base + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─── Seat instance helpers ────────────────────────────────────────────────────

const SEAT_ROWS = 5;         // rows of seats per wedge
const SEATS_PER_ROW = 8;     // seats per row within a wedge
const SEAT_W = 0.12;         // seat block width
const SEAT_H = 0.06;         // seat cushion height
const SEAT_D = 0.10;         // seat cushion depth

// ── Build chair geometries separately (cushion + backrest) ──────────────────
// Instead of merging (which can cause ESM or attribute issues in some bundlers),
// we use two separate geometries. They will share the same instance matrices.
const seatCushionGeo = new THREE.BoxGeometry(SEAT_W, SEAT_H, SEAT_D);

const backW = SEAT_W;
const backH = SEAT_H * 1.6;
const backD = SEAT_H * 0.5;
const seatBackrestGeo = new THREE.BoxGeometry(backW, backH, backD);

// Pre-transform the backrest geometry so its local origin matches the cushion's
// local origin. This allows us to use the EXACT same instance matrix for both.
const backMatrix = new THREE.Matrix4();
backMatrix.makeRotationX(-0.14); // tilt back ~8°
const offsetMatrix = new THREE.Matrix4().makeTranslation(
  0,
  SEAT_H / 2 + backH / 2 - 0.01,
  -SEAT_D / 2 + backD / 2,
);
backMatrix.premultiply(offsetMatrix);
seatBackrestGeo.applyMatrix4(backMatrix);

/** Deterministic pseudo-random from index (avoids re-randomising each frame) */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Build instanced seat transforms + colors for a single wedge.
 * Returns { count, matrices, colors } — caller creates InstancedMesh.
 */
function buildSeatInstances(
  sectionIndex: number,
  innerScale: number,
  outerScale: number,
  y: number,
  depth: number,
  highlighted: boolean,
  isLower: boolean,
) {
  const centreDeg   = sectionAngleDeg(sectionIndex);
  const halfSpanDeg = (360 / TOTAL_SECTIONS) * 0.42; // slightly inset from wedge edges
  const count       = SEAT_ROWS * SEATS_PER_ROW;
  const matrices: THREE.Matrix4[] = [];
  const colors:  THREE.Color[]    = [];

  const baseColor = highlighted
    ? new THREE.Color(COLOR_HIGHLIGHTED)
    : isLower
      ? new THREE.Color(COLOR_LOWER_DEFAULT)
      : new THREE.Color(COLOR_UPPER_DEFAULT);

  const dummy = new THREE.Object3D();

  for (let row = 0; row < SEAT_ROWS; row++) {
    // Interpolate radial scale between inner and outer for this row
    const rowT     = (row + 0.5) / SEAT_ROWS;
    const rowScale = innerScale + (outerScale - innerScale) * rowT;
    // Y position: seats sit on top of the wedge, stacked upward slightly per row
    const seatY    = y + depth + SEAT_H / 2 + row * (SEAT_H + 0.015);

    for (let col = 0; col < SEATS_PER_ROW; col++) {
      const colT = (col + 0.5) / SEATS_PER_ROW;
      const deg  = centreDeg - halfSpanDeg + colT * halfSpanDeg * 2;
      const [sx, sz] = bowlPosition(deg, rowScale);

      // Face the seat toward the pitch centre
      const yawRad = -(deg * Math.PI) / 180 + Math.PI / 2;

      dummy.position.set(sx, seatY, sz);
      dummy.rotation.set(0, yawRad, 0);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());

      // Subtle per-seat color variation
      const seed = sectionIndex * 1000 + row * 100 + col;
      const hueShift  = (pseudoRandom(seed) - 0.5) * 0.06;
      const lightShift = (pseudoRandom(seed + 1) - 0.5) * 0.12;
      const c = baseColor.clone();
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      c.setHSL(hsl.h + hueShift, Math.min(1, Math.max(0, hsl.s)), Math.min(1, Math.max(0, hsl.l + lightShift)));
      colors.push(c);
    }
  }

  return { count, matrices, colors };
}

/** InstancedMesh rendering all seats within a single wedge */
function SeatRows({
  sectionIndex,
  innerScale,
  outerScale,
  y,
  depth,
  highlighted,
  isLower,
}: {
  sectionIndex: number;
  innerScale: number;
  outerScale: number;
  y: number;
  depth: number;
  highlighted: boolean;
  isLower: boolean;
}) {
  const cushionRef = useRef<THREE.InstancedMesh>(null);
  const backrestRef = useRef<THREE.InstancedMesh>(null);

  const { count, matrices, colors } = useMemo(
    () => buildSeatInstances(sectionIndex, innerScale, outerScale, y, depth, highlighted, isLower),
    [sectionIndex, innerScale, outerScale, y, depth, highlighted, isLower],
  );

  // Apply transforms + per-instance colors
  useMemo(() => {
    const applyToMesh = (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      for (let i = 0; i < count; i++) {
        mesh.setMatrixAt(i, matrices[i]);
        mesh.setColorAt(i, colors[i]);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    applyToMesh(cushionRef.current);
    applyToMesh(backrestRef.current);
  }, [count, matrices, colors]);

  const setCushionRef = (inst: THREE.InstancedMesh | null) => {
    (cushionRef as React.MutableRefObject<THREE.InstancedMesh | null>).current = inst;
    if (!inst) return;
    for (let i = 0; i < count; i++) {
      inst.setMatrixAt(i, matrices[i]);
      inst.setColorAt(i, colors[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  };

  const setBackrestRef = (inst: THREE.InstancedMesh | null) => {
    (backrestRef as React.MutableRefObject<THREE.InstancedMesh | null>).current = inst;
    if (!inst) return;
    for (let i = 0; i < count; i++) {
      inst.setMatrixAt(i, matrices[i]);
      inst.setColorAt(i, colors[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  };

  const materialProps = {
    roughness: 0.55,
    metalness: 0.2,
    emissive: highlighted ? new THREE.Color(COLOR_HIGHLIGHTED) : new THREE.Color('#000000'),
    emissiveIntensity: highlighted ? 0.4 : 0,
  };

  return (
    <group>
      <instancedMesh
        ref={setCushionRef}
        args={[seatCushionGeo, undefined, count]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...materialProps} />
      </instancedMesh>
      <instancedMesh
        ref={setBackrestRef}
        args={[seatBackrestGeo, undefined, count]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...materialProps} />
      </instancedMesh>
    </group>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Single wedge mesh — with heartbeat scale + glow pulse when highlighted */
function Wedge({
  index,
  isLower,
  highlighted,
}: {
  index: number;
  isLower: boolean;
  highlighted: boolean;
}) {
  const innerScale = isLower ? LOWER_INNER_SCALE : UPPER_INNER_SCALE;
  const outerScale = isLower ? LOWER_OUTER_SCALE : UPPER_OUTER_SCALE;
  const y     = isLower ? LOWER_Y     : UPPER_Y;
  const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;

  const geo = useMemo(
    () => buildWedgeGeometry(innerScale, outerScale, index, depth),
    [innerScale, outerScale, index, depth],
  );

  const meshRef  = useRef<THREE.Mesh>(null);
  const matRef   = useRef<THREE.MeshStandardMaterial>(null);
  const clockRef = useRef(0);

  useFrame((_state, delta) => {
    if (!highlighted) {
      if (meshRef.current) meshRef.current.scale.setScalar(1);
      if (matRef.current)  matRef.current.emissiveIntensity = 0;
      return;
    }
    clockRef.current += delta;
    const t = clockRef.current;

    // Heartbeat scale
    const period = 1.1;
    const phase  = (t % period) / period;
    const beat1  = Math.max(0, Math.sin(phase * Math.PI * 2)) ** 3;
    const beat2  = Math.max(0, Math.sin((phase - 0.28) * Math.PI * 2)) ** 3;
    const heartbeat = beat1 * 0.055 + beat2 * 0.035;
    if (meshRef.current) meshRef.current.scale.setScalar(1 + heartbeat);

    // Glow pulse
    const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3.5));
    if (matRef.current) matRef.current.emissiveIntensity = glow;
  });

  const color = highlighted
    ? COLOR_HIGHLIGHTED
    : isLower
      ? COLOR_LOWER_DEFAULT
      : COLOR_UPPER_DEFAULT;

  return (
    <group>
      {/* Base wedge (structural shell) */}
      <mesh ref={meshRef} geometry={geo} position={[0, y + depth, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          ref={matRef}
          color={color}
          roughness={0.45}
          metalness={0.3}
          emissive={highlighted ? COLOR_HIGHLIGHTED : '#000000'}
          emissiveIntensity={highlighted ? 0.5 : 0}
        />
      </mesh>
      {/* Instanced seat blocks sitting on top of the wedge */}
      <SeatRows
        sectionIndex={index}
        innerScale={innerScale}
        outerScale={outerScale}
        y={y}
        depth={depth}
        highlighted={highlighted}
        isLower={isLower}
      />
    </group>
  );
}

/** Green pitch plane in the centre of the bowl (unchanged) */
function Pitch() {
  return (
    <group>
      {/* Main pitch surface — plain PlaneGeometry, no elliptical transform.
           Double-sided so it is visible regardless of camera angle / winding. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[PITCH_LENGTH, PITCH_WIDTH]} />
        <meshStandardMaterial
          color={COLOR_PITCH}
          roughness={0.85}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Centre circle outline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.55, 0.6, 32]} />
        <meshStandardMaterial
          color={COLOR_PITCH_LINES}
          roughness={0.7}
          transparent
          opacity={0.5}
        />
      </mesh>
      {/* Centre line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[0.04, PITCH_WIDTH * 0.92]} />
        <meshStandardMaterial
          color={COLOR_PITCH_LINES}
          roughness={0.7}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}

/**
 * Angled canopy ring — a partial cone / lofted ring that overhangs the upper
 * tier. Open in the centre like a real stadium roof. Built as a custom
 * BufferGeometry with inner/outer ellipses at different heights so it angles
 * downward toward the pitch.
 */
function RoofCanopy() {
  const geo = useMemo(() => {
    const segments = 64;
    const innerScale = ROOF_SCALE - 0.20;   // inner edge (closer to pitch, higher)
    const outerScale = ROOF_SCALE + 0.45;   // outer edge (over upper tier, lower)
    const innerY     = 0.55;                // height of inner lip above ROOF_Y
    const outerY     = -0.20;               // outer lip drops below ROOF_Y (angled)
    const thickness  = 0.15;                // vertical thickness of the canopy slab

    const positions: number[] = [];
    const indices:   number[] = [];

    // 4 verts per segment column:
    //  0: outer-top   1: outer-bottom   2: inner-bottom   3: inner-top
    for (let i = 0; i <= segments; i++) {
      const deg = (i / segments) * 360;
      const [ox, oz] = bowlPosition(deg, outerScale);
      const [ix, iz] = bowlPosition(deg, innerScale);
      positions.push(ox, outerY + thickness / 2, oz); // 0 outer-top
      positions.push(ox, outerY - thickness / 2, oz); // 1 outer-bot
      positions.push(ix, innerY - thickness / 2, iz); // 2 inner-bot
      positions.push(ix, innerY + thickness / 2, iz); // 3 inner-top
    }

    for (let i = 0; i < segments; i++) {
      const b = i * 4;
      const n = (i + 1) * 4;
      // top surface
      indices.push(b, n, n + 3);  indices.push(b, n + 3, b + 3);
      // bottom surface
      indices.push(b + 1, b + 2, n + 2);  indices.push(b + 1, n + 2, n + 1);
      // outer wall
      indices.push(b, b + 1, n + 1);  indices.push(b, n + 1, n);
      // inner wall
      indices.push(b + 3, n + 3, n + 2);  indices.push(b + 3, n + 2, b + 2);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geo} position={[0, ROOF_Y, 0]}>
      <meshStandardMaterial
        color="#1e1b4b"
        roughness={0.5}
        metalness={0.6}
        transparent
        opacity={0.45}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Floodlight Towers ───────────────────────────────────────────────────────

const FLOODLIGHT_ANGLES = [45, 135, 225, 315]; // 4 evenly spaced around the bowl
const FLOODLIGHT_POLE_HEIGHT = 8.0;
const FLOODLIGHT_SCALE = CONCOURSE_OUTER_SCALE + 0.45; // outside the concourse

function FloodlightTowers() {
  return (
    <group>
      {FLOODLIGHT_ANGLES.map((angleDeg) => {
        const [px, pz] = bowlPosition(angleDeg, FLOODLIGHT_SCALE);
        const baseY    = CONCOURSE_Y;
        const topY     = baseY + FLOODLIGHT_POLE_HEIGHT;

        return (
          <group key={`flood-${angleDeg}`}>
            {/* Pole (thin cylinder) */}
            <mesh position={[px, baseY + FLOODLIGHT_POLE_HEIGHT / 2, pz]}>
              <cylinderGeometry args={[0.06, 0.08, FLOODLIGHT_POLE_HEIGHT, 8]} />
              <meshStandardMaterial color="#4b5563" roughness={0.8} metalness={0.4} />
            </mesh>

            {/* Light fixture (flat box at the top) */}
            <mesh position={[px, topY + 0.1, pz]}>
              <boxGeometry args={[0.7, 0.12, 0.4]} />
              <meshStandardMaterial
                color="#fef9c3"
                emissive="#fde68a"
                emissiveIntensity={2.5}
                roughness={0.1}
                metalness={0.1}
              />
            </mesh>

            {/* Point light for illumination onto seats */}
            <pointLight
              position={[px, topY + 0.3, pz]}
              color="#fffbeb"
              intensity={8}
              distance={18}
              decay={2}
            />
          </group>
        );
      })}
    </group>
  );
}

// ─── Tier Labels ─────────────────────────────────────────────────────────────

/** Floating tier labels positioned behind the pitch at 90° */
function TierLabels() {
  // Position labels at angle 90° (positive-Z end of oval, behind the pitch)
  const labelAngleDeg = 90;

  // Lower tier label — sit above the outer edge of the lower tier
  const lowerMidScale = (LOWER_INNER_SCALE + LOWER_OUTER_SCALE) / 2;
  const [lx, lz] = bowlPosition(labelAngleDeg, lowerMidScale + 0.08);
  const lowerY = LOWER_Y + LOWER_DEPTH + 0.8;

  // Upper tier label — sit above the outer edge of the upper tier
  const upperMidScale = (UPPER_INNER_SCALE + UPPER_OUTER_SCALE) / 2;
  const [ux, uz] = bowlPosition(labelAngleDeg, upperMidScale + 0.08);
  const upperY = UPPER_Y + UPPER_DEPTH + 1.2;

  const labelStyle: React.CSSProperties = {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
    letterSpacing: '0.18em',
    opacity: 0.65,
    pointerEvents: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  };

  return (
    <group>
      <Html position={[lx, lowerY, lz]} center style={labelStyle}>
        LOWER TIER
      </Html>
      <Html position={[ux, upperY, uz]} center style={labelStyle}>
        UPPER TIER
      </Html>
    </group>
  );
}

/** Flat walkable elliptical concourse ring between the bowl and the gates */
function ConcourseRing() {
  const geo = useMemo(
    () => buildEllipseRingGeometry(CONCOURSE_INNER_SCALE, CONCOURSE_OUTER_SCALE, CONCOURSE_THICKNESS, 64),
    [],
  );

  return (
    <mesh geometry={geo} position={[0, CONCOURSE_Y, 0]} receiveShadow>
      <meshStandardMaterial color={COLOR_CONCOURSE} roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

/** A single vomitory (tunnel opening) at a section's angle */
function Vomitory({ sectionIndex }: { sectionIndex: number }) {
  const deg = sectionAngleDeg(sectionIndex);

  // Place on the outer-inner edge of the upper tier, scaled slightly inward
  const vomScale = UPPER_OUTER_SCALE - 0.04;
  const [x, z]  = bowlPosition(deg, vomScale);

  // Rotate to face the centre — for a point at [cos(θ)·rx, sin(θ)·rz],
  // the tangent-perpendicular (inward normal) has yaw = -(π/2 - θ) = θ - π/2.
  // In Three.js Y-up, rotating by -(deg in rad) around Y points the mesh outward
  // when the shape's local +Z is the "front". We negate to flip inward.
  const yawRad = -(deg * Math.PI) / 180 + Math.PI / 2;

  return (
    <mesh
      position={[x, UPPER_Y + VOM_HEIGHT / 2 + 0.01, z]}
      rotation={[0, yawRad, 0]}
    >
      <boxGeometry args={[VOM_WIDTH, VOM_HEIGHT, VOM_DEPTH_SIZE]} />
      <meshStandardMaterial color={COLOR_VOMITORY} roughness={1} metalness={0} />
    </mesh>
  );
}

/** Gate archway structure + Html label billboard */
function GateMarker({ gate }: { gate: Gate }) {
  // Use bowlPosition (via gatePosition) — same formula as every other element
  const pos    = gatePosition(gate.angle_deg);
  const yawRad = -(gate.angle_deg * Math.PI) / 180 + Math.PI / 2;

  // ── Alignment diagnostic (checked every render — visible in browser console) ─
  console.log(
    `[GateMarker] ${gate.name}  angle_deg=${gate.angle_deg.toFixed(2)}` +
    `  bowlPos(scale=${GATE_SCALE.toFixed(3)}) → x=${pos.x.toFixed(3)}, z=${pos.z.toFixed(3)}`,
  );

  const archWidth  = 1.0;
  const archHeight = 1.4;
  const archDepth  = 0.3;
  const pillarWidth = 0.18;

  return (
    <group position={pos} rotation={[0, yawRad, 0]}>
      {/* Left pillar */}
      <mesh position={[-archWidth / 2 + pillarWidth / 2, archHeight / 2, 0]}>
        <boxGeometry args={[pillarWidth, archHeight, archDepth]} />
        <meshStandardMaterial
          color={COLOR_GATE}
          emissive={COLOR_GATE}
          emissiveIntensity={0.5}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>
      {/* Right pillar */}
      <mesh position={[archWidth / 2 - pillarWidth / 2, archHeight / 2, 0]}>
        <boxGeometry args={[pillarWidth, archHeight, archDepth]} />
        <meshStandardMaterial
          color={COLOR_GATE}
          emissive={COLOR_GATE}
          emissiveIntensity={0.5}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>
      {/* Top beam (lintel) */}
      <mesh position={[0, archHeight, 0]}>
        <boxGeometry args={[archWidth, 0.2, archDepth]} />
        <meshStandardMaterial
          color={COLOR_GATE}
          emissive={COLOR_GATE}
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
      {/* Gate name label */}
      <Html
        position={[0, archHeight + 0.55, 0]}
        center
        style={{
          color: '#f59e0b',
          fontSize: '11px',
          fontWeight: 700,
          fontFamily: "'Inter', system-ui, sans-serif",
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '2px 7px',
          borderRadius: '4px',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {gate.name}
      </Html>
    </group>
  );
}

/** A single glowing sphere that travels along a composite CatmullRomCurve3 */
function PathSphere({
  curve,
  phaseOffset,
}: {
  curve: THREE.CatmullRomCurve3;
  phaseOffset: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tRef    = useRef(phaseOffset);

  useFrame((_state, delta) => {
    tRef.current = (tRef.current + delta * 0.22) % 1;
    if (meshRef.current) {
      const point = curve.getPoint(tRef.current);
      meshRef.current.position.copy(point);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[PATH_SPHERE_RADIUS, 12, 12]} />
      <meshStandardMaterial
        color={COLOR_PATH}
        emissive={COLOR_PATH}
        emissiveIntensity={0.9}
        transparent
        opacity={0.85}
        roughness={0.2}
        metalness={0.1}
      />
    </mesh>
  );
}

/**
 * Realistic wayfinding path: gate → concourse arc → vomitory → section.
 * The concourse arc follows the ELLIPTICAL concourse via concoursePoint(),
 * which itself calls bowlPosition() — so the path is consistent with all
 * other elements in the scene.
 */
function PathLine({ zone }: { zone: Zone }) {
  const isLower    = zone.tier.toLowerCase().includes('lower');
  const innerScale = isLower ? LOWER_INNER_SCALE : UPPER_INNER_SCALE;
  const outerScale = isLower ? LOWER_OUTER_SCALE : UPPER_OUTER_SCALE;
  const y          = isLower ? LOWER_Y     : UPPER_Y;
  const depth      = isLower ? LOWER_DEPTH : UPPER_DEPTH;

  const gateDeg    = zone.gate.angle_deg;
  const sectionDeg = sectionAngleDeg(zone.section_index);

  // Key positions — all derived from bowlPosition() via the shared helpers
  const gatePos    = gatePosition(gateDeg);
  const sectionPos = wedgeCentre(zone.section_index, innerScale, outerScale, y, depth);

  // ── U04 / Gate-C alignment diagnostic ──────────────────────────────────────
  // Log exact angles and bowlPosition outputs for every search result so we
  // can verify section↔gate alignment without eyeballing the 3-D scene.
  const [_bpGX, _bpGZ] = bowlPosition(gateDeg, GATE_SCALE);
  const [_bpSX, _bpSZ] = bowlPosition(sectionDeg, (innerScale + outerScale) / 2);
  const angularDelta    = ((sectionDeg - gateDeg + 540) % 360) - 180; // shortest diff
  console.log(
    `[PathLine alignment]\n` +
    `  section ${zone.section_number}  index=${zone.section_index}` +
    `  sectionDeg=${sectionDeg.toFixed(2)}°` +
    `  bowlPos → x=${_bpSX.toFixed(3)}, z=${_bpSZ.toFixed(3)}\n` +
    `  gate "${zone.gate.name}"  angle_deg=${gateDeg.toFixed(2)}°` +
    `  bowlPos(GATE_SCALE) → x=${_bpGX.toFixed(3)}, z=${_bpGZ.toFixed(3)}\n` +
    `  angularDelta (section - gate)=${angularDelta.toFixed(2)}°  ` +
    `(should be ≈ 0 for adjacent gate, ±15 for neighbouring gate)`,
  );

  const { curve, curvePoints, vomPos } = useMemo(() => {
    // 1. Step from gate onto the concourse at the gate's angle
    const concourseAtGate = concoursePoint(gateDeg);

    // 2. Walk along the ELLIPTICAL concourse arc to the section's angle
    const concourseArcPts = arcPoints(gateDeg, sectionDeg, 32);

    // 3. Concourse at section angle → vomitory entrance (outer edge of upper tier)
    const [vomX, vomZ] = bowlPosition(sectionDeg, UPPER_OUTER_SCALE - 0.01);
    const vomEntrance  = new THREE.Vector3(
      vomX,
      CONCOURSE_Y + CONCOURSE_THICKNESS + 0.05,
      vomZ,
    );

    // 4. Through the vomitory into the seating bowl
    const [vinX, vinZ] = bowlPosition(sectionDeg, UPPER_INNER_SCALE + 0.04);
    const vomInside    = new THREE.Vector3(vinX, UPPER_Y + VOM_HEIGHT / 2, vinZ);

    // 5. Target: wedge centre
    const target = sectionPos.clone();

    const allWaypoints: THREE.Vector3[] = [
      gatePos.clone(),
      concourseAtGate,
      ...concourseArcPts.slice(1, -1),
      concourseArcPts[concourseArcPts.length - 1],
      vomEntrance,
      vomInside,
      target,
    ];

    const c   = new THREE.CatmullRomCurve3(allWaypoints, false, 'catmullrom', 0.3);
    const pts = c.getPoints(80);

    return { curve: c, curvePoints: pts, vomPos: vomEntrance };
  }, [
    gateDeg,
    sectionDeg,
    gatePos.x, gatePos.y, gatePos.z,
    sectionPos.x, sectionPos.y, sectionPos.z,
  ]);

  const spherePhases = useMemo(
    () => Array.from({ length: PATH_SPHERE_COUNT }, (_, i) => i / PATH_SPHERE_COUNT),
    [],
  );

  return (
    <group>
      {/* The path line itself */}
      <Line
        points={curvePoints}
        color={COLOR_PATH}
        lineWidth={3}
        transparent
        opacity={0.6}
      />
      {/* Animated glowing spheres traveling along the path */}
      {spherePhases.map((phase, i) => (
        <PathSphere key={i} curve={curve} phaseOffset={phase} />
      ))}
      {/* Label at vomitory entrance */}
      <Html
        position={[vomPos.x, vomPos.y + 1.0, vomPos.z]}
        center
        style={{
          color: '#4ade80',
          fontSize: '10px',
          fontWeight: 600,
          fontFamily: "'Inter', system-ui, sans-serif",
          background: 'rgba(0, 0, 0, 0.65)',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid rgba(74, 222, 128, 0.3)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        Entry to Section {zone.section_number}
      </Html>
    </group>
  );
}

// ─── Inner scene ─────────────────────────────────────────────────────────────

function Scene({
  zone,
  uniqueGates,
}: {
  zone: Zone | null;
  uniqueGates: Gate[];
}) {
  return (
    <>
      {/* ── Lighting ─────────────────────────────────────────────────────── */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[-8, 8, -6]}
        intensity={0.35}
        color="#b0c4ff"
      />

      {/* ── Pitch / Field ────────────────────────────────────────────────── */}
      <Pitch />

      {/* ── Lower-tier wedges ────────────────────────────────────────────── */}
      {Array.from({ length: TOTAL_SECTIONS }, (_, i) => (
        <Wedge
          key={`lower-${i}`}
          index={i}
          isLower={true}
          highlighted={
            zone !== null &&
            zone.tier.toLowerCase().includes('lower') &&
            zone.section_index === i
          }
        />
      ))}

      {/* ── Upper-tier wedges ────────────────────────────────────────────── */}
      {Array.from({ length: TOTAL_SECTIONS }, (_, i) => (
        <Wedge
          key={`upper-${i}`}
          index={i}
          isLower={false}
          highlighted={
            zone !== null &&
            !zone.tier.toLowerCase().includes('lower') &&
            zone.section_index === i
          }
        />
      ))}

      {/* ── Vomitory openings (tunnel entrances for all 24 sections) ─────── */}
      {Array.from({ length: TOTAL_SECTIONS }, (_, i) => (
        <Vomitory key={`vom-${i}`} sectionIndex={i} />
      ))}

      {/* ── Elliptical concourse ring ────────────────────────────────────── */}
      <ConcourseRing />

      {/* ── Angled roof canopy (removed by request) ───────────────────────── */}
      {/* <RoofCanopy /> */}

      {/* ── Floodlight towers ─────────────────────────────────────────── */}
      <FloodlightTowers />

      {/* ── Tier labels ───────────────────────────────────────────────── */}
      <TierLabels />

      {/* ── Gate markers ─────────────────────────────────────────────────── */}
      {uniqueGates.map((gate) => (
        <GateMarker key={gate.id} gate={gate} />
      ))}

      {/* ── Animated path when a zone is found ───────────────────────────── */}
      {zone && <PathLine key={zone.id} zone={zone} />}

      {/* ── Orbit controls ───────────────────────────────────────────────── */}
      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={35}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.3}
      />
    </>
  );
}

// ─── Exported canvas wrapper ──────────────────────────────────────────────────

export default function StadiumScene({
  zone,
  uniqueGates,
}: {
  zone: Zone | null;
  uniqueGates: Gate[];
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 25, 35], fov: 50 }}
      style={{ background: 'transparent' }}
    >
      <Scene zone={zone} uniqueGates={uniqueGates} />
    </Canvas>
  );
}
