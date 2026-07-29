'use client';

import { useMemo } from 'react';
import {
  BASE_RADIUS_X, BASE_RADIUS_Z,
  LOWER_INNER_SCALE, LOWER_OUTER_SCALE,
  UPPER_INNER_SCALE, UPPER_OUTER_SCALE,
  TOTAL_SECTIONS,
  PITCH_LENGTH, PITCH_WIDTH,
  bowlPosition,
  sectionAngleDeg,
  getGateColor,
} from '@/lib/stadiumGeometry';

type CongestionLevel = 'low' | 'medium' | 'high';

interface CongestionRow {
  section_id: string;
  level: CongestionLevel;
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

interface MinimapProps {
  sections: CongestionRow[];
  gates?: Gate[];
}

const LEVEL_COLORS: Record<CongestionLevel, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

const LEVEL_OPACITY: Record<CongestionLevel, number> = {
  low: 0.15,
  medium: 0.5,
  high: 0.85,
};

const PAD = 0.5;
const EXTENT = Math.max(
  BASE_RADIUS_X * UPPER_OUTER_SCALE,
  BASE_RADIUS_Z * UPPER_OUTER_SCALE,
) + PAD;
const SIZE = EXTENT * 2;
const CX = SIZE / 2;
const CY = SIZE / 2;

function svgPoint(deg: number, scale: number): string {
  const [x, z] = bowlPosition(deg, scale);
  return `${(CX + x).toFixed(2)},${(CY - z).toFixed(2)}`;
}

function wedgePath(index: number, innerScale: number, outerScale: number): string {
  const centreDeg = sectionAngleDeg(index);
  const halfSpan = (360 / TOTAL_SECTIONS) * 0.46;
  const steps = 6;
  const parts: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const deg = centreDeg - halfSpan + (i / steps) * halfSpan * 2;
    parts.push(`${i === 0 ? 'M' : 'L'}${svgPoint(deg, outerScale)}`);
  }
  for (let i = steps; i >= 0; i--) {
    const deg = centreDeg - halfSpan + (i / steps) * halfSpan * 2;
    parts.push(`L${svgPoint(deg, innerScale)}`);
  }
  parts.push('Z');
  return parts.join('');
}

export default function Minimap({ sections }: MinimapProps) {
  const sectionMap = useMemo(() => {
    const m = new Map<string, CongestionLevel>();
    sections.forEach((s) => {
      const tier = s.tier.toLowerCase().includes('lower') ? 'lower' : 'upper';
      m.set(`${tier}-${s.section_index}`, s.level);
    });
    return m;
  }, [sections]);

  const empty = sections.length === 0;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <circle cx={CX} cy={CY} r={EXTENT} fill="rgba(0,0,0,0.55)" />

      {!empty && (
        <>
          {Array.from({ length: TOTAL_SECTIONS }, (_, i) => {
            const level = sectionMap.get(`upper-${i}`) ?? 'low';
            return (
              <path
                key={`u-${i}`}
                d={wedgePath(i, UPPER_INNER_SCALE, UPPER_OUTER_SCALE)}
                fill={LEVEL_COLORS[level]}
                opacity={LEVEL_OPACITY[level]}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={0.04}
              />
            );
          })}
          {Array.from({ length: TOTAL_SECTIONS }, (_, i) => {
            const level = sectionMap.get(`lower-${i}`) ?? 'low';
            return (
              <path
                key={`l-${i}`}
                d={wedgePath(i, LOWER_INNER_SCALE, LOWER_OUTER_SCALE)}
                fill={LEVEL_COLORS[level]}
                opacity={LEVEL_OPACITY[level]}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={0.04}
              />
            );
          })}
        </>
      )}

      <ellipse
        cx={CX} cy={CY}
        rx={UPPER_OUTER_SCALE * BASE_RADIUS_X}
        ry={UPPER_OUTER_SCALE * BASE_RADIUS_Z}
        fill="none" stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.06}
      />
      <ellipse
        cx={CX} cy={CY}
        rx={UPPER_INNER_SCALE * BASE_RADIUS_X}
        ry={UPPER_INNER_SCALE * BASE_RADIUS_Z}
        fill="none" stroke="rgba(255,255,255,0.08)"
        strokeWidth={0.04}
      />
      <ellipse
        cx={CX} cy={CY}
        rx={LOWER_OUTER_SCALE * BASE_RADIUS_X}
        ry={LOWER_OUTER_SCALE * BASE_RADIUS_Z}
        fill="none" stroke="rgba(255,255,255,0.12)"
        strokeWidth={0.05}
      />
      <ellipse
        cx={CX} cy={CY}
        rx={LOWER_INNER_SCALE * BASE_RADIUS_X}
        ry={LOWER_INNER_SCALE * BASE_RADIUS_Z}
        fill="none" stroke="rgba(255,255,255,0.06)"
        strokeWidth={0.03}
      />

      <rect
        x={CX - PITCH_LENGTH / 2}
        y={CY - PITCH_WIDTH / 2}
        width={PITCH_LENGTH}
        height={PITCH_WIDTH}
        fill="#166534"
        stroke="rgba(34,197,94,0.4)"
        strokeWidth={0.04}
        rx={0.08}
      />
      <ellipse
        cx={CX} cy={CY}
        rx={0.3} ry={0.3}
        fill="none" stroke="rgba(34,197,94,0.3)"
        strokeWidth={0.03}
      />

      {gates?.map((gate) => {
        const [gx, gz] = bowlPosition(gate.angle_deg, UPPER_OUTER_SCALE + 0.15);
        const gsx = CX + gx;
        const gsy = CY - gz;
        const gateColor = getGateColor(gate.name || gate.id);
        return (
          <g key={gate.id}>
            <circle cx={gsx} cy={gsy} r={0.15} fill={gateColor} stroke="rgba(0,0,0,0.5)" strokeWidth={0.04} />
            <text x={gsx} y={gsy + 0.06} textAnchor="middle" fill="#ffffff" fontSize={0.16} fontWeight={700}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {gate.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
