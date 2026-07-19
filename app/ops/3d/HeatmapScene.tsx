'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  TOTAL_SECTIONS,
  LOWER_INNER_SCALE, LOWER_OUTER_SCALE,
  UPPER_INNER_SCALE, UPPER_OUTER_SCALE,
  LOWER_Y, LOWER_DEPTH, UPPER_Y, UPPER_DEPTH,
  CONCOURSE_INNER_SCALE, CONCOURSE_OUTER_SCALE, CONCOURSE_MID_SCALE,
  CONCOURSE_Y, CONCOURSE_THICKNESS,
  PITCH_LENGTH, PITCH_WIDTH,
  GATE_SCALE, GATE_Y,
  ROOF_SCALE, ROOF_Y,
  VOM_HEIGHT,
  COLOR_GATE,
  bowlPosition, sectionAngleDeg,
} from '@/lib/stadiumGeometry';

// ─── Types ────────────────────────────────────────────────────────────────────

type CongestionLevel = 'low' | 'medium' | 'high';

interface CongestionRow {
  section_id: string;
  device_count: number;
  level: CongestionLevel;
  updated_at: string;
  section_number: string;
  tier: string;
  section_index: number;
}

interface Gate {
  id: string;
  name: string;
  angle_deg: number;
  lat: number | null;
  lng: number | null;
}

// ─── Congestion colours ───────────────────────────────────────────────────────

const LEVEL_COLORS: Record<CongestionLevel, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

// ─── Seat constants ───────────────────────────────────────────────────────────

const SEAT_ROWS = 5;
const SEATS_PER_ROW = 8;
const SEAT_W = 0.12;
const SEAT_H = 0.06;
const SEAT_D = 0.10;

const seatCushionGeo = new THREE.BoxGeometry(SEAT_W, SEAT_H, SEAT_D);

const backW = SEAT_W;
const backH = SEAT_H * 1.6;
const backD = SEAT_H * 0.5;
const seatBackrestGeo = new THREE.BoxGeometry(backW, backH, backD);

const backMatrix = new THREE.Matrix4();
backMatrix.makeRotationX(-0.14);
const offsetMatrix = new THREE.Matrix4().makeTranslation(
  0, SEAT_H / 2 + backH / 2 - 0.01, -SEAT_D / 2 + backD / 2,
);
backMatrix.premultiply(offsetMatrix);
seatBackrestGeo.applyMatrix4(backMatrix);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildWedgeGeometry(
  innerScale: number,
  outerScale: number,
  sectionIndex: number,
  depth: number,
): THREE.BufferGeometry {
  const centreDeg = sectionAngleDeg(sectionIndex);
  const halfSpanDeg = (360 / TOTAL_SECTIONS) * 0.46;
  const steps = 12;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const deg = centreDeg - halfSpanDeg + (i / steps) * halfSpanDeg * 2;
    const [ox, oz] = bowlPosition(deg, outerScale);
    const [ix, iz] = bowlPosition(deg, innerScale);
    positions.push(ox, 0, oz, ox, -depth, oz, ix, -depth, iz, ix, 0, iz);
  }

  for (let i = 0; i < steps; i++) {
    const b = i * 4;
    const n = (i + 1) * 4;
    indices.push(b + 0, n + 3, n + 0, b + 0, b + 3, n + 3);
    indices.push(b + 1, n + 1, n + 2, b + 1, n + 2, b + 2);
    indices.push(b + 0, n + 0, n + 1, b + 0, n + 1, b + 1);
    indices.push(b + 3, b + 2, n + 2, b + 3, n + 2, n + 3);
  }

  indices.push(0, 3, 2, 0, 2, 1);
  const last = steps * 4;
  indices.push(last + 0, last + 1, last + 2, last + 0, last + 2, last + 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildEllipseRingGeometry(
  innerScale: number,
  outerScale: number,
  thickness: number,
  segments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const deg = (i / segments) * 360;
    const [ox, oz] = bowlPosition(deg, outerScale);
    const [ix, iz] = bowlPosition(deg, innerScale);
    const t = thickness / 2;
    positions.push(ox, t, oz, ix, t, iz, ix, -t, iz, ox, -t, oz);
    normals.push(0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0);
  }

  for (let i = 0; i < segments; i++) {
    const base = i * 4;
    const next = (i + 1) * 4;
    indices.push(base, next, next + 1, base, next + 1, base + 1);
    indices.push(base + 3, base + 2, next + 2, base + 3, next + 2, next + 3);
    indices.push(base, base + 3, next + 3, base, next + 3, next);
    indices.push(base + 1, next + 1, next + 2, base + 1, next + 2, base + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildSeatInstances(
  sectionIndex: number,
  innerScale: number,
  outerScale: number,
  y: number,
  depth: number,
  level: CongestionLevel,
) {
  const centreDeg = sectionAngleDeg(sectionIndex);
  const halfSpanDeg = (360 / TOTAL_SECTIONS) * 0.42;
  const count = SEAT_ROWS * SEATS_PER_ROW;
  const matrices: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const baseColor = new THREE.Color(LEVEL_COLORS[level]);
  const dummy = new THREE.Object3D();

  for (let row = 0; row < SEAT_ROWS; row++) {
    const rowT = (row + 0.5) / SEAT_ROWS;
    const rowScale = innerScale + (outerScale - innerScale) * rowT;
    const seatY = y + depth + SEAT_H / 2 + row * (SEAT_H + 0.015);

    for (let col = 0; col < SEATS_PER_ROW; col++) {
      const colT = (col + 0.5) / SEATS_PER_ROW;
      const deg = centreDeg - halfSpanDeg + colT * halfSpanDeg * 2;
      const [sx, sz] = bowlPosition(deg, rowScale);
      const yawRad = -(deg * Math.PI) / 180 + Math.PI / 2;

      dummy.position.set(sx, seatY, sz);
      dummy.rotation.set(0, yawRad, 0);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());

      const seed = sectionIndex * 1000 + row * 100 + col;
      const hueShift = (pseudoRandom(seed) - 0.5) * 0.06;
      const lightShift = (pseudoRandom(seed + 1) - 0.5) * 0.12;
      const c = baseColor.clone();
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      c.setHSL(
        hsl.h + hueShift,
        Math.min(1, Math.max(0, hsl.s)),
        Math.min(1, Math.max(0, hsl.l + lightShift)),
      );
      colors.push(c);
    }
  }
  return { count, matrices, colors };
}

// ─── Path helpers (port of fan page's concourse arc logic) ────────────────────

function concoursePoint(angleDeg: number): THREE.Vector3 {
  const [x, z] = bowlPosition(angleDeg, CONCOURSE_MID_SCALE);
  return new THREE.Vector3(x, CONCOURSE_Y + CONCOURSE_THICKNESS + 0.05, z);
}

function arcPoints(startDeg: number, endDeg: number, numPoints: number): THREE.Vector3[] {
  let diff = endDeg - startDeg;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    pts.push(concoursePoint(startDeg + diff * t));
  }
  return pts;
}

function wedgeCentre(index: number, isLower: boolean): THREE.Vector3 {
  const innerScale = isLower ? LOWER_INNER_SCALE : UPPER_INNER_SCALE;
  const outerScale = isLower ? LOWER_OUTER_SCALE : UPPER_OUTER_SCALE;
  const y = isLower ? LOWER_Y : UPPER_Y;
  const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;
  const deg = sectionAngleDeg(index);
  const midScale = (innerScale + outerScale) / 2;
  const [x, z] = bowlPosition(deg, midScale);
  return new THREE.Vector3(x, y + depth / 2, z);
}

function gatePosition(angleDeg: number): THREE.Vector3 {
  const [x, z] = bowlPosition(angleDeg, GATE_SCALE);
  return new THREE.Vector3(x, GATE_Y, z);
}

function nearestGate(sectionDeg: number, gates: Gate[]): Gate {
  let best = gates[0];
  let bestDist = Infinity;
  for (const g of gates) {
    let d = Math.abs(sectionDeg - g.angle_deg);
    if (d > 180) d = 360 - d;
    if (d < bestDist) { bestDist = d; best = g; }
  }
  return best;
}

// ─── PathSphere (animated dot along a curve) ─────────────────────────────────

function PathSphere({ curve, phaseOffset, color }: {
  curve: THREE.CatmullRomCurve3;
  phaseOffset: number;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(phaseOffset);

  useFrame((_state, delta) => {
    tRef.current = (tRef.current + delta * 0.22) % 1;
    if (meshRef.current) {
      meshRef.current.position.copy(curve.getPoint(tRef.current));
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.12, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.85} />
    </mesh>
  );
}

// ─── Dispatch paths (priority-ordered curved routes) ─────────────────────────

interface PriorityPath {
  section: CongestionRow;
  priority: number;
  curve: THREE.CatmullRomCurve3;
  curvePoints: THREE.Vector3[];
  color: string;
  gatePos: THREE.Vector3;
}

function DispatchPaths({ sections, gates }: { sections: CongestionRow[]; gates: Gate[] }) {
  const priorityPaths: PriorityPath[] = useMemo(() => {
    const nonLow = sections
      .filter((s) => s.level === 'high' || s.level === 'medium')
      .sort((a, b) => b.device_count - a.device_count);

    return nonLow.map((section, idx) => {
      const isLower = section.tier.toLowerCase().includes('lower');
      const sectionDeg = sectionAngleDeg(section.section_index);
      const gate = nearestGate(sectionDeg, gates);
      const gateDeg = gate.angle_deg;
      const innerScale = isLower ? LOWER_INNER_SCALE : UPPER_INNER_SCALE;
      const outerScale = isLower ? LOWER_OUTER_SCALE : UPPER_OUTER_SCALE;
      const y = isLower ? LOWER_Y : UPPER_Y;
      const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;

      const gp = gatePosition(gateDeg);
      const sp = wedgeCentre(section.section_index, isLower);
      const conAtGate = concoursePoint(gateDeg);
      const arcPts = arcPoints(gateDeg, sectionDeg, 32);
      const [vomX, vomZ] = bowlPosition(sectionDeg, UPPER_OUTER_SCALE - 0.01);
      const vomEntrance = new THREE.Vector3(vomX, CONCOURSE_Y + CONCOURSE_THICKNESS + 0.05, vomZ);
      const [vinX, vinZ] = bowlPosition(sectionDeg, UPPER_INNER_SCALE + 0.04);
      const vomInside = new THREE.Vector3(vinX, UPPER_Y + VOM_HEIGHT / 2, vinZ);

      const waypoints: THREE.Vector3[] = [
        gp.clone(), conAtGate,
        ...arcPts.slice(1, -1),
        arcPts[arcPts.length - 1],
        vomEntrance, vomInside,
        sp.clone(),
      ];

      const curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.3);
      return {
        section,
        priority: idx + 1,
        curve,
        curvePoints: curve.getPoints(80),
        color: LEVEL_COLORS[section.level],
        gatePos: gp.clone(),
      };
    });
  }, [sections, gates]);

  // TODO: remove this log once confirmed working
  useEffect(() => {
    if (priorityPaths.length === 0) return;
    const list = priorityPaths.map((p) => ({
      section_number: p.section.section_number,
      device_count: p.section.device_count,
      level: p.section.level,
      rank: p.priority,
    }));
    console.log('[DispatchPaths] Priority list:', list);
  }, [priorityPaths]);

  return (
    <group>
      {priorityPaths.map((p) => (
        <group key={`path-${p.section.section_id}`}>
          <Line points={p.curvePoints} color={p.color} lineWidth={2} transparent opacity={0.5} />
          <Html
            position={[p.gatePos.x, p.gatePos.y + 2.8, p.gatePos.z]}
            center
            style={{
              color: '#ffffff', fontSize: '16px', fontWeight: 900,
              fontFamily: "'Inter', system-ui, sans-serif",
              background: p.section.level === 'high' ? '#ef4444' : '#f59e0b',
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.5)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              pointerEvents: 'none', userSelect: 'none',
            }}
          >
            {p.priority}
          </Html>
          {Array.from({ length: 3 }, (_, i) => (
            <PathSphere key={i} curve={p.curve} phaseOffset={i / 3} color={p.color} />
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── Structural wedge (subtle background for seats) ───────────────────────────

function WedgeBase({
  sectionIndex,
  isLower,
  level,
  isHighlighted,
}: {
  sectionIndex: number;
  isLower: boolean;
  level: CongestionLevel;
  isHighlighted?: boolean;
}) {
  const innerScale = isLower ? LOWER_INNER_SCALE : UPPER_INNER_SCALE;
  const outerScale = isLower ? LOWER_OUTER_SCALE : UPPER_OUTER_SCALE;
  const y = isLower ? LOWER_Y : UPPER_Y;
  const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;

  const geo = useMemo(
    () => buildWedgeGeometry(innerScale, outerScale, sectionIndex, depth),
    [innerScale, outerScale, sectionIndex, depth],
  );

  const color = LEVEL_COLORS[level];
  return (
    <group>
      <mesh geometry={geo} position={[0, y + depth, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.15}
          transparent
          opacity={isHighlighted ? 0.35 : 0.18}
          emissive={isHighlighted ? color : undefined}
          emissiveIntensity={isHighlighted ? 0.6 : 0}
        />
      </mesh>
      {isHighlighted && (
        <mesh geometry={geo} position={[0, y + depth, 0]}>
          <meshBasicMaterial color="#818cf8" transparent opacity={0.12} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
}

// ─── Instanced seat rows ──────────────────────────────────────────────────────

function SeatRows({
  sectionIndex,
  isLower,
  level,
  isHighlighted,
}: {
  sectionIndex: number;
  isLower: boolean;
  level: CongestionLevel;
  isHighlighted?: boolean;
}) {
  const innerScale = isLower ? LOWER_INNER_SCALE : UPPER_INNER_SCALE;
  const outerScale = isLower ? LOWER_OUTER_SCALE : UPPER_OUTER_SCALE;
  const y = isLower ? LOWER_Y : UPPER_Y;
  const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;

  const cushionRef = useRef<THREE.InstancedMesh>(null);
  const backrestRef = useRef<THREE.InstancedMesh>(null);
  const cushionMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const backrestMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const clockRef = useRef(0);

  const { count, matrices, colors } = useMemo(
    () => buildSeatInstances(sectionIndex, innerScale, outerScale, y, depth, level),
    [sectionIndex, innerScale, outerScale, y, depth, level],
  );

  useMemo(() => {
    const apply = (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      for (let i = 0; i < count; i++) {
        mesh.setMatrixAt(i, matrices[i]);
        mesh.setColorAt(i, colors[i]);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    apply(cushionRef.current);
    apply(backrestRef.current);
  }, [count, matrices, colors]);

  useFrame((_state, delta) => {
    if (level !== 'high') return;
    if (!cushionMatRef.current || !backrestMatRef.current) return;
    clockRef.current += delta;
    const pulse = 0.5 + 0.5 * Math.sin(clockRef.current * 3.5);
    const intensity = 0.4 + 1.1 * pulse;
    cushionMatRef.current.emissiveIntensity = intensity;
    backrestMatRef.current.emissiveIntensity = intensity;
  });

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

  const baseColor = new THREE.Color(LEVEL_COLORS[level]);

  const materialProps = {
    roughness: 0.55,
    metalness: 0.2,
    emissive: baseColor,
    emissiveIntensity: isHighlighted ? 1.2 : (level === 'high' ? 0.4 : level === 'medium' ? 0.18 : 0.06),
  };

  return (
    <group>
      <instancedMesh ref={setCushionRef} args={[seatCushionGeo, undefined, count]} castShadow receiveShadow>
        <meshStandardMaterial ref={cushionMatRef} {...materialProps} />
      </instancedMesh>
      <instancedMesh ref={setBackrestRef} args={[seatBackrestGeo, undefined, count]} castShadow receiveShadow>
        <meshStandardMaterial ref={backrestMatRef} {...materialProps} />
      </instancedMesh>
    </group>
  );
}

// ─── Section (base + seats + click target) ────────────────────────────────────

function Section({
  sectionIndex,
  isLower,
  level,
  isHighlighted,
}: {
  sectionIndex: number;
  isLower: boolean;
  level: CongestionLevel;
  isHighlighted?: boolean;
}) {
  return (
    <group>
      <WedgeBase sectionIndex={sectionIndex} isLower={isLower} level={level} isHighlighted={isHighlighted} />
      <SeatRows sectionIndex={sectionIndex} isLower={isLower} level={level} isHighlighted={isHighlighted} />
    </group>
  );
}

// ─── Pitch ────────────────────────────────────────────────────────────────────

function Pitch() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[PITCH_LENGTH, PITCH_WIDTH]} />
        <meshStandardMaterial color="#16a34a" roughness={0.85} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[0.55, 0.65, 40]} />
        <meshStandardMaterial color="#4ade80" roughness={0.6} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <planeGeometry args={[0.05, PITCH_WIDTH * 0.88]} />
        <meshStandardMaterial color="#4ade80" roughness={0.6} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PITCH_LENGTH * 0.3, 0.018, 0]}>
        <planeGeometry args={[0.04, PITCH_WIDTH * 0.44]} />
        <meshStandardMaterial color="#4ade80" roughness={0.6} transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-PITCH_LENGTH * 0.3, 0.018, 0]}>
        <planeGeometry args={[0.04, PITCH_WIDTH * 0.44]} />
        <meshStandardMaterial color="#4ade80" roughness={0.6} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

// ─── Concourse ring ───────────────────────────────────────────────────────────

function ConcourseRing() {
  const geo = useMemo(
    () => buildEllipseRingGeometry(CONCOURSE_INNER_SCALE, CONCOURSE_OUTER_SCALE, CONCOURSE_THICKNESS, 64),
    [],
  );
  return (
    <mesh geometry={geo} position={[0, CONCOURSE_Y, 0]} receiveShadow>
      <meshStandardMaterial color="#9ca3af" roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

// ─── Gate marker ──────────────────────────────────────────────────────────────

function GateMarker({ gate }: { gate: Gate }) {
  const pos = gatePosition(gate.angle_deg);
  const yawRad = -(gate.angle_deg * Math.PI) / 180 + Math.PI / 2;
  const archWidth = 1.0;
  const archHeight = 1.4;
  const archDepth = 0.3;
  const pillarWidth = 0.18;

  return (
    <group position={pos} rotation={[0, yawRad, 0]}>
      <mesh position={[-archWidth / 2 + pillarWidth / 2, archHeight / 2, 0]}>
        <boxGeometry args={[pillarWidth, archHeight, archDepth]} />
        <meshStandardMaterial color={COLOR_GATE} emissive={COLOR_GATE} emissiveIntensity={0.5} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[archWidth / 2 - pillarWidth / 2, archHeight / 2, 0]}>
        <boxGeometry args={[pillarWidth, archHeight, archDepth]} />
        <meshStandardMaterial color={COLOR_GATE} emissive={COLOR_GATE} emissiveIntensity={0.5} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, archHeight, 0]}>
        <boxGeometry args={[archWidth, 0.2, archDepth]} />
        <meshStandardMaterial color={COLOR_GATE} emissive={COLOR_GATE} emissiveIntensity={0.6} roughness={0.3} metalness={0.5} />
      </mesh>
      <Html position={[0, archHeight + 0.55, 0]} center
        style={{
          color: '#f59e0b', fontSize: '11px', fontWeight: 700,
          fontFamily: "'Inter', system-ui, sans-serif",
          background: 'rgba(0,0,0,0.6)', padding: '2px 7px', borderRadius: '4px',
          border: '1px solid rgba(245,158,11,0.35)', whiteSpace: 'nowrap',
          pointerEvents: 'none', userSelect: 'none',
        }}
      >
        {gate.name}
      </Html>
    </group>
  );
}

// ─── Tier labels ──────────────────────────────────────────────────────────────

function TierLabels() {
  const labelAngleDeg = 90;
  const lowerMidScale = (LOWER_INNER_SCALE + LOWER_OUTER_SCALE) / 2;
  const [lx, lz] = bowlPosition(labelAngleDeg, lowerMidScale + 0.08);
  const lowerY = LOWER_Y + LOWER_DEPTH + 0.8;
  const upperMidScale = (UPPER_INNER_SCALE + UPPER_OUTER_SCALE) / 2;
  const [ux, uz] = bowlPosition(labelAngleDeg, upperMidScale + 0.08);
  const upperY = UPPER_Y + UPPER_DEPTH + 1.2;

  const labelStyle: React.CSSProperties = {
    color: '#94a3b8', fontSize: '11px', fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
    letterSpacing: '0.18em', opacity: 0.65,
    pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  };

  return (
    <group>
      <Html position={[lx, lowerY, lz]} center style={labelStyle}>LOWER TIER</Html>
      <Html position={[ux, upperY, uz]} center style={labelStyle}>UPPER TIER</Html>
    </group>
  );
}

// ─── Roof canopy ──────────────────────────────────────────────────────────────

function RoofCanopy() {
  const geo = useMemo(() => {
    const segments = 64;
    const innerScale = ROOF_SCALE - 0.20;
    const outerScale = ROOF_SCALE + 0.45;
    const innerY = 0.55;
    const outerY = -0.20;
    const thickness = 0.15;
    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const deg = (i / segments) * 360;
      const [ox, oz] = bowlPosition(deg, outerScale);
      const [ix, iz] = bowlPosition(deg, innerScale);
      positions.push(ox, outerY + thickness / 2, oz);
      positions.push(ox, outerY - thickness / 2, oz);
      positions.push(ix, innerY - thickness / 2, iz);
      positions.push(ix, innerY + thickness / 2, iz);
    }

    for (let i = 0; i < segments; i++) {
      const b = i * 4;
      const n = (i + 1) * 4;
      indices.push(b, n, n + 3, b, n + 3, b + 3);
      indices.push(b + 1, b + 2, n + 2, b + 1, n + 2, n + 1);
      indices.push(b, b + 1, n + 1, b, n + 1, n);
      indices.push(b + 3, n + 3, n + 2, b + 3, n + 2, b + 2);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geo} position={[0, ROOF_Y, 0]}>
      <meshStandardMaterial color="#1e1b4b" roughness={0.5} metalness={0.6} transparent opacity={0.45} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Camera controller ────────────────────────────────────────────────────────

interface FocusState {
  target: THREE.Vector3;
  cameraPos: THREE.Vector3;
}

function CameraController({ focusState }: { focusState: FocusState | null }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const hasAnimated = useRef(false);
  const prevTargetKey = useRef<string | null>(null);

  const targetKey = focusState ? `${focusState.target.x.toFixed(2)},${focusState.target.y.toFixed(2)},${focusState.target.z.toFixed(2)}` : null;
  if (targetKey !== prevTargetKey.current) {
    hasAnimated.current = false;
    prevTargetKey.current = targetKey;
  }

  useEffect(() => {
    const controls = controlsRef.current;
    if (controls) {
      const handleInteract = () => {
        hasAnimated.current = true;
      };
      controls.addEventListener('start', handleInteract);
      return () => {
        controls.removeEventListener('start', handleInteract);
      };
    }
  }, []);

  useFrame((_state, delta) => {
    if (!focusState || hasAnimated.current) return;
    const { target, cameraPos } = focusState;
    camera.position.lerp(cameraPos, delta * 4);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(target, delta * 4);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(cameraPos) < 0.15) {
      hasAnimated.current = true;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      minDistance={2}
      maxDistance={60}
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI - 0.01}
    />
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene({
  sections,
  gates,
  focusSectionNumber,
}: {
  sections: CongestionRow[];
  gates: Gate[];
  focusSectionNumber?: string;
}) {
  const sectionMap = useMemo(() => {
    const m = new Map<string, CongestionLevel>();
    sections.forEach((s) => {
      const key = `${s.tier.toLowerCase().includes('lower') ? 'lower' : 'upper'}-${s.section_index}`;
      m.set(key, s.level);
    });
    return m;
  }, [sections]);

  const highlightedKey = useMemo(() => {
    if (!focusSectionNumber) return null;
    const section = sections.find((s) => s.section_number === focusSectionNumber);
    if (!section) return null;
    return `${section.tier.toLowerCase().includes('lower') ? 'lower' : 'upper'}-${section.section_index}`;
  }, [focusSectionNumber, sections]);

  const focusState = useMemo((): FocusState | null => {
    if (!focusSectionNumber) return null;
    const section = sections.find((s) => s.section_number === focusSectionNumber);
    if (!section) return null;
    const isLower = section.tier.toLowerCase().includes('lower');
    const innerScale = isLower ? LOWER_INNER_SCALE : UPPER_INNER_SCALE;
    const outerScale = isLower ? LOWER_OUTER_SCALE : UPPER_OUTER_SCALE;
    const y = isLower ? LOWER_Y : UPPER_Y;
    const depth = isLower ? LOWER_DEPTH : UPPER_DEPTH;
    const deg = sectionAngleDeg(section.section_index);
    const midScale = (innerScale + outerScale) / 2;
    const [tx, tz] = bowlPosition(deg, midScale);
    const target = new THREE.Vector3(tx, y + depth / 2, tz);
    const cameraPos = new THREE.Vector3(tx, 35, tz);

    return { target, cameraPos };
  }, [focusSectionNumber, sections]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 8]} intensity={1.8} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-8, 8, -6]} intensity={0.4} color="#b0c4ff" />

      <Pitch />

      {Array.from({ length: TOTAL_SECTIONS }, (_, i) => {
        const key = `lower-${i}`;
        return (
          <Section key={key} sectionIndex={i} isLower level={sectionMap.get(key) ?? 'low'}
            isHighlighted={key === highlightedKey}
          />
        );
      })}
      {Array.from({ length: TOTAL_SECTIONS }, (_, i) => {
        const key = `upper-${i}`;
        return (
          <Section key={key} sectionIndex={i} isLower={false} level={sectionMap.get(key) ?? 'low'}
            isHighlighted={key === highlightedKey}
          />
        );
      })}

      <DispatchPaths sections={sections} gates={gates} />

      <ConcourseRing />
      <RoofCanopy />
      <TierLabels />
      {gates.map((gate) => (
        <GateMarker key={gate.id} gate={gate} />
      ))}
      <CameraController focusState={focusState} />
    </>
  );
}

// ─── Exported canvas wrapper ──────────────────────────────────────────────────

export default function HeatmapScene({
  sections,
  gates,
  focusSectionNumber,
}: {
  sections: CongestionRow[];
  gates: Gate[];
  focusSectionNumber?: string;
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [15, 20, 20], fov: 45 }}
      style={{ background: 'transparent' }}
    >
      <Scene
        sections={sections}
        gates={gates}
        focusSectionNumber={focusSectionNumber}
      />
    </Canvas>
  );
}
