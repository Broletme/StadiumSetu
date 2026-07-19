'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type CongestionLevel = 'low' | 'medium' | 'high';
type RealtimePayload<T> = { new: T };
type SessionResult = { data?: { session?: { user?: unknown } | null } };

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

const HeatmapScene = dynamic(() => import('./HeatmapScene'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Loading 3D scene…</p>
    </div>
  ),
});

const LEVEL_COLORS: Record<CongestionLevel, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

const FALLBACK_GATES: Gate[] = [
  { id: 'gate-a', name: 'Gate A', angle_deg: 45, lat: null, lng: null },
  { id: 'gate-b', name: 'Gate B', angle_deg: 135, lat: null, lng: null },
  { id: 'gate-c', name: 'Gate C', angle_deg: 225, lat: null, lng: null },
  { id: 'gate-d', name: 'Gate D', angle_deg: 315, lat: null, lng: null },
];

function PriorityPanel({
  sections,
  focusedSectionNumber,
  onSelect,
}: {
  sections: CongestionRow[];
  focusedSectionNumber: string | undefined;
  onSelect: (sectionNumber: string) => void;
}) {
  const prioritySections = useMemo(() => {
    return sections
      .filter((s) => s.level === 'medium' || s.level === 'high')
      .sort((a, b) => b.device_count - a.device_count)
      .map((s, i) => ({ ...s, priority: i + 1 }));
  }, [sections]);

  if (prioritySections.length === 0) {
    return (
      <div style={{
        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10,
        background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(8px)',
        borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 16px', color: '#64748b', fontSize: '0.78rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        No congestion hotspots
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10,
      background: 'rgba(10,10,15,0.88)', backdropFilter: 'blur(10px)',
      borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
      padding: '8px 0', minWidth: 200, maxWidth: 220,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{
        padding: '4px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 4, fontSize: '0.62rem', fontWeight: 700,
        color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em',
      }}>
        Priority {prioritySections.length > 0 && `(${prioritySections.length})`}
      </div>
      <div 
        className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-2 pb-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(148, 163, 184, 0.35) rgba(15, 23, 42, 0.5)' }}
      >
        {prioritySections.map((s) => {
          const isActive = focusedSectionNumber === s.section_number;
          const isHigh = s.level === 'high';
          
          return (
            <div
              key={s.section_id}
              onClick={() => onSelect(s.section_number)}
              className={`group cursor-pointer rounded-lg border p-2.5 transition-all ${
                isHigh
                  ? 'border-red-500/30 bg-red-500/[0.04] hover:bg-red-500/[0.08]'
                  : 'border-amber-400/30 bg-amber-400/[0.04] hover:bg-amber-400/[0.08]'
              } ${isActive ? (isHigh ? 'ring-1 ring-red-500/50' : 'ring-1 ring-amber-400/50') : ''}`}
            >
              {/* Header */}
              <div className="mb-2.5 flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-black text-white"
                  style={{ background: isHigh ? '#ef4444' : '#f59e0b' }}
                >
                  {s.priority}
                </span>
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: LEVEL_COLORS[s.level],
                    boxShadow: `0 0 6px ${LEVEL_COLORS[s.level]}`,
                  }}
                />
                <span className="text-[0.8rem] font-bold text-slate-100">Section {s.section_number}</span>
              </div>

              {/* Label-Value Grid */}
              <div className="grid grid-cols-2 gap-2 rounded bg-white/[0.03] p-2 text-xs">
                <div>
                  <span className="block text-[0.55rem] uppercase tracking-wider text-slate-500">Tier</span>
                  <span className="font-semibold text-slate-200">{s.tier}</span>
                </div>
                <div>
                  <span className="block text-[0.55rem] uppercase tracking-wider text-slate-500">Devices</span>
                  <span className="font-semibold text-slate-200">{s.device_count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ops3DContent() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section');

  const [authLoading, setAuthLoading] = useState(true);
  const [sections, setSections] = useState<CongestionRow[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [focusedSectionNumber, setFocusedSectionNumber] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (sectionParam) setFocusedSectionNumber(sectionParam);
  }, [sectionParam]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [congestionRes, gatesRes] = await Promise.all([
        fetch(buildApiUrl('/congestion'), { cache: 'no-store' }),
        fetch(buildApiUrl('/gates'), { cache: 'no-store' }),
      ]);
      if (congestionRes.ok) {
        const data: CongestionRow[] = await congestionRes.json();
        setSections([...data].sort(compareSections));
      }
      if (gatesRes.ok) {
        const data: Gate[] = await gatesRes.json();
        if (data.length > 0) setGates(data);
      }
    } catch {
      // fallback — gates will use synthetic list
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
      void fetchData();
    });
  }, [fetchData, router, supabase]);

  useEffect(() => {
    if (authLoading) return;

    const channel = supabase
      .channel('ops3d-congestion')
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

    return () => { supabase.removeChannel(channel); };
  }, [authLoading, supabase]);

  const displayGates = gates.length > 0 ? gates : FALLBACK_GATES;

  if (authLoading) {
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', color: '#64748b',
      }}>
        Loading…
      </main>
    );
  }

  return (
    <main style={{
      width: '100vw', height: '100vh', background: '#0a0a0f', overflow: 'hidden',
      position: 'relative', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <Link href="/ops" style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500,
        padding: '0.4rem 0.8rem', background: 'rgba(0,0,0,0.65)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
        transition: 'all 0.2s',
      }}>
        ← Back to Ops Dashboard
      </Link>

      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Congestion Heatmap
        </h1>
        {focusedSectionNumber && (
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 0' }}>
            Focused on Section {focusedSectionNumber}
          </p>
        )}
      </div>

      <div style={{
        position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
        display: 'flex', gap: 16, padding: '8px 16px',
        background: 'rgba(0,0,0,0.6)', borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)',
        pointerEvents: 'none',
      }}>
        {([
          { color: '#22c55e', label: 'Low' },
          { color: '#f59e0b', label: 'Medium' },
          { color: '#ef4444', label: 'High' },
        ] as const).map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: '0.78rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
            {item.label}
          </div>
        ))}
        <div style={{ marginLeft: 4, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.7rem' }}>
          {dataLoading ? 'Loading…' : `${sections.length} sections`}
        </div>
      </div>

      <PriorityPanel sections={sections} focusedSectionNumber={focusedSectionNumber} onSelect={setFocusedSectionNumber} />
      <div style={{ width: '100%', height: '100%' }}>
        <HeatmapScene sections={sections} gates={displayGates} focusSectionNumber={focusedSectionNumber} />
      </div>
    </main>
  );
}

export default function Ops3DPage() {
  return (
    <Suspense fallback={
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', color: '#64748b',
      }}>
        Loading…
      </main>
    }>
      <Ops3DContent />
    </Suspense>
  );
}
