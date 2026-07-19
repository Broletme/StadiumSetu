'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
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

const FALLBACK_GATES: Gate[] = [
  { id: 'gate-a', name: 'Gate A', angle_deg: 45, lat: null, lng: null },
  { id: 'gate-b', name: 'Gate B', angle_deg: 135, lat: null, lng: null },
  { id: 'gate-c', name: 'Gate C', angle_deg: 225, lat: null, lng: null },
  { id: 'gate-d', name: 'Gate D', angle_deg: 315, lat: null, lng: null },
];

function Ops3DContent() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section');

  const [authLoading, setAuthLoading] = useState(true);
  const [sections, setSections] = useState<CongestionRow[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

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

  const focusSectionNumber = sectionParam ?? undefined;

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
        {focusSectionNumber && (
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 0' }}>
            Focused on Section {focusSectionNumber}
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

      <div style={{ width: '100%', height: '100%' }}>
        <HeatmapScene sections={sections} gates={displayGates} focusSectionNumber={focusSectionNumber} />
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
