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

// Gate marker radius — on the outer rim of the upper tier
const GATE_RADIUS = UPPER_OUTER + 0.3;
const GATE_Y = UPPER_Y + UPPER_DEPTH + 0.25;

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

// Path animation
const PATH_SPHERE_COUNT = 5;
const PATH_SPHERE_RADIUS = 0.18;

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

/** Gate position from angle_deg — sits on outer bowl rim */
function gatePosition(angleDeg: number): THREE.Vector3 {
  const rad = (angleDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.sin(rad) * GATE_RADIUS,
    GATE_Y,
    Math.cos(rad) * GATE_RADIUS,
  );
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
  // Rotate flat XY shape to lie on XZ plane
  geo.rotateX(-Math.PI / 2);
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
    // Two quick sine bumps per cycle (~1.1 s), then a rest. Achieved by
    // sampling a "double-sine" envelope: beat1 at phase=0, beat2 at phase=0.3.
    const period = 1.1;
    const phase  = (t % period) / period; // 0→1 per cycle
    const beat1  = Math.max(0, Math.sin(phase * Math.PI * 2)) ** 3;
    const beat2  = Math.max(0, Math.sin((phase - 0.28) * Math.PI * 2)) ** 3;
    const heartbeat = beat1 * 0.055 + beat2 * 0.035; // combined bump magnitude
    const scale = 1 + heartbeat;
    if (meshRef.current) meshRef.current.scale.setScalar(scale);

    // ── Glow pulse ─────────────────────────────────────────────────────────
    // Smooth sine between 0.4 and 1.0, slightly faster than the heartbeat.
    const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3.5));
    if (matRef.current) matRef.current.emissiveIntensity = glow;
  });

  const color = highlighted
    ? COLOR_HIGHLIGHTED
    : isLower
      ? COLOR_LOWER_DEFAULT
      : COLOR_UPPER_DEFAULT;

  return (
    <mesh ref={meshRef} geometry={geo} position={[0, y, 0]} castShadow receiveShadow>
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
      {/* Centre circle outline (simple ring for visual flair) */}
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

/** Gate cone marker + Html label billboard */
function GateMarker({ gate }: { gate: Gate }) {
  const pos = gatePosition(gate.angle_deg);

  return (
    <group position={pos}>
      {/* Cone pin marker */}
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.3, 0.9, 6]} />
        <meshStandardMaterial
          color={COLOR_GATE}
          emissive={COLOR_GATE}
          emissiveIntensity={0.65}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      {/* Thin post */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 6]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      {/* Gate name label — Html component for crisp text that always faces camera */}
      <Html
        position={[0, 1.3, 0]}
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

/** A single glowing sphere that travels along a curve */
function PathSphere({
  curve,
  phaseOffset,
}: {
  curve: THREE.QuadraticBezierCurve3;
  phaseOffset: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(phaseOffset);

  useFrame((_state, delta) => {
    tRef.current = (tRef.current + delta * 0.35) % 1;
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

/** Animated path from gate → section with glowing travelling spheres */
function PathLine({ zone }: { zone: Zone }) {
  const isLower = zone.tier.toLowerCase().includes('lower');
  const innerR = isLower ? LOWER_INNER : UPPER_INNER;
  const outerR = isLower ? LOWER_OUTER : UPPER_OUTER;
  const y = isLower ? LOWER_Y : UPPER_Y;
  const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;

  const gatePos = gatePosition(zone.gate.angle_deg);
  const sectionPos = wedgeCentre(zone.section_index, innerR, outerR, y, depth);

  // Build a curved arc: gate → midpoint above → section
  const curve = useMemo(() => {
    const midPoint = new THREE.Vector3(
      (gatePos.x + sectionPos.x) / 2,
      Math.max(gatePos.y, sectionPos.y) + 3.0,
      (gatePos.z + sectionPos.z) / 2,
    );
    return new THREE.QuadraticBezierCurve3(gatePos, midPoint, sectionPos);
  }, [gatePos.x, gatePos.y, gatePos.z, sectionPos.x, sectionPos.y, sectionPos.z]);

  const curvePoints = useMemo(() => curve.getPoints(48), [curve]);

  // Create evenly-spaced phase offsets for spheres
  const spherePhases = useMemo(
    () =>
      Array.from({ length: PATH_SPHERE_COUNT }, (_, i) => i / PATH_SPHERE_COUNT),
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
      {/* Main directional light — angled from above to cast shadows/depth */}
      <directionalLight
        position={[10, 15, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Fill light — opposite side, slight blue tint for depth */}
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
