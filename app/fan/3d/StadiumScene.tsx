'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
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

// Lower-tier ring radii
const LOWER_INNER = 3.2;
const LOWER_OUTER = 5.0;
const LOWER_Y = 0;

// Upper-tier ring radii
const UPPER_INNER = 5.2;
const UPPER_OUTER = 7.2;
const UPPER_Y = 1.0;

// Gate ring radius
const GATE_RADIUS = 8.5;

// Colors
const COLOR_LOWER_DEFAULT = '#4f46e5';
const COLOR_UPPER_DEFAULT = '#7c3aed';
const COLOR_HIGHLIGHTED = '#4ade80';
const COLOR_GATE = '#f59e0b';
const COLOR_PATH = '#4ade80';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert section_index (0-23) to centre angle in radians */
function sectionAngle(index: number): number {
  return (index / TOTAL_SECTIONS) * TWO_PI;
}

/** World-space centre of a wedge at a given tier */
function wedgeCentre(index: number, innerR: number, outerR: number, y: number): THREE.Vector3 {
  const angle = sectionAngle(index);
  const midR = (innerR + outerR) / 2;
  return new THREE.Vector3(Math.sin(angle) * midR, y, Math.cos(angle) * midR);
}

/** Gate position from angle_deg */
function gatePosition(angleDeg: number): THREE.Vector3 {
  const rad = (angleDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(rad) * GATE_RADIUS, 0, Math.cos(rad) * GATE_RADIUS);
}

/** Build a wedge (ring-sector) shape using THREE.Shape */
function buildWedgeGeometry(innerR: number, outerR: number, sectionIndex: number): THREE.BufferGeometry {
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

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
  // Rotate flat XY shape to lie on XZ plane
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Single wedge mesh */
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
  const y     = isLower ? LOWER_Y     : UPPER_Y;

  const geo = useMemo(
    () => buildWedgeGeometry(innerR, outerR, index),
    [innerR, outerR, index],
  );

  const color = highlighted
    ? COLOR_HIGHLIGHTED
    : isLower
    ? COLOR_LOWER_DEFAULT
    : COLOR_UPPER_DEFAULT;

  return (
    <mesh geometry={geo} position={[0, y, 0]} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.3}
        emissive={highlighted ? COLOR_HIGHLIGHTED : '#000000'}
        emissiveIntensity={highlighted ? 0.35 : 0}
      />
    </mesh>
  );
}

/** Gate cone + label billboard */
function GateMarker({ gate }: { gate: Gate }) {
  const pos = gatePosition(gate.angle_deg);

  return (
    <group position={pos}>
      <mesh position={[0, 0.8, 0]}>
        <coneGeometry args={[0.25, 0.8, 6]} />
        <meshStandardMaterial color={COLOR_GATE} emissive={COLOR_GATE} emissiveIntensity={0.6} />
      </mesh>
      {/* Thin post */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
    </group>
  );
}

/** Animated dashed path from gate → section */
function PathLine({
  zone,
}: {
  zone: Zone;
}) {
  const progressRef = useRef(0);

  const isLower = zone.tier.toLowerCase().includes('lower');
  const innerR  = isLower ? LOWER_INNER : UPPER_INNER;
  const outerR  = isLower ? LOWER_OUTER : UPPER_OUTER;
  const y       = isLower ? LOWER_Y     : UPPER_Y;

  const gatePos   = gatePosition(zone.gate.angle_deg);
  const sectionPos = wedgeCentre(zone.section_index, innerR, outerR, y);

  // Build a curved arc: gate → midpoint above → section
  const midPoint = new THREE.Vector3(
    (gatePos.x + sectionPos.x) / 2,
    2.5,
    (gatePos.z + sectionPos.z) / 2,
  );

  const curve = new THREE.QuadraticBezierCurve3(gatePos, midPoint, sectionPos);
  const allPoints = curve.getPoints(48);

  // Animate reveal: grow line from 0 to full length
  useFrame((_state, delta) => {
    if (progressRef.current < 1) {
      progressRef.current = Math.min(progressRef.current + delta * 0.9, 1);
    }
  });

  const visibleCount = Math.max(2, Math.round(progressRef.current * allPoints.length));
  const pts = allPoints.slice(0, visibleCount);

  return (
    <Line
      points={pts}
      color={COLOR_PATH}
      lineWidth={2.5}
      dashed={false}
    />
  );
}

// ─── Inner scene ─────────────────────────────────────────────────────────────

function Scene({ zone, uniqueGates }: { zone: Zone | null; uniqueGates: Gate[] }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[8, 12, 8]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 6, -6]} intensity={0.4} />

      {/* Stadium floor disk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.0, 48]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.8} />
      </mesh>

      {/* Lower-tier wedges */}
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

      {/* Upper-tier wedges */}
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

      {/* Gate markers */}
      {uniqueGates.map((gate) => (
        <GateMarker key={gate.id} gate={gate} />
      ))}

      {/* Animated path when zone is found */}
      {zone && <PathLine key={zone.id} zone={zone} />}

      {/* Orbit controls */}
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={22}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.1}
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
      camera={{ position: [0, 10, 14], fov: 50 }}
      style={{ background: 'transparent' }}
    >
      <Scene zone={zone} uniqueGates={uniqueGates} />
    </Canvas>
  );
}
