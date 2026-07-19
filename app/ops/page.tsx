'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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

// ─── Section Card Grid ────────────────────────────────────────────────────────

function SectionCard({ section }: { section: CongestionRow }) {
  const [showDetail, setShowDetail] = useState(false);
  const [posAbove, setPosAbove] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dotColor =
    section.level === 'high' ? 'bg-red-500'
    : section.level === 'medium' ? 'bg-amber-500'
    : 'bg-emerald-500';

  const borderColor =
    section.level === 'high' ? 'border-red-500/30 bg-red-500/[0.08]'
    : section.level === 'medium' ? 'border-amber-400/20 bg-amber-400/[0.05]'
    : 'border-emerald-400/15 bg-emerald-500/[0.04]';

  const pillColors =
    section.level === 'high' ? 'border-red-400/[0.5] bg-red-500/[0.16] text-red-200'
    : section.level === 'medium' ? 'border-amber-300/[0.5] bg-amber-400/[0.16] text-amber-100'
    : 'border-emerald-400/[0.45] bg-emerald-500/[0.14] text-emerald-100';

  const popoverBorder = section.level === 'high'
    ? 'rgba(248,113,113,0.3)'
    : section.level === 'medium'
      ? 'rgba(251,191,36,0.25)'
      : 'rgba(52,211,153,0.2)';

  const popoverShadow = section.level === 'high'
    ? 'rgba(239,68,68,0.3)'
    : section.level === 'medium'
      ? 'rgba(251,191,36,0.2)'
      : 'rgba(52,211,153,0.15)';

  function show() {
    clearTimeout(hideTimerRef.current);
    clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setPosAbove(rect.top >= 180);
      }
      setShowDetail(true);
    }, 100);
  }

  function scheduleHide() {
    clearTimeout(showTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowDetail(false);
    }, 150);
  }

  function cancelHide() {
    clearTimeout(hideTimerRef.current);
  }

  useEffect(() => () => {
    clearTimeout(showTimerRef.current);
    clearTimeout(hideTimerRef.current);
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group relative rounded-md border p-2 ${
        section.level === 'high' && 'ops-card-high'
      } ${borderColor}`}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <div className="flex items-center justify-between">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
        <Link
          href={`/ops/3d?section=${section.section_number}`}
          className="text-slate-600 opacity-0 transition-opacity hover:text-indigo-400 group-hover:opacity-100"
          aria-label="View in 3D"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </Link>
      </div>
      <div className="mt-1 text-sm font-bold text-slate-100">{section.section_number}</div>
      <div className="text-[0.6rem] text-slate-500">{section.device_count} devices</div>

      {/* ── Detail card popover ── */}
      <div
        className={`absolute z-50 transition-all duration-150 ${
          posAbove ? 'bottom-full mb-2.5' : 'top-full mt-2.5'
        } left-1/2 -translate-x-1/2 ${
          showDetail ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{ transformOrigin: posAbove ? 'bottom center' : 'top center' }}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
      >
        {/* Arrow */}
        <div className="absolute left-1/2 z-10 -translate-x-1/2" style={posAbove ? {
          top: '100%', width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid #0f172a',
        } : {
          bottom: '100%', width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '8px solid #0f172a',
        }} />

        {/* Panel */}
        <div
          className="w-56 rounded-lg border bg-[#0f172a] p-3 shadow-2xl"
          style={{
            borderColor: popoverBorder,
            boxShadow: `0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px ${popoverShadow}`,
          }}
        >
          {/* Header: section number + status pill */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-lg font-bold text-slate-100">{section.section_number}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase ${pillColors}`}>
              {section.level}
            </span>
          </div>

          {/* Tier */}
          <p className="m-0 text-xs font-medium text-slate-400">{section.tier}</p>

          {/* Device count */}
          <p className="m-0 mt-1 text-xs text-slate-400">
            {section.device_count} device{section.device_count === 1 ? '' : 's'} detected
          </p>

          {/* Last updated */}
          <p className="m-0 mt-0.5 text-xs text-slate-500">Updated {relativeTime(section.updated_at)}</p>

          {/* Divider */}
          <div className="my-2.5 border-t border-white/[0.08]" />

          {/* View in 3D button */}
          <Link
            href={`/ops/3d?section=${section.section_number}`}
            className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-indigo-400 transition hover:border-indigo-400/30 hover:bg-indigo-500/[0.12] hover:text-indigo-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            View in 3D
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionGrid({
  sections,
  dataLoading,
}: {
  sections: CongestionRow[];
  dataLoading: boolean;
}) {
  const lowerTier = useMemo(
    () => sections.filter((s) => s.tier.toLowerCase().includes('lower')),
    [sections],
  );

  const upperTier = useMemo(
    () => sections.filter((s) => !s.tier.toLowerCase().includes('lower')),
    [sections],
  );

  if (dataLoading) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-md border border-dashed border-white/10 text-sm text-slate-500">
        Loading live congestion data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="mr-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Legend</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
          Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          High
        </span>
      </div>

      {/* Lower Tier */}
      <div>
        <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.15em] text-slate-500">
          Lower Tier
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {lowerTier.map((s) => (
            <SectionCard key={s.section_id} section={s} />
          ))}
        </div>
      </div>

      {/* Upper Tier */}
      {upperTier.length > 0 && (
        <div>
          <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.15em] text-slate-500">
            Upper Tier
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {upperTier.map((s) => (
              <SectionCard key={s.section_id} section={s} />
            ))}
          </div>
        </div>
      )}
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
      setAlerts(nextAlerts.filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i));
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
        setAlerts((current) => {
          const merged = [...result.newAlerts, ...current];
          const seen = new Set<string>();
          return merged.filter((a) => { const k = a.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30);
        });
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

  const sectionNumBySectionId = useMemo(() => {
    const m = new Map<string, string>();
    sections.forEach((s) => m.set(s.section_id, s.section_number));
    return m;
  }, [sections]);

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
        @keyframes opsCardHighPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(248, 113, 113, 0.15), 0 0 0 1px rgba(239, 68, 68, 0.3); }
          50%      { box-shadow: 0 0 24px rgba(248, 113, 113, 0.35), 0 0 0 1px rgba(239, 68, 68, 0.7); }
        }
        .ops-card-high {
          animation: opsCardHighPulse 1.8s ease-in-out infinite;
        }

        @keyframes opsAlertFlash {
          0% { background: rgba(251, 191, 36, 0.2); border-color: rgba(251, 191, 36, 0.58); }
          100% { background: rgba(255, 255, 255, 0.035); border-color: rgba(255, 255, 255, 0.08); }
        }

        .ops-alert-flash {
          animation: opsAlertFlash 2.6s ease-out both;
        }

        .ops-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.35) rgba(15, 23, 42, 0.5);
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

            <SectionGrid sections={sections} dataLoading={dataLoading} />
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
                  alerts.map((alert) => {
                    const sectionNumber = alert.section_id ? sectionNumBySectionId.get(alert.section_id) : undefined;
                    return (
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
                      <div className="mt-2 flex items-center gap-3">
                        {sectionNumber && (
                          <Link
                            href={`/ops/3d?section=${sectionNumber}`}
                            className="text-xs font-semibold text-indigo-400 transition hover:text-indigo-300"
                          >
                            View in 3D &rarr;
                          </Link>
                        )}
                        {alert.resolved && <span className="text-xs font-semibold text-emerald-300">Resolved</span>}
                      </div>
                    </article>
                    );
                  })
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
