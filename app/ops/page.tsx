'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type CongestionLevel = 'low' | 'medium' | 'high';
type TierName = 'Lower Tier' | 'Upper Tier' | string;
type RealtimePayload<T> = { new: T };
type SessionResult = { data?: { session?: { user?: unknown } | null } };

interface CongestionRow {
  section_id: string;
  device_count: number;
  level: CongestionLevel;
  updated_at: string;
  section_number: string;
  tier: TierName;
  section_index: number;
}

interface AlertRow {
  id: string;
  section_id: string | null;
  message: string;
  severity: CongestionLevel;
  created_at: string;
  resolved: boolean;
}

interface SimulateSpikeResult {
  updatedSections: CongestionRow[];
  newAlerts: AlertRow[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function buildApiUrl(path: string) {
  return `${API_BASE_URL ?? ''}${path}`;
}

function compareSections(a: CongestionRow, b: CongestionRow) {
  return a.section_number.localeCompare(b.section_number, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function relativeTime(value: string) {
  const then = new Date(value).getTime();
  const now = Date.now();

  if (Number.isNaN(then)) return 'just now';

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} sec ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function severityClasses(severity: CongestionLevel) {
  if (severity === 'high') {
    return 'border-red-400/[0.5] bg-red-500/[0.16] text-red-200';
  }

  if (severity === 'medium') {
    return 'border-amber-300/[0.5] bg-amber-400/[0.16] text-amber-100';
  }

  return 'border-emerald-400/[0.45] bg-emerald-500/[0.14] text-emerald-100';
}

function StadiumLogo() {
  return (
    <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-indigo-400/25 bg-indigo-500/[0.12]">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#opsLogoGradient)" />
        <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.15)" />
        <defs>
          <linearGradient id="opsLogoGradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ─── SVG Section Heatmap ─────────────────────────────────────────────────────

type HoverInfo = { tier: 'lower' | 'upper'; index: number } | null;

const HEATMAP_CX = 250;
const HEATMAP_CY = 250;
const HEATMAP_BRX = 7;
const HEATMAP_BRZ = 5;
const HEATMAP_PX = 25;
const HEATMAP_TOTAL = 24;
const HEATMAP_GAP = 0.46;
const HEATMAP_HALF = (360 / HEATMAP_TOTAL) * HEATMAP_GAP;
const HEATMAP_LI = 0.50;
const HEATMAP_LO = 0.86;
const HEATMAP_UI = 0.93;
const HEATMAP_UO = 1.29;

function heatmapPoint(angleDeg: number, scale: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [
    HEATMAP_CX + Math.cos(rad) * HEATMAP_BRX * scale * HEATMAP_PX,
    HEATMAP_CY + Math.sin(rad) * HEATMAP_BRZ * scale * HEATMAP_PX,
  ];
}

function buildWedgePath(idx: number, innerS: number, outerS: number): string {
  const centerDeg = (idx / HEATMAP_TOTAL) * 360;
  const sDeg = centerDeg - HEATMAP_HALF;
  const eDeg = centerDeg + HEATMAP_HALF;
  const [osx, osy] = heatmapPoint(sDeg, outerS);
  const [oex, oey] = heatmapPoint(eDeg, outerS);
  const [isx, isy] = heatmapPoint(sDeg, innerS);
  const [iex, iey] = heatmapPoint(eDeg, innerS);
  const orx = HEATMAP_BRX * outerS * HEATMAP_PX;
  const ory = HEATMAP_BRZ * outerS * HEATMAP_PX;
  const irx = HEATMAP_BRX * innerS * HEATMAP_PX;
  const iry = HEATMAP_BRZ * innerS * HEATMAP_PX;
  return [
    `M ${osx} ${osy}`,
    `A ${orx} ${ory} 0 0 1 ${oex} ${oey}`,
    `L ${iex} ${iey}`,
    `A ${irx} ${iry} 0 0 0 ${isx} ${isy}`,
    'Z',
  ].join(' ');
}

function wedgeGradId(level: string): string {
  return level === 'high' ? 'url(#grad-high)' : level === 'medium' ? 'url(#grad-med)' : 'url(#grad-low)';
}

function wedgeBaseOpacity(level: string): number {
  return level === 'high' ? 0.82 : level === 'medium' ? 0.68 : 0.55;
}

function levelGradientColor(level: string): string {
  return level === 'high' ? '#dc2626' : level === 'medium' ? '#b45309' : '#047857';
}

const GATE_MARKER_SCALE = HEATMAP_UO + 0.02;
const GATE_LABEL_SCALE = HEATMAP_UO + 0.18;

function SectionHeatmapSVG({
  sections,
  dataLoading,
}: {
  sections: CongestionRow[];
  dataLoading: boolean;
}) {
  const [hovered, setHovered] = useState<HoverInfo>(null);
  const [tooltipRow, setTooltipRow] = useState<CongestionRow | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [gates, setGates] = useState<Array<{ id: string; name: string; angle_deg: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchGates = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('gates')
          .select('id, name, angle_deg')
          .order('name', { ascending: true });
        if (!cancelled && data && !error) setGates(data);
      } catch {}
    };
    fetchGates();
    return () => { cancelled = true; };
  }, []);

  const lowerMap = useMemo(() => {
    const m = new Map<number, CongestionRow>();
    sections.forEach((s) => { if (s.tier.toLowerCase().includes('lower')) m.set(s.section_index, s); });
    return m;
  }, [sections]);

  const upperMap = useMemo(() => {
    const m = new Map<number, CongestionRow>();
    sections.forEach((s) => { if (!s.tier.toLowerCase().includes('lower')) m.set(s.section_index, s); });
    return m;
  }, [sections]);

  const handleEnter = (e: React.MouseEvent, row: CongestionRow | undefined, tier: 'lower' | 'upper', idx: number) => {
    if (!row) return;
    setHovered({ tier, index: idx });
    setTooltipRow(row);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleLeave = () => { setHovered(null); setTooltipRow(null); };

  const handleMove = (e: React.MouseEvent) => {
    if (!tooltipRow || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 12 });
  };

  if (dataLoading) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-md border border-dashed border-white/10 text-sm text-slate-500">
        Loading live congestion data...
      </div>
    );
  }

  const renderWedges = (
    tierKey: 'lower' | 'upper',
    sectionMap: Map<number, CongestionRow>,
    innerS: number,
    outerS: number,
  ) =>
    Array.from({ length: HEATMAP_TOTAL }, (_, i) => {
      const row = sectionMap.get(i);
      const level = row?.level ?? 'low';
      const d = buildWedgePath(i, innerS, outerS);
      const hi = hovered?.tier === tierKey && hovered?.index === i;
      const baseOp = wedgeBaseOpacity(level);
      return (
        <g key={`${tierKey}-${i}`}>
          <path
            d={d}
            fill={wedgeGradId(level)}
            fillOpacity={hi ? 0.95 : baseOp}
            stroke={hi ? '#f8fafc' : 'rgba(255,255,255,0.08)'}
            strokeWidth={hi ? 1.5 : 0.4}
            filter="url(#wedge-shadow)"
            className={level === 'high' && !hi ? 'ops-wedge-fill-pulse' : undefined}
            style={{ cursor: row ? 'pointer' : 'default', transition: 'fill-opacity 0.15s', '--base-fill': baseOp } as React.CSSProperties}
            onMouseEnter={(e) => handleEnter(e, row, tierKey, i)}
            onMouseLeave={handleLeave}
          />
          {level === 'high' && (
            <path d={d} fill="none" stroke="#ef4444" strokeWidth={3} className="ops-wedge-pulse" />
          )}
          <text
            x={heatmapPoint((i / HEATMAP_TOTAL) * 360, (innerS + outerS) / 2)[0]}
            y={heatmapPoint((i / HEATMAP_TOTAL) * 360, (innerS + outerS) / 2)[1]}
            textAnchor="middle" dominantBaseline="central"
            fill={row ? '#f1f5f9' : 'rgba(255,255,255,0.15)'}
            fontSize="6" fontFamily="monospace" fontWeight={600}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >{row?.section_number ?? ''}</text>
        </g>
      );
    });

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.008] p-5 shadow-[0_0_0_1px_rgba(99,102,241,0.06),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm">
        <svg
          viewBox="0 0 500 500"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseMove={handleMove}
        >
          <defs>
            {/* Level gradients */}
            <radialGradient id="grad-low" cx="35%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#059669" />
            </radialGradient>
            <radialGradient id="grad-med" cx="35%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#d97706" />
            </radialGradient>
            <radialGradient id="grad-high" cx="35%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="100%" stopColor="#dc2626" />
            </radialGradient>
            {/* Drop shadows */}
            <filter id="wedge-shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.4" />
            </filter>
            <filter id="pitch-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
            </filter>
            <filter id="gate-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Pitch ──────────────────────────────────────────────────────── */}
          <g filter="url(#pitch-shadow)">
            <rect x={HEATMAP_CX - 36} y={HEATMAP_CY - 24} width={72} height={48} fill="#166534" rx={3} stroke="#22c55e" strokeWidth={0.8} strokeOpacity={0.4} />
            {/* Halfway line */}
            <line x1={HEATMAP_CX} y1={HEATMAP_CY - 22} x2={HEATMAP_CX} y2={HEATMAP_CY + 22} stroke="#22c55e" strokeWidth={0.5} strokeOpacity={0.35} />
            {/* Center circle */}
            <circle cx={HEATMAP_CX} cy={HEATMAP_CY} r={9} fill="none" stroke="#22c55e" strokeWidth={0.5} strokeOpacity={0.35} />
            {/* Center spot */}
            <circle cx={HEATMAP_CX} cy={HEATMAP_CY} r={1.2} fill="rgba(34,197,94,0.3)" />
          </g>
          <text
            x={HEATMAP_CX} y={HEATMAP_CY + 33}
            textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="6.5" fontFamily="monospace" fontWeight={500}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >PITCH</text>

          {/* ── Lower Tier wedges ──────────────────────────────────────────── */}
          {renderWedges('lower', lowerMap, HEATMAP_LI, HEATMAP_LO)}

          {/* ── Upper Tier wedges ──────────────────────────────────────────── */}
          {renderWedges('upper', upperMap, HEATMAP_UI, HEATMAP_UO)}

          {/* ── Gate markers ──────────────────────────────────────────────── */}
          {gates.map((gate) => {
            const [mx, my] = heatmapPoint(gate.angle_deg, GATE_MARKER_SCALE);
            const [lx, ly] = heatmapPoint(gate.angle_deg, GATE_LABEL_SCALE);
            const pillW = gate.name.length * 5.5 + 12;
            const pillH = 15;
            return (
              <g key={gate.id}>
                {/* Glow behind marker */}
                <circle cx={mx} cy={my} r={6} fill="#f59e0b" opacity={0.2} filter="url(#gate-glow)" />
                {/* Marker dot */}
                <circle cx={mx} cy={my} r={3.5} fill="#f59e0b" className="ops-gate-pulse" />
                {/* Pill badge background */}
                <rect
                  x={lx - pillW / 2} y={ly - pillH / 2}
                  width={pillW} height={pillH} rx={pillH / 2}
                  fill="rgba(0,0,0,0.7)"
                  stroke="rgba(245,158,11,0.35)"
                  strokeWidth={0.8}
                />
                {/* Pill badge text */}
                <text
                  x={lx} y={ly + 1}
                  textAnchor="middle" dominantBaseline="central"
                  fill="#fbbf24" fontSize="7.5" fontFamily="sans-serif" fontWeight={700}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >{gate.name}</text>
              </g>
            );
          })}

          {/* ── Tier labels ────────────────────────────────────────────────── */}
          {/* Lower tier label — below the ring (angle 90°) */}
          <g>
            <text
              x={heatmapPoint(90, (HEATMAP_LI + HEATMAP_LO) / 2)[0]}
              y={heatmapPoint(90, HEATMAP_LO + 0.35)[1]}
              textAnchor="middle" dominantBaseline="central"
              fill="rgba(148,163,184,0.5)" fontSize="7.5" fontFamily="sans-serif" fontWeight={700}
              letterSpacing="0.2em"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >LOWER TIER</text>
          </g>
          {/* Upper tier label — above the ring (angle 270°) */}
          <g>
            <text
              x={heatmapPoint(270, (HEATMAP_UI + HEATMAP_UO) / 2)[0]}
              y={heatmapPoint(270, HEATMAP_UO + 0.35)[1]}
              textAnchor="middle" dominantBaseline="central"
              fill="rgba(148,163,184,0.5)" fontSize="7.5" fontFamily="sans-serif" fontWeight={700}
              letterSpacing="0.2em"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >UPPER TIER</text>
          </g>

          {/* ── Legend ─────────────────────────────────────────────────────── */}
          <g transform="translate(390, 20)">
            {/* Panel bg */}
            <rect x={0} y={0} width={92} height={76} rx={8} fill="rgba(15,23,42,0.8)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />
            <text x={46} y={16} textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="sans-serif" fontWeight={600} letterSpacing="0.1em">LEGEND</text>
            {/* Low */}
            <circle cx={16} cy={34} r={5} fill="#059669" />
            <text x={28} y={35} fill="#cbd5e1" fontSize="7.5" fontFamily="sans-serif">Low</text>
            {/* Medium */}
            <circle cx={16} cy={50} r={5} fill="#d97706" />
            <text x={28} y={51} fill="#cbd5e1" fontSize="7.5" fontFamily="sans-serif">Medium</text>
            {/* High */}
            <circle cx={16} cy={66} r={5} fill="#dc2626" />
            <text x={28} y={67} fill="#cbd5e1" fontSize="7.5" fontFamily="sans-serif">High</text>
          </g>
        </svg>

        {/* Tooltip */}
        {tooltipRow && (
          <div
            style={{
              position: 'absolute',
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(15,23,42,0.95)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.78rem',
              color: '#e2e8f0',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 50,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
              Section {tooltipRow.section_number} &middot; {tooltipRow.tier}
            </div>
            <div style={{ color: '#94a3b8' }}>
              Devices: <strong>{tooltipRow.device_count}</strong> &middot;{' '}
              <span style={{ color: levelGradientColor(tooltipRow.level), fontWeight: 600, textTransform: 'uppercase' }}>
                {tooltipRow.level}
              </span>
            </div>
            <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.15rem' }}>
              Updated: {relativeTime(tooltipRow.updated_at)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpsDashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const flashTimeouts = useRef<number[]>([]);

  const [authLoading, setAuthLoading] = useState(true);
  const [sections, setSections] = useState<CongestionRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'spike' | 'reset' | null>(null);
  const [flashingAlertIds, setFlashingAlertIds] = useState<string[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setDataLoading(true);
    setError(null);

    try {
      const [congestionResponse, alertsResponse] = await Promise.all([
        fetch(buildApiUrl('/congestion'), { cache: 'no-store' }),
        fetch(buildApiUrl('/alerts'), { cache: 'no-store' }),
      ]);

      if (!congestionResponse.ok) {
        throw new Error(`Congestion request failed (${congestionResponse.status})`);
      }

      if (!alertsResponse.ok) {
        throw new Error(`Alerts request failed (${alertsResponse.status})`);
      }

      const [nextSections, nextAlerts] = (await Promise.all([
        congestionResponse.json(),
        alertsResponse.json(),
      ])) as [CongestionRow[], AlertRow[]];

      setSections([...nextSections].sort(compareSections));
      setAlerts(nextAlerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ops dashboard data.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then((res: SessionResult) => {
      const session = res.data?.session;

      if (!session?.user) {
        router.replace('/');
        return;
      }

      setAuthLoading(false);
      void fetchDashboardData();
    });
  }, [fetchDashboardData, router, supabase]);

  useEffect(() => {
    if (authLoading) return;

    const congestionChannel = supabase
      .channel('ops-section-congestion')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'section_congestion' },
        (payload: RealtimePayload<Partial<CongestionRow> & { section_id?: string }>) => {
          const updated = payload.new as Partial<CongestionRow> & { section_id?: string };

          if (!updated.section_id) return;

          setSections((current) =>
            current
              .map((section) =>
                section.section_id === updated.section_id
                  ? {
                      ...section,
                      device_count: updated.device_count ?? section.device_count,
                      level: updated.level ?? section.level,
                      updated_at: updated.updated_at ?? section.updated_at,
                    }
                  : section,
              )
              .sort(compareSections),
          );
        },
      )
      .subscribe();

    const alertsChannel = supabase
      .channel('ops-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload: RealtimePayload<AlertRow>) => {
          const nextAlert = payload.new as AlertRow;

          if (!nextAlert?.id) return;

          setAlerts((current) => [nextAlert, ...current.filter((alert) => alert.id !== nextAlert.id)].slice(0, 30));
          setFlashingAlertIds((current) => [nextAlert.id, ...current]);

          const timeoutId = window.setTimeout(() => {
            setFlashingAlertIds((current) => current.filter((id) => id !== nextAlert.id));
          }, 2600);

          flashTimeouts.current.push(timeoutId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(congestionChannel);
      supabase.removeChannel(alertsChannel);
      flashTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      flashTimeouts.current = [];
    };
  }, [authLoading, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  async function runDemoAction(action: 'spike' | 'reset') {
    setActiveAction(action);
    setError(null);

    try {
      const endpoint = action === 'spike' ? '/congestion/simulate-spike' : '/congestion/reset';
      const response = await fetch(buildApiUrl(endpoint), { method: 'POST' });

      if (!response.ok) {
        throw new Error(`${action === 'spike' ? 'Simulate spike' : 'Reset'} failed (${response.status})`);
      }

      if (action === 'spike') {
        const result = (await response.json()) as SimulateSpikeResult;
        setSections((current) =>
          current
            .map((section) => {
              const updated = result.updatedSections.find((next) => next.section_id === section.section_id);
              return updated ? { ...section, ...updated } : section;
            })
            .sort(compareSections),
        );
        setAlerts((current) => [...result.newAlerts, ...current].slice(0, 30));
      } else {
        await response.json().catch(() => null);
        fetchDashboardData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo action failed.');
    } finally {
      setActiveAction(null);
    }
  }

  const statusCounts = useMemo(
    () =>
      sections.reduce(
        (acc, section) => {
          acc[section.level] += 1;
          return acc;
        },
        { low: 0, medium: 0, high: 0 },
      ),
    [sections],
  );

  const latestUpdate = useMemo(() => {
    const timestamps = sections.map((section) => new Date(section.updated_at).getTime()).filter((time) => !Number.isNaN(time));
    if (!timestamps.length) return 'Waiting for data';
    return relativeTime(new Date(Math.max(...timestamps)).toISOString());
  }, [sections]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-slate-400" suppressHydrationWarning>
        Loading ops dashboard...
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#0a0a0f] px-4 py-5 font-sans text-slate-100 sm:px-6 lg:px-8"
      suppressHydrationWarning
    >
      <style>{`
        @keyframes opsHighPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(248, 113, 113, 0.2), inset 0 1px 0 rgba(255,255,255,0.06); }
          50% { box-shadow: 0 0 34px rgba(248, 113, 113, 0.42), inset 0 1px 0 rgba(255,255,255,0.09); }
        }

        @keyframes opsAlertFlash {
          0% { background: rgba(251, 191, 36, 0.2); border-color: rgba(251, 191, 36, 0.58); }
          100% { background: rgba(255, 255, 255, 0.035); border-color: rgba(255, 255, 255, 0.08); }
        }

        .ops-high-pulse {
          animation: opsHighPulse 1.8s ease-in-out infinite;
        }

        .ops-alert-flash {
          animation: opsAlertFlash 2.6s ease-out both;
        }

        .ops-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.35) rgba(15, 23, 42, 0.5);
        }

        @keyframes opsWedgePulse {
          0%, 100% { stroke-opacity: 0.08; stroke-width: 3; }
          50%      { stroke-opacity: 0.85; stroke-width: 6; }
        }
        @keyframes opsWedgeFillPulse {
          0%, 100% { fill-opacity: var(--base-fill); }
          50%      { fill-opacity: 1; }
        }
        .ops-wedge-pulse {
          animation: opsWedgePulse 1.4s ease-in-out infinite;
          pointer-events: none;
        }
        .ops-wedge-fill-pulse {
          animation: opsWedgeFillPulse 1.4s ease-in-out infinite;
        }

        .ops-gate-pulse {
          animation: opsGatePulse 2.2s ease-in-out infinite;
        }
        @keyframes opsGatePulse {
          0%, 100% { opacity: 0.5; r: 3; }
          50%      { opacity: 1; r: 4.5; }
        }
      `}</style>

      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <StadiumLogo />
            <div className="min-w-0">
              <h1 className="m-0 text-xl font-bold text-slate-100">StadiumSetu Ops</h1>
              <p className="m-0 mt-1 text-sm text-slate-500">Live section congestion and alert monitoring</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2">Latest update: {latestUpdate}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-white/10 bg-transparent px-3 py-2 font-medium text-slate-400 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-200"
            >
              Sign Out
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4 backdrop-blur-sm" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.06)' }}>
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="m-0 text-base font-semibold text-slate-100">Section Heatmap</h2>
                <p className="m-0 mt-1 text-sm text-slate-500">Device counts by seating tier</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                  <span className="block text-lg font-bold">{statusCounts.low}</span>
                  Low
                </div>
                <div className="rounded-md border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-amber-100">
                  <span className="block text-lg font-bold">{statusCounts.medium}</span>
                  Medium
                </div>
                <div className="rounded-md border border-red-400/[0.35] bg-red-500/10 px-3 py-2 text-red-100">
                  <span className="block text-lg font-bold">{statusCounts.high}</span>
                  High
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <SectionHeatmapSVG sections={sections} dataLoading={dataLoading} />
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-cyan-300/20 bg-cyan-400/[0.055] p-4 shadow-xl shadow-black/25">
              <div className="mb-3">
                <p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-cyan-200">Demo Controls</p>
                <p className="m-0 mt-1 text-sm text-slate-400">Operator-only test tools for the live demo.</p>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => runDemoAction('spike')}
                  disabled={activeAction !== null}
                  className="rounded-md border border-red-300/[0.35] bg-red-500/[0.15] px-4 py-3 text-sm font-bold text-red-100 transition hover:border-red-300/[0.55] hover:bg-red-500/[0.24] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {activeAction === 'spike' ? 'Simulating...' : 'Simulate Crowd Spike'}
                </button>
                <button
                  type="button"
                  onClick={() => runDemoAction('reset')}
                  disabled={activeAction !== null}
                  className="rounded-md border border-emerald-300/[0.35] bg-emerald-500/[0.12] px-4 py-3 text-sm font-bold text-emerald-100 transition hover:border-emerald-300/[0.55] hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {activeAction === 'reset' ? 'Resetting...' : 'Reset to Normal'}
                </button>
              </div>
            </section>

            <section className="flex min-h-[520px] flex-col rounded-lg border border-white/[0.08] bg-white/[0.025] shadow-xl shadow-black/25">
              <div className="border-b border-white/[0.08] p-4">
                <h2 className="m-0 text-base font-semibold text-slate-100">Recent Alerts</h2>
                <p className="m-0 mt-1 text-sm text-slate-500">Newest incidents appear first</p>
              </div>

              <div className="ops-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
                {dataLoading ? (
                  <p className="m-0 text-sm text-slate-500">Loading alerts...</p>
                ) : alerts.length ? (
                  alerts.map((alert) => (
                    <article
                      key={alert.id}
                      className={`rounded-lg border border-white/[0.08] bg-white/[0.035] p-3 ${
                        flashingAlertIds.includes(alert.id) ? 'ops-alert-flash' : ''
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[0.66rem] font-bold uppercase ${severityClasses(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <time className="text-xs text-slate-500">{relativeTime(alert.created_at)}</time>
                      </div>
                      <p className="m-0 text-sm leading-5 text-slate-200">{alert.message}</p>
                      {alert.resolved && <p className="m-0 mt-2 text-xs font-semibold text-emerald-300">Resolved</p>}
                    </article>
                  ))
                ) : (
                  <div className="grid min-h-[260px] place-items-center rounded-md border border-dashed border-white/10 text-center text-sm text-slate-500">
                    No alerts yet.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
