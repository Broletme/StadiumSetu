'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  BASE_RADIUS_X, BASE_RADIUS_Z,
  CONCOURSE_INNER_SCALE, CONCOURSE_OUTER_SCALE,
  LOWER_INNER_SCALE, LOWER_OUTER_SCALE,
  UPPER_INNER_SCALE, UPPER_OUTER_SCALE,
  CONCOURSE_MID_SCALE,
  TOTAL_SECTIONS,
  PITCH_LENGTH, PITCH_WIDTH,
  type AmenityType,
  type Amenity,
  AMENITY_TYPE_COLORS,
  AMENITY_TYPE_LABELS,
  AMENITY_ICONS,
  bowlPosition,
  sectionAngleDeg,
  getAllAmenities,
} from '@/lib/stadiumGeometry';

// ─── Coordinate mapping ──────────────────────────────────────────────────────

const MAX_SCALE = UPPER_OUTER_SCALE + 0.65;
const VIEW_EXTENT = Math.max(
  BASE_RADIUS_X * MAX_SCALE,
  BASE_RADIUS_Z * MAX_SCALE,
);

function toSvg(bx: number, bz: number): { sx: number; sy: number } {
  return { sx: bx, sy: -bz };
}

function angleToSvg(deg: number, scale: number): { sx: number; sy: number } {
  const [bx, bz] = bowlPosition(deg, scale);
  return toSvg(bx, bz);
}

// ─── Props ───────────────────────────────────────────────────────────────────

export type StadiumMap2DProps = {
  activeAmenities: Set<AmenityType>;
  highlightedType: AmenityType | null;
  onHover?: (type: AmenityType | null) => void;
};

// ─── SVG config ──────────────────────────────────────────────────────────────

const SECTION_LABEL_SCALE = UPPER_OUTER_SCALE + 0.45;
const GATE_SCALE_2D = CONCOURSE_OUTER_SCALE + 0.30;

// Hardcoded gate data for the 2D map (matches the stadium design)
const GATE_NAMES: { name: string; angle: number }[] = [
  { name: 'Gate A', angle: 0 },
  { name: 'Gate B', angle: 45 },
  { name: 'Gate C', angle: 90 },
  { name: 'Gate D', angle: 135 },
  { name: 'Gate E', angle: 180 },
  { name: 'Gate F', angle: 225 },
  { name: 'Gate G', angle: 270 },
  { name: 'Gate H', angle: 315 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function StadiumMap2D({
  activeAmenities,
  highlightedType,
  onHover,
}: StadiumMap2DProps) {
  const [hoveredItem, setHoveredItem] = useState<{
    type: 'amenity';
    id: string;
    amenity: Amenity;
  } | null>(null);

  // Local highlighted state so the component works standalone or with parent control
  const [localHighlighted, setLocalHighlighted] = useState<AmenityType | null>(
    null,
  );
  const effectiveHighlight = highlightedType ?? localHighlighted;

  // ── Zoom / Pan state ────────────────────────────────────────────────────────
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();

    const ZOOM_SENSITIVITY = 0.0003;
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    setTransform((prev) => {
      const newScale = Math.min(8, Math.max(0.5, prev.scale * (1 + delta)));
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = (mouseX / rect.width) * 2 - 1;
      const cy = (mouseY / rect.height) * 2 - 1;
      const scaleRatio = newScale / prev.scale;
      const newX = cx * VIEW_EXTENT * (1 - scaleRatio) + prev.x * scaleRatio;
      const newY = cy * VIEW_EXTENT * (1 - scaleRatio) + prev.y * scaleRatio;
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setCursorState('grabbing');
    setTransform((prev) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY, tx: prev.x, ty: prev.y };
      return prev;
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !dragStart.current) return;
    const start = dragStart.current;
    const dx = (e.clientX - start.x) / VIEW_EXTENT;
    const dy = (e.clientY - start.y) / VIEW_EXTENT;
    setTransform((prev) => ({
      ...prev,
      x: start.tx + dx / prev.scale * VIEW_EXTENT * 0.08,
      y: start.ty + dy / prev.scale * VIEW_EXTENT * 0.08,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    dragStart.current = null;
    setCursorState('grab');
  }, []);

  useEffect(() => {
    const onUp = () => {
      isDragging.current = false;
      dragStart.current = null;
      setCursorState('grab');
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  const [cursorState, setCursorState] = useState<'grab' | 'grabbing'>('grab');

  const activeList = useMemo(
    () => getAllAmenities().filter((a) => activeAmenities.has(a.type)),
    [activeAmenities],
  );

  const handleMouseEnter = useCallback(
    (type: AmenityType) => {
      setLocalHighlighted(type);
      onHover?.(type);
    },
    [onHover],
  );

  const handleMouseLeave = useCallback(() => {
    setLocalHighlighted(null);
    onHover?.(null);
  }, [onHover]);

  return (
    <svg
      ref={svgRef}
      viewBox={`${-VIEW_EXTENT} ${-VIEW_EXTENT} ${VIEW_EXTENT * 2} ${VIEW_EXTENT * 2}`}
      preserveAspectRatio="xMidYMid meet"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: cursorState,
        userSelect: cursorState === 'grabbing' ? 'none' : undefined,
      }}
    >
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
      <defs>
        <radialGradient id="pitchGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#14532d" />
          <stop offset="100%" stopColor="#166534" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="0.15" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Bowl tiers ──────────────────────────────────────────────────── */}

      {/* Upper tier outer edge */}
      <ellipse
        cx={0} cy={0}
        rx={UPPER_OUTER_SCALE * BASE_RADIUS_X}
        ry={UPPER_OUTER_SCALE * BASE_RADIUS_Z}
        fill="rgba(255,255,255,0.03)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={0.15}
      />

      {/* Upper tier inner edge */}
      <ellipse
        cx={0} cy={0}
        rx={UPPER_INNER_SCALE * BASE_RADIUS_X}
        ry={UPPER_INNER_SCALE * BASE_RADIUS_Z}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={0.1}
        strokeDasharray="0.6 0.6"
      />

      {/* Lower tier */}
      <ellipse
        cx={0} cy={0}
        rx={LOWER_OUTER_SCALE * BASE_RADIUS_X}
        ry={LOWER_OUTER_SCALE * BASE_RADIUS_Z}
        fill="rgba(79,70,229,0.04)"
        stroke="rgba(79,70,229,0.15)"
        strokeWidth={0.12}
      />
      <ellipse
        cx={0} cy={0}
        rx={LOWER_INNER_SCALE * BASE_RADIUS_X}
        ry={LOWER_INNER_SCALE * BASE_RADIUS_Z}
        fill="none"
        stroke="rgba(79,70,229,0.08)"
        strokeWidth={0.08}
        strokeDasharray="0.4 0.4"
      />

      {/* ── Section divider lines ───────────────────────────────────────── */}
      {Array.from({ length: TOTAL_SECTIONS }, (_, i) => {
        const deg = sectionAngleDeg(i);
        const innerScale = LOWER_INNER_SCALE;
        const outerScale = UPPER_OUTER_SCALE;
        const [ix, iz] = bowlPosition(deg, innerScale);
        const [ox, oz] = bowlPosition(deg, outerScale);
        return (
          <line
            key={`div-${i}`}
            x1={ix} y1={-iz}
            x2={ox} y2={-oz}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={0.08}
          />
        );
      })}

      {/* ── Concourse ring ──────────────────────────────────────────────── */}
      <ellipse
        cx={0} cy={0}
        rx={CONCOURSE_OUTER_SCALE * BASE_RADIUS_X}
        ry={CONCOURSE_OUTER_SCALE * BASE_RADIUS_Z}
        fill="rgba(255,255,255,0.03)"
        stroke="rgba(156,163,175,0.2)"
        strokeWidth={0.6}
      />
      <ellipse
        cx={0} cy={0}
        rx={CONCOURSE_INNER_SCALE * BASE_RADIUS_X}
        ry={CONCOURSE_INNER_SCALE * BASE_RADIUS_Z}
        fill="none"
        stroke="rgba(156,163,175,0.12)"
        strokeWidth={0.3}
        strokeDasharray="1 1.5"
      />

      {/* ── Pitch ───────────────────────────────────────────────────────── */}
      <rect
        x={-PITCH_LENGTH / 2}
        y={-PITCH_WIDTH / 2}
        width={PITCH_LENGTH}
        height={PITCH_WIDTH}
        fill="url(#pitchGrad)"
        stroke="rgba(34,197,94,0.4)"
        strokeWidth={0.15}
        rx={0.2}
      />
      {/* Centre circle */}
      <ellipse
        cx={0} cy={0}
        rx={0.55} ry={0.55}
        fill="none"
        stroke="rgba(34,197,94,0.35)"
        strokeWidth={0.08}
      />
      {/* Centre line */}
      <line
        x1={0} y1={-PITCH_WIDTH / 2 + 0.1}
        x2={0} y2={PITCH_WIDTH / 2 - 0.1}
        stroke="rgba(34,197,94,0.3)"
        strokeWidth={0.06}
      />
      {/* Penalty areas */}
      <rect
        x={-PITCH_LENGTH / 2 + 0.1}
        y={-PITCH_WIDTH * 0.22}
        width={PITCH_LENGTH * 0.22}
        height={PITCH_WIDTH * 0.44}
        fill="none"
        stroke="rgba(34,197,94,0.25)"
        strokeWidth={0.06}
      />
      <rect
        x={PITCH_LENGTH / 2 - 0.1 - PITCH_LENGTH * 0.22}
        y={-PITCH_WIDTH * 0.22}
        width={PITCH_LENGTH * 0.22}
        height={PITCH_WIDTH * 0.44}
        fill="none"
        stroke="rgba(34,197,94,0.25)"
        strokeWidth={0.06}
      />

      {/* ── Gate markers ────────────────────────────────────────────────── */}
      {GATE_NAMES.map((gate) => {
        const { sx, sy } = angleToSvg(gate.angle, GATE_SCALE_2D);
        return (
          <g key={gate.name}>
            <circle
              cx={sx} cy={sy} r={0.25}
              fill="#f59e0b"
              opacity={0.8}
            />
            <text
              x={sx} y={sy + 0.55}
              textAnchor="middle"
              fill="rgba(245,158,11,0.7)"
              fontSize={0.3}
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight={600}
            >
              {gate.name}
            </text>
          </g>
        );
      })}

      {/* ── Section labels ──────────────────────────────────────────────── */}
      {Array.from({ length: TOTAL_SECTIONS }, (_, i) => {
        const deg = sectionAngleDeg(i);
        const label = `${i + 1}`;
        const { sx, sy } = angleToSvg(deg, SECTION_LABEL_SCALE);
        return (
          <text
            key={`sl-${i}`}
            x={sx} y={sy + 0.12}
            textAnchor="middle"
            fill="rgba(255,255,255,0.2)"
            fontSize={0.3}
            fontFamily="'Inter', system-ui, sans-serif"
            fontWeight={500}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {label}
          </text>
        );
      })}

      {/* ── Tier labels ──────────────────────────────────────────────────── */}
      <text
        x={0} y={-(UPPER_OUTER_SCALE * BASE_RADIUS_Z + 0.8)}
        textAnchor="middle"
        fill="rgba(255,255,255,0.15)"
        fontSize={0.35}
        fontFamily="'Inter', system-ui, sans-serif"
        fontWeight={600}
        letterSpacing="0.3em"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        UPPER TIER
      </text>
      <text
        x={0} y={-(LOWER_OUTER_SCALE * BASE_RADIUS_Z + 0.5)}
        textAnchor="middle"
        fill="rgba(255,255,255,0.12)"
        fontSize={0.3}
        fontFamily="'Inter', system-ui, sans-serif"
        fontWeight={600}
        letterSpacing="0.25em"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        LOWER TIER
      </text>

      {/* ── Amenity markers ─────────────────────────────────────────────── */}
      {activeList.map((a) => {
        const [bx, bz] = bowlPosition(a.angle_deg, a.radiusScale);
        const { sx, sy } = toSvg(bx, bz);
        const color = AMENITY_TYPE_COLORS[a.type];
        const isHighlighted = effectiveHighlight === a.type;
        const isHovered = hoveredItem?.id === a.id;
        const r = isHighlighted ? 0.35 : 0.22;
        const glowR = isHighlighted ? 0.7 : 0;

        return (
          <g
            key={a.id}
            onMouseEnter={() => {
              setHoveredItem({ type: 'amenity', id: a.id, amenity: a });
              handleMouseEnter(a.type);
            }}
            onMouseLeave={() => {
              setHoveredItem(null);
              handleMouseLeave();
            }}
            style={{ cursor: 'pointer' }}
          >
            {/* Glow ring */}
            {isHighlighted && (
              <circle
                cx={sx} cy={sy} r={glowR}
                fill={color} opacity={0.12}
              />
            )}
            {/* Outer dot */}
            <circle
              cx={sx} cy={sy} r={r}
              fill={color}
              opacity={isHighlighted ? 1 : 0.85}
              stroke={isHighlighted ? '#fff' : 'none'}
              strokeWidth={isHighlighted ? 0.08 : 0}
              filter={isHighlighted ? 'url(#glow)' : undefined}
            />
            {/* Label */}
            <text
              x={sx} y={sy - r - 0.25}
              textAnchor="middle"
              fill={isHighlighted ? '#f1f5f9' : 'rgba(255,255,255,0.65)'}
              fontSize={isHighlighted ? 0.28 : 0.24}
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight={isHighlighted ? 600 : 400}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {a.icon} {a.name}
            </text>
          </g>
        );
      })}

      {/* ── Compass / scale ─────────────────────────────────────────────── */}
      <g
        transform={`translate(${-VIEW_EXTENT + 1.5}, ${VIEW_EXTENT - 1.2})`}
        opacity={0.15}
      >
        <line x1={0} y1={0} x2={0} y2={-0.8} stroke="white" strokeWidth={0.08} />
        <polygon points="-0.15,-0.7 0.15,-0.7 0,-0.9" fill="white" />
        <text
          x={-0.5} y={-0.45}
          fill="white"
          fontSize={0.28}
          fontFamily="'Inter', system-ui, sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          N
        </text>
      </g>

      {/* ── Tooltip on hover ────────────────────────────────────────────── */}
      {hoveredItem && (
        <>
          {/* Tooltip background */}
          <rect
            x={(() => {
              const [bx] = bowlPosition(
                hoveredItem.amenity.angle_deg,
                hoveredItem.amenity.radiusScale,
              );
              const tx = bx;
              const tooltipW = 3.5;
              return Math.max(
                -VIEW_EXTENT + 0.3,
                Math.min(
                  VIEW_EXTENT - tooltipW - 0.3,
                  tx - tooltipW / 2,
                ),
              );
            })()}
            y={(() => {
              const [, bz] = bowlPosition(
                hoveredItem.amenity.angle_deg,
                hoveredItem.amenity.radiusScale,
              );
              return -bz - 1.8;
            })()}
            width={3.5}
            height={1.2}
            rx={0.3}
            fill="rgba(15,23,42,0.9)"
            stroke={AMENITY_TYPE_COLORS[hoveredItem.amenity.type]}
            strokeWidth={0.1}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          />
          <text
            x={(() => {
              const [bx] = bowlPosition(
                hoveredItem.amenity.angle_deg,
                hoveredItem.amenity.radiusScale,
              );
              return bx;
            })()}
            y={(() => {
              const [, bz] = bowlPosition(
                hoveredItem.amenity.angle_deg,
                hoveredItem.amenity.radiusScale,
              );
              return -bz - 1.5;
            })()}
            textAnchor="middle"
            fill="#f1f5f9"
            fontSize={0.28}
            fontFamily="'Inter', system-ui, sans-serif"
            fontWeight={600}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {hoveredItem.amenity.icon} {hoveredItem.amenity.name}
          </text>
          <text
            x={(() => {
              const [bx] = bowlPosition(
                hoveredItem.amenity.angle_deg,
                hoveredItem.amenity.radiusScale,
              );
              return bx;
            })()}
            y={(() => {
              const [, bz] = bowlPosition(
                hoveredItem.amenity.angle_deg,
                hoveredItem.amenity.radiusScale,
              );
              return -bz - 1.15;
            })()}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={0.22}
            fontFamily="'Inter', system-ui, sans-serif"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {AMENITY_TYPE_LABELS[hoveredItem.amenity.type]}
          </text>
        </>
      )}
      </g>
    </svg>
  );
}
