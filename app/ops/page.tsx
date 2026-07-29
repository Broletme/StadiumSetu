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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function safeFetchApi(path: string, init?: RequestInit): Promise<Response> {
  const primaryUrl = buildApiUrl(path);
  try {
    return await fetch(primaryUrl, init);
  } catch (err) {
    if (primaryUrl.includes('localhost:3001')) {
      const fallbackUrl = primaryUrl.replace('localhost:3001', '127.0.0.1:3001');
      return await fetch(fallbackUrl, init);
    }
    throw err;
  }
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
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StadiumLogo() {
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 via-indigo-600/10 to-purple-600/20 shadow-md shadow-indigo-950/50">
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#opsLogoGrad)" />
        <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.25)" />
        <defs>
          <linearGradient id="opsLogoGrad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366f1" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ─── Section Card Component ───────────────────────────────────────────────────

function SectionCard({ section }: { section: CongestionRow }) {
  const [showDetail, setShowDetail] = useState(false);
  const [posAbove, setPosAbove] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Density percentage estimate (max capacity ~300)
  const densityPercent = Math.min(100, Math.round((section.device_count / 300) * 100));

  const isHigh = section.level === 'high';
  const isMedium = section.level === 'medium';

  const dotColor = isHigh
    ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)] ring-2 ring-rose-500/30'
    : isMedium
      ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] ring-2 ring-amber-400/30'
      : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] ring-2 ring-emerald-400/30';

  const cardStyle = isHigh
    ? 'border-rose-500/50 bg-gradient-to-b from-rose-950/40 via-slate-900/80 to-slate-950/90 text-rose-100 ops-card-high hover:border-rose-400 hover:shadow-lg hover:shadow-rose-950/50'
    : isMedium
      ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/30 via-slate-900/70 to-slate-950/90 text-amber-100 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-950/40'
      : 'border-slate-800/90 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-950/90 text-slate-200 hover:border-slate-700 hover:bg-slate-900/95';

  const progressBg = isHigh
    ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
    : isMedium
      ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
      : 'bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]';

  const pillColors = isHigh
    ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
    : isMedium
      ? 'border-amber-400/40 bg-amber-400/20 text-amber-300'
      : 'border-emerald-400/40 bg-emerald-400/20 text-emerald-300';

  function show() {
    clearTimeout(hideTimerRef.current);
    clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setPosAbove(rect.top >= 200);
      }
      setShowDetail(true);
    }, 70);
  }

  function scheduleHide() {
    clearTimeout(showTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowDetail(false);
    }, 120);
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
      className={`group relative rounded-xl border p-3 transition-all duration-200 cursor-pointer hover:-translate-y-1 ${cardStyle}`}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-xs font-extrabold tracking-tight text-white">{section.section_number}</span>
        </div>
        <Link
          href={`/ops/3d?section=${section.section_number}`}
          className="text-slate-400 opacity-0 transition-all hover:text-indigo-400 hover:scale-110 group-hover:opacity-100 p-0.5"
          aria-label="Inspect 3D"
          title="Inspect 3D"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </Link>
      </div>

      <div className="mt-2.5 flex items-baseline justify-between">
        <div>
          <span className="text-base font-black text-white tracking-tight">{section.device_count}</span>
          <span className="ml-1 text-[0.65rem] text-slate-400 font-medium">dev</span>
        </div>
        <span className="text-[0.65rem] font-bold text-slate-400">{densityPercent}%</span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-950/80 border border-white/5 p-[0.5px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
          style={{ width: `${Math.max(6, densityPercent)}%` }}
        />
      </div>

      <div
        className={`absolute z-50 transition-all duration-200 ${posAbove ? 'bottom-full mb-3' : 'top-full mt-3'
          } left-1/2 -translate-x-1/2 ${showDetail ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        style={{ transformOrigin: posAbove ? 'bottom center' : 'top center' }}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
      >
        <div className="w-64 rounded-xl border border-slate-700/90 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-xl shadow-black/90">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div>
              <span className="text-base font-black text-white tracking-tight">Section {section.section_number}</span>
              <p className="m-0 text-[0.68rem] font-semibold text-slate-400">{section.tier}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider ${pillColors}`}>
              {section.level}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 my-3">
            <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800/80">
              <span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Devices</span>
              <span className="text-base font-extrabold text-white">{section.device_count}</span>
            </div>
            <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800/80">
              <span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Occupancy</span>
              <span className="text-base font-extrabold text-white">{densityPercent}%</span>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between text-[0.68rem] text-slate-400">
            <span>Last Telemetry</span>
            <span className="font-semibold text-slate-300">{relativeTime(section.updated_at)}</span>
          </div>

          <Link
            href={`/ops/3d?section=${section.section_number}`}
            className="flex items-center justify-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-600/25 px-3 py-1.5 text-xs font-bold text-indigo-300 transition-all hover:bg-indigo-600/40 hover:text-white hover:border-indigo-400 shadow-md shadow-indigo-950/40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            Inspect Section in 3D
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Section Grid Container ───────────────────────────────────────────────────

function SectionGrid({
  sections,
  dataLoading,
  tierFilter,
  searchQuery,
}: {
  sections: CongestionRow[];
  dataLoading: boolean;
  tierFilter: 'all' | 'lower' | 'upper' | 'high';
  searchQuery: string;
}) {
  const filteredSections = useMemo(() => {
    let result = sections;

    if (tierFilter === 'lower') {
      result = result.filter((s) => s.tier.toLowerCase().includes('lower'));
    } else if (tierFilter === 'upper') {
      result = result.filter((s) => !s.tier.toLowerCase().includes('lower'));
    } else if (tierFilter === 'high') {
      result = result.filter((s) => s.level === 'high');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((s) => s.section_number.toLowerCase().includes(q) || s.tier.toLowerCase().includes(q));
    }

    return result;
  }, [sections, tierFilter, searchQuery]);

  const lowerTier = useMemo(
    () => filteredSections.filter((s) => s.tier.toLowerCase().includes('lower')),
    [filteredSections],
  );

  const upperTier = useMemo(
    () => filteredSections.filter((s) => !s.tier.toLowerCase().includes('lower')),
    [filteredSections],
  );

  if (dataLoading) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 text-sm text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="font-medium">Connecting to live stadium telemetry...</span>
        </div>
      </div>
    );
  }

  if (filteredSections.length === 0) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center text-slate-400">
        <div>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-slate-600">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="m-0 text-sm font-semibold text-slate-300">No sections match your filter criteria</p>
          <p className="m-0 mt-1 text-xs text-slate-500">Try adjusting your search query or selecting a different tier filter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {lowerTier.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              Lower Tier
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[0.65rem] font-bold text-slate-400 border border-slate-700">
                {lowerTier.length} sections
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {lowerTier.map((s) => (
              <SectionCard key={s.section_id} section={s} />
            ))}
          </div>
        </div>
      )}

      {upperTier.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              Upper Tier
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[0.65rem] font-bold text-slate-400 border border-slate-700">
                {upperTier.length} sections
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {upperTier.map((s) => (
              <SectionCard key={s.section_id} section={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

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
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const [tierFilter, setTierFilter] = useState<'all' | 'lower' | 'upper' | 'high'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  function toggleExpand(key: string) {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const fetchDashboardData = useCallback(async () => {
    setDataLoading(true);
    setError(null);

    try {
      const [congestionResponse, alertsResponse] = await Promise.all([
        safeFetchApi('/congestion', { cache: 'no-store' }),
        safeFetchApi('/alerts', { cache: 'no-store' }),
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
      const response = await safeFetchApi(endpoint, { method: 'POST' });

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

  async function handleResolveGroup(groupKey: string) {
    const group = alertGroups.find((g) => g.key === groupKey);
    if (!group) return;

    const idsToRemove = new Set([group.top, ...group.rest].map((a) => a.id));
    const prevAlerts = alerts;
    setAlerts((prev) => prev.filter((a) => !idsToRemove.has(a.id)));

    try {
      if (group.top.section_id) {
        await safeFetchApi(
          `/alerts/resolve-by-section/${group.top.section_id}`,
          { method: 'POST' },
        );
      } else {
        await Promise.all(
          [group.top, ...group.rest].map((a) =>
            safeFetchApi(`/alerts/${a.id}/resolve`, { method: 'PATCH' }),
          ),
        );
      }
    } catch {
      setAlerts(prevAlerts);
    }
  }

  const alertGroups = useMemo(() => {
    const groups = new Map<string, AlertRow[]>();
    for (const alert of alerts) {
      const key = alert.section_id ?? `__no_section_${alert.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(alert);
    }
    return Array.from(groups.entries())
      .map(([key, items]) => {
        const sorted = items.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const section = sorted[0].section_id
          ? sections.find((s) => s.section_id === sorted[0].section_id)
          : undefined;
        return {
          key,
          top: sorted[0],
          rest: sorted.slice(1),
          sectionNumber: section?.section_number,
          tier: section?.tier ?? '',
          deviceCount: section?.device_count ?? 0,
        };
      })
      .sort((a, b) => {
        if (b.deviceCount !== a.deviceCount) return b.deviceCount - a.deviceCount;
        return new Date(b.top.created_at).getTime() - new Date(a.top.created_at).getTime();
      });
  }, [alerts, sections]);

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
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 font-sans" suppressHydrationWarning>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm font-medium">Loading ops control center...</span>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200"
      suppressHydrationWarning
    >
      <style>{`
        @keyframes opsCardHighPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(244, 63, 94, 0.25), 0 0 0 1px rgba(244, 63, 94, 0.4); }
          50%      { box-shadow: 0 0 28px rgba(244, 63, 94, 0.5), 0 0 0 1px rgba(244, 63, 94, 0.8); }
        }
        .ops-card-high {
          animation: opsCardHighPulse 2s ease-in-out infinite;
        }

        @keyframes opsAlertFlash {
          0% { background: rgba(251, 191, 36, 0.25); border-color: rgba(251, 191, 36, 0.6); }
          100% { background: rgba(15, 23, 42, 0.7); border-color: rgba(51, 65, 85, 0.6); }
        }

        .ops-alert-flash {
          animation: opsAlertFlash 2.6s ease-out both;
        }

        .ops-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .ops-scrollbar::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl px-4 py-3.5 sm:px-6 lg:px-8 shadow-lg shadow-black/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <StadiumLogo />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="m-0 text-lg font-black text-white tracking-tight">StadiumSetu Ops</h1>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[0.62rem] font-extrabold text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  LIVE TELEMETRY
                </span>
              </div>
              <p className="m-0 text-xs text-slate-400">Executive congestion & incident response center</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-slate-400 font-medium">
              Updated <span className="text-slate-200 font-semibold">{latestUpdate}</span>
            </span>
            <Link
              href="/"
              className="rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            >
              &larr; Back to Home
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 font-semibold text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 hover:text-rose-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm shadow-2xl shadow-black/50">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-5">
              <div>
                <h2 className="m-0 text-lg font-extrabold text-white tracking-tight">Section Heatmap</h2>
                <p className="m-0 mt-0.5 text-xs text-slate-400">Live device density & capacity utilization across seating tiers</p>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/15 to-emerald-950/20 px-3.5 py-2 text-center min-w-[76px]">
                  <span className="block text-xl font-black text-emerald-400 leading-none">{statusCounts.low}</span>
                  <span className="text-[0.62rem] font-bold uppercase tracking-wider text-emerald-300/80">Low</span>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/15 to-amber-950/20 px-3.5 py-2 text-center min-w-[76px]">
                  <span className="block text-xl font-black text-amber-400 leading-none">{statusCounts.medium}</span>
                  <span className="text-[0.62rem] font-bold uppercase tracking-wider text-amber-300/80">Medium</span>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-gradient-to-b from-rose-500/15 to-rose-950/20 px-3.5 py-2 text-center min-w-[76px]">
                  <span className="block text-xl font-black text-rose-400 leading-none">{statusCounts.high}</span>
                  <span className="text-[0.62rem] font-bold uppercase tracking-wider text-rose-300/80">High</span>
                </div>
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-950/80 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTierFilter('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tierFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  All Tiers
                </button>
                <button
                  type="button"
                  onClick={() => setTierFilter('lower')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tierFilter === 'lower'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Lower Tier
                </button>
                <button
                  type="button"
                  onClick={() => setTierFilter('upper')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tierFilter === 'upper'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  Upper Tier
                </button>
                <button
                  type="button"
                  onClick={() => setTierFilter('high')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tierFilter === 'high'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                    : 'text-rose-400 hover:text-rose-300'
                    }`}
                >
                  High Risk ({statusCounts.high})
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter section (e.g. L01)..."
                  className="w-full sm:w-56 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-1.5 pl-9 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-rose-400">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <SectionGrid
              sections={sections}
              dataLoading={dataLoading}
              tierFilter={tierFilter}
              searchQuery={searchQuery}
            />
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-950/80 p-4 shadow-2xl shadow-black/50">
              <div className="mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <h3 className="m-0 text-xs font-extrabold uppercase tracking-wider text-cyan-300">Demo Controls</h3>
                </div>
                <p className="m-0 mt-0.5 text-xs text-slate-400">Operator test tool for live crowd simulation</p>
              </div>

              <div className="grid gap-2.5">
                <button
                  type="button"
                  onClick={() => runDemoAction('spike')}
                  disabled={activeAction !== null}
                  className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-600/30 to-rose-700/20 px-4 py-2.5 text-xs font-extrabold text-rose-200 transition-all hover:border-rose-400 hover:bg-rose-600/40 hover:text-white hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-rose-950/60"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  {activeAction === 'spike' ? 'Simulating Spike...' : 'Simulate Crowd Spike'}
                </button>

                <button
                  type="button"
                  onClick={() => runDemoAction('reset')}
                  disabled={activeAction !== null}
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-600/10 px-4 py-2.5 text-xs font-extrabold text-emerald-300 transition-all hover:border-emerald-400 hover:bg-emerald-600/20 hover:text-emerald-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  {activeAction === 'reset' ? 'Resetting...' : 'Reset to Normal'}
                </button>
              </div>
            </section>

            <section className="flex max-h-[640px] flex-col rounded-2xl border border-slate-800 bg-slate-900/40 shadow-2xl shadow-black/50 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 p-4">
                <div>
                  <h2 className="m-0 text-base font-extrabold text-white tracking-tight">Recent Incidents</h2>
                  <p className="m-0 mt-0.5 text-xs text-slate-400">Live safety & congestion stream</p>
                </div>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[0.65rem] font-bold text-slate-300 border border-slate-700">
                  {alertGroups.length} Active
                </span>
              </div>

              <div className="ops-scrollbar flex-1 overflow-y-auto p-4 space-y-3">
                {dataLoading ? (
                  <div className="grid place-items-center py-12 text-xs text-slate-500">
                    Loading live incidents...
                  </div>
                ) : alertGroups.length ? (
                  alertGroups.map((group) => {
                    const totalCount = 1 + group.rest.length;
                    const isDupOpen = expandedGroups.includes(group.key);
                    const isHighSeverity = group.top.severity === 'high';
                    const isMediumSeverity = group.top.severity === 'medium';

                    const stripeColor = isHighSeverity ? 'bg-rose-500' : isMediumSeverity ? 'bg-amber-400' : 'bg-emerald-400';
                    const badgeStyle = isHighSeverity
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isMediumSeverity
                        ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                        : 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40';

                    return (
                      <div
                        key={group.key}
                        className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 transition-all duration-200 hover:border-slate-700 ${flashingAlertIds.includes(group.top.id) ? 'ops-alert-flash' : ''}`}
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripeColor}`} />

                        <div className="mb-2.5 flex items-start justify-between gap-2 pl-1.5">
                          <div>
                            <div className="flex items-center gap-2">
                              {group.sectionNumber ? (
                                <span className="text-sm font-extrabold text-white tracking-tight">Section {group.sectionNumber}</span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Unknown section</span>
                              )}
                              <span className={`rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-wider ${badgeStyle}`}>
                                {group.top.severity}
                              </span>
                            </div>
                            <p className="m-0 mt-0.5 text-[0.68rem] text-slate-400 font-medium">
                              {relativeTime(group.top.created_at)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleResolveGroup(group.key)}
                            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                            aria-label="Dismiss alert group"
                            title="Resolve incident"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 my-2.5 pl-1.5 text-xs">
                          <div className="rounded-lg bg-slate-900/90 p-2 border border-slate-800">
                            <span className="block text-[0.58rem] font-bold uppercase tracking-wider text-slate-400">Seating Tier</span>
                            <span className="font-extrabold text-white text-[0.75rem]">{group.tier || '—'}</span>
                          </div>
                          <div className="rounded-lg bg-slate-900/90 p-2 border border-slate-800">
                            <span className="block text-[0.58rem] font-bold uppercase tracking-wider text-slate-400">Active Devices</span>
                            <span className="font-extrabold text-white text-[0.75rem]">{group.deviceCount}</span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 pl-1.5">
                          {group.sectionNumber ? (
                            <Link
                              href={`/ops/3d?section=${group.sectionNumber}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 transition hover:text-indigo-300 hover:translate-x-0.5"
                            >
                              Inspect in 3D &rarr;
                            </Link>
                          ) : <span />}

                          <div className="flex items-center gap-2">
                            {totalCount > 1 && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(group.key)}
                                className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[0.65rem] font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition"
                              >
                                {totalCount} events
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                                  className={`transition-transform duration-200 ${isDupOpen ? 'rotate-180' : ''}`}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleResolveGroup(group.key)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300 transition hover:border-emerald-500/60 hover:bg-emerald-500/20 hover:text-emerald-200"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Resolve
                            </button>
                          </div>
                        </div>

                        {isDupOpen && group.rest.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-2.5 pl-1.5">
                            {group.rest.map((alert) => (
                              <div key={alert.id} className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/60">
                                <div className="flex items-center justify-between text-[0.65rem]">
                                  <span className="text-slate-400 font-semibold">{relativeTime(alert.created_at)}</span>
                                  <span className="uppercase text-[0.58rem] font-extrabold text-slate-400">{alert.severity}</span>
                                </div>
                                <p className="m-0 mt-1 text-[0.7rem] text-slate-300 leading-snug">{alert.message}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="grid place-items-center py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 text-slate-600">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span className="font-medium">All clear — No active congestion incidents</span>
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
