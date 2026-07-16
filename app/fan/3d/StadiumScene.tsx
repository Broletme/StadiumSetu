'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
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

// Lower-tier ring (close to pitch, sits low)
const LOWER_INNER = 3.5;
const LOWER_OUTER = 6.0;
const LOWER_Y = 0;
const LOWER_DEPTH = 1.2;

// Upper-tier ring (elevated, further back)
const UPPER_INNER = 6.5;
const UPPER_OUTER = 9.0;
const UPPER_Y = 2.0;
const UPPER_DEPTH = 1.8;

// Concourse ring — the walkable band between bowl rim and gates
const CONCOURSE_INNER = UPPER_OUTER + 0.15;
const CONCOURSE_OUTER = UPPER_OUTER + 1.8;
const CONCOURSE_MID = (CONCOURSE_INNER + CONCOURSE_OUTER) / 2;
const CONCOURSE_Y = UPPER_Y + UPPER_DEPTH - 0.05; // slightly below top of upper tier
const CONCOURSE_THICKNESS = 0.12;

// Gate marker radius — on the outer edge of the concourse
const GATE_RADIUS = CONCOURSE_OUTER + 0.4;
const GATE_Y = CONCOURSE_Y + 0.01;

// Vomitory dimensions (tunnel opening into the seating bowl)
const VOM_WIDTH = 0.35;
const VOM_HEIGHT = 0.7;
const VOM_DEPTH_SIZE = 0.5;

// Pitch dimensions
const PITCH_LENGTH = 5.0;
const PITCH_WIDTH = 3.2;

// Roof ring
const ROOF_RADIUS = (UPPER_INNER + UPPER_OUTER) / 2;
const ROOF_Y = UPPER_Y + UPPER_DEPTH + 1.5;

// Colors
const COLOR_LOWER_DEFAULT = '#4f46e5';
const COLOR_UPPER_DEFAULT = '#7c3aed';
const COLOR_HIGHLIGHTED = '#4ade80';
const COLOR_GATE = '#f59e0b';
const COLOR_PATH = '#4ade80';
const COLOR_PITCH = '#16a34a';
const COLOR_PITCH_LINES = '#22c55e';
const COLOR_CONCOURSE = '#9ca3af';
const COLOR_VOMITORY = '#0f0f1a';

// Path animation
const PATH_SPHERE_COUNT = 5;
const PATH_SPHERE_RADIUS = 0.15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert section_index (0-23) to centre angle in radians */
function sectionAngle(index: number): number {
  return (index / TOTAL_SECTIONS) * TWO_PI;
}

/** World-space centre of a wedge at a given tier */
function wedgeCentre(
  index: number,
  innerR: number,
  outerR: number,
  y: number,
  depth: number,
): THREE.Vector3 {
  const angle = sectionAngle(index);
  const midR = (innerR + outerR) / 2;
  return new THREE.Vector3(
    Math.sin(angle) * midR,
    y + depth / 2,
    Math.cos(angle) * midR,
  );
}

/** Gate position from angle_deg — sits on outer edge of concourse */
function gatePosition(angleDeg: number): THREE.Vector3 {
  const rad = (angleDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.sin(rad) * GATE_RADIUS,
    GATE_Y,
    Math.cos(rad) * GATE_RADIUS,
  );
}

/** Point on the concourse ring at a given angle (radians) */
function concoursePoint(angleRad: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(angleRad) * CONCOURSE_MID,
    CONCOURSE_Y + CONCOURSE_THICKNESS + 0.05,
    Math.cos(angleRad) * CONCOURSE_MID,
  );
}

/** Vomitory position — inner edge of upper tier at a section's angle */
function vomitoryPosition(sectionIndex: number): THREE.Vector3 {
  const angle = sectionAngle(sectionIndex);
  const r = UPPER_INNER + 0.15;
  return new THREE.Vector3(
    Math.sin(angle) * r,
    UPPER_Y + VOM_HEIGHT / 2,
    Math.cos(angle) * r,
  );
}

/**
 * Compute shortest-direction arc points along the concourse ring
 * from startAngle to endAngle (both in radians), returning an array
 * of THREE.Vector3 points along the arc.
 */
function arcPoints(startAngle: number, endAngle: number, numPoints: number): THREE.Vector3[] {
  // Normalize the angular difference to [-PI, PI] for shortest path
  let diff = endAngle - startAngle;
  while (diff > Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startAngle + diff * t;
    pts.push(concoursePoint(angle));
  }
  return pts;
}

/** Build a wedge (ring-sector) shape using THREE.Shape */
function buildWedgeGeometry(
  innerR: number,
  outerR: number,
  sectionIndex: number,
  depth: number,
): THREE.BufferGeometry {
  const angle = sectionAngle(sectionIndex);
  const halfSpan = (TWO_PI / TOTAL_SECTIONS) * 0.46; // slight gap between wedges

  const shape = new THREE.Shape();

  // outer arc
  const outerPts: [number, number][] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const a = angle - halfSpan + (i / steps) * halfSpan * 2;
    outerPts.push([Math.sin(a) * outerR, Math.cos(a) * outerR]);
  }

  // inner arc (reverse)
  const innerPts: [number, number][] = [];
  for (let i = steps; i >= 0; i--) {
    const a = angle - halfSpan + (i / steps) * halfSpan * 2;
    innerPts.push([Math.sin(a) * innerR, Math.cos(a) * innerR]);
  }

  shape.moveTo(...outerPts[0]);
  for (let i = 1; i < outerPts.length; i++) shape.lineTo(...outerPts[i]);
  for (const p of innerPts) shape.lineTo(...p);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  // Rotate flat XY shape to lie on XZ plane.
  // +π/2 (not -π/2) so that shape_y maps to world_z WITHOUT negation,
  // keeping geometry consistent with gatePosition / wedgeCentre / etc.
  // which all use z = cos(angle) * R.  Extrusion now extends downward
  // in Y, compensated by the mesh position offset in <Wedge>.
  geo.rotateX(Math.PI / 2);
  return geo;
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
  const innerR = isLower ? LOWER_INNER : UPPER_INNER;
  const outerR = isLower ? LOWER_OUTER : UPPER_OUTER;
  const y = isLower ? LOWER_Y : UPPER_Y;
  const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;

  const geo = useMemo(
    () => buildWedgeGeometry(innerR, outerR, index, depth),
    [innerR, outerR, index, depth],
  );

  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshStandardMaterial>(null);
  const clockRef = useRef(0);

  useFrame((_state, delta) => {
    if (!highlighted) {
      // Reset if this wedge stops being highlighted
      if (meshRef.current) meshRef.current.scale.setScalar(1);
      if (matRef.current) matRef.current.emissiveIntensity = 0;
      return;
    }
    clockRef.current += delta;
    const t = clockRef.current;

    // ── Heartbeat scale ────────────────────────────────────────────────────
    const period = 1.1;
    const phase  = (t % period) / period;
    const beat1  = Math.max(0, Math.sin(phase * Math.PI * 2)) ** 3;
    const beat2  = Math.max(0, Math.sin((phase - 0.28) * Math.PI * 2)) ** 3;
    const heartbeat = beat1 * 0.055 + beat2 * 0.035;
    const scale = 1 + heartbeat;
    if (meshRef.current) meshRef.current.scale.setScalar(scale);

    // ── Glow pulse ─────────────────────────────────────────────────────────
    const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3.5));
    if (matRef.current) matRef.current.emissiveIntensity = glow;
  });

  const color = highlighted
    ? COLOR_HIGHLIGHTED
    : isLower
      ? COLOR_LOWER_DEFAULT
      : COLOR_UPPER_DEFAULT;

  return (
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
  );
}

/** Green pitch plane in the centre of the bowl */
function Pitch() {
  return (
    <group>
      {/* Main pitch surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[PITCH_LENGTH, PITCH_WIDTH]} />
        <meshStandardMaterial color={COLOR_PITCH} roughness={0.85} metalness={0.05} />
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

/** Subtle roof ring above the bowl */
function RoofRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROOF_Y, 0]}>
      <torusGeometry args={[ROOF_RADIUS, 0.15, 8, 64]} />
      <meshStandardMaterial
        color="#1e1b4b"
        roughness={0.6}
        metalness={0.5}
        transparent
        opacity={0.5}
      />
    </mesh>
  );
}

/** Flat walkable concourse ring between the bowl and the gates */
function ConcourseRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, CONCOURSE_Y, 0]} receiveShadow>
      <ringGeometry args={[CONCOURSE_INNER, CONCOURSE_OUTER, 64]} />
      <meshStandardMaterial
        color={COLOR_CONCOURSE}
        roughness={0.9}
        metalness={0.05}
      />
    </mesh>
  );
}

/** A single vomitory (tunnel opening) at a section's angle */
function Vomitory({ sectionIndex }: { sectionIndex: number }) {
  const angle = sectionAngle(sectionIndex);
  const r = UPPER_OUTER - VOM_DEPTH_SIZE / 2;
  const x = Math.sin(angle) * r;
  const z = Math.cos(angle) * r;

  return (
    <mesh
      position={[x, UPPER_Y + VOM_HEIGHT / 2 + 0.01, z]}
      rotation={[0, -angle, 0]}
    >
      <boxGeometry args={[VOM_WIDTH, VOM_HEIGHT, VOM_DEPTH_SIZE]} />
      <meshStandardMaterial
        color={COLOR_VOMITORY}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/** Gate archway structure + Html label billboard */
function GateMarker({ gate }: { gate: Gate }) {
  const pos = gatePosition(gate.angle_deg);
  const rad = (gate.angle_deg * Math.PI) / 180;

  // Arch dimensions
  const archWidth = 1.0;
  const archHeight = 1.4;
  const archDepth = 0.3;
  const pillarWidth = 0.18;

  return (
    <group position={pos} rotation={[0, -rad, 0]}>
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
  const tRef = useRef(phaseOffset);

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
 * Realistic wayfinding path: gate → concourse arc → vomitory → section
 * Plus a label at the vomitory entrance and animated spheres.
 */
function PathLine({ zone }: { zone: Zone }) {
  const isLower = zone.tier.toLowerCase().includes('lower');
  const innerR = isLower ? LOWER_INNER : UPPER_INNER;
  const outerR = isLower ? LOWER_OUTER : UPPER_OUTER;
  const y = isLower ? LOWER_Y : UPPER_Y;
  const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;

  const gateAngleRad = (zone.gate.angle_deg * Math.PI) / 180;
  const sectionAngleRad = sectionAngle(zone.section_index);

  // Key positions
  const gatePos = gatePosition(zone.gate.angle_deg);
  const sectionPos = wedgeCentre(zone.section_index, innerR, outerR, y, depth);

  // Build the full multi-segment path
  const { curve, curvePoints, vomPos } = useMemo(() => {
    // 1. Gate → concourse entry point (straight step onto the ring at the gate's angle)
    const concourseAtGate = concoursePoint(gateAngleRad);

    // 2. Walk along the concourse ring arc to the section's angle
    const concourseArcPts = arcPoints(gateAngleRad, sectionAngleRad, 32);

    // 3. Concourse at section angle → vomitory entrance
    const vomAngle = sectionAngleRad;
    const vomR = UPPER_OUTER - 0.1;
    const vomEntrance = new THREE.Vector3(
      Math.sin(vomAngle) * vomR,
      CONCOURSE_Y + CONCOURSE_THICKNESS + 0.05,
      Math.cos(vomAngle) * vomR,
    );

    // 4. Through the vomitory into the seating bowl
    const vomInsideR = UPPER_INNER + 0.3;
    const vomInside = new THREE.Vector3(
      Math.sin(vomAngle) * vomInsideR,
      UPPER_Y + VOM_HEIGHT / 2,
      Math.cos(vomAngle) * vomInsideR,
    );

    // 5. Target: wedge centre
    const target = sectionPos.clone();

    // Assemble all waypoints into one path
    const allWaypoints: THREE.Vector3[] = [
      gatePos.clone(),
      concourseAtGate,
      ...concourseArcPts.slice(1, -1), // skip first (same as concourseAtGate) and last
      concourseArcPts[concourseArcPts.length - 1],
      vomEntrance,
      vomInside,
      target,
    ];

    // Create a CatmullRomCurve3 for smooth interpolation along all segments
    const c = new THREE.CatmullRomCurve3(allWaypoints, false, 'catmullrom', 0.3);
    const pts = c.getPoints(80);

    return { curve: c, curvePoints: pts, vomPos: vomEntrance };
  }, [
    gateAngleRad,
    sectionAngleRad,
    gatePos.x, gatePos.y, gatePos.z,
    sectionPos.x, sectionPos.y, sectionPos.z,
  ]);

  // Evenly-spaced phase offsets for the animated spheres
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

      {/* ── Vomitory openings (tunnel entrances for all 24 sections) ───── */}
      {Array.from({ length: TOTAL_SECTIONS }, (_, i) => (
        <Vomitory key={`vom-${i}`} sectionIndex={i} />
      ))}

      {/* ── Concourse ring ───────────────────────────────────────────────── */}
      <ConcourseRing />

      {/* ── Roof ring ────────────────────────────────────────────────────── */}
      <RoofRing />

      {/* ── Gate markers ─────────────────────────────────────────────────── */}
      {uniqueGates.map((gate) => (
        <GateMarker key={gate.id} gate={gate} />
      ))}

      {/* ── Animated path when zone is found ─────────────────────────────── */}
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
