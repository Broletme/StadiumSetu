'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

// ─── Dynamic import (ssr: false) for the R3F Canvas ─────────────────────────
const StadiumScene = dynamic(() => import('./StadiumScene'), {
  ssr: false,
  loading: () => (
    <div style={styles.canvasPlaceholder}>
      <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
        Loading 3D scene…
      </p>
    </div>
  ),
});

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

// ─── Page component ───────────────────────────────────────────────────────────

export default function Fan3DPage() {
  const [sectionQuery, setSectionQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchResult, setSearchResult] = useState<Zone | null>(null);

  // Tracks known gates so we can render all gate markers even before a search
  // (starts empty; populated after first successful query)
  const [knownGates, setKnownGates] = useState<Gate[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionQuery.trim()) return;

    setSearchLoading(true);
    setSearchError(false);
    setSearchResult(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/zones/seat/${encodeURIComponent(sectionQuery.trim())}`,
      );
      if (!res.ok) throw new Error('Not found');

      const data: Zone = await res.json();
      setSearchResult(data);

      // Accumulate unique gates so the markers persist across queries
      if (data.gate) {
        setKnownGates((prev) => {
          const exists = prev.some((g) => g.id === data.gate.id);
          return exists ? prev : [...prev, data.gate];
        });
      }
    } catch {
      setSearchError(true);
    } finally {
      setSearchLoading(false);
    }
  };

  // Deduplicated gate list for the scene
  const uniqueGates = useMemo(() => knownGates, [knownGates]);

  return (
    <div style={styles.root}>
      {/* ── Left panel (form + info card) ─────────────────────────────────── */}
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#dg1)" />
              <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.15)" />
              <defs>
                <linearGradient id="dg1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>3D Seat Finder</h1>
            <p style={styles.subtitle}>Visualise your section in the stadium bowl</p>
          </div>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} style={styles.form}>
          <input
            type="text"
            value={sectionQuery}
            onChange={(e) => setSectionQuery(e.target.value)}
            placeholder="Enter section number, e.g. L01"
            style={styles.input}
          />
          <button type="submit" disabled={searchLoading} style={styles.submitButton}>
            {searchLoading ? 'Searching…' : 'Find My Seat'}
          </button>
        </form>

        {/* Error state */}
        {searchError && (
          <div style={styles.errorContainer}>
            <p style={styles.errorText}>
              We couldn't find that section — check the number and try again
            </p>
          </div>
        )}

        {/* Result info card */}
        {searchResult && (
          <div style={styles.resultCard}>
            <div style={styles.resultBadge}>
              <span style={styles.resultBadgeText}>✓ Section found</span>
            </div>
            <h2 style={styles.resultTitle}>Section {searchResult.section_number}</h2>
            <div style={styles.resultDetails}>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Tier</span>
                <span style={styles.detailValue}>{searchResult.tier}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Nearest Gate</span>
                <span style={styles.detailValue}>
                  {searchResult.gate?.name || 'Unknown'}
                </span>
              </div>
            </div>
            <p style={styles.hint}>
              🟢 Your section is highlighted in green. The animated path leads you to the gate.
            </p>
          </div>
        )}

        {/* Legend */}
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <span style={{ ...styles.dot, background: '#4f46e5' }} />
            <span>Lower Tier</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.dot, background: '#7c3aed' }} />
            <span>Upper Tier</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.dot, background: '#4ade80' }} />
            <span>Your section</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.dot, background: '#f59e0b' }} />
            <span>Gate</span>
          </div>
        </div>
      </div>

      {/* ── 3-D canvas area ───────────────────────────────────────────────── */}
      <div style={styles.canvasWrapper}>
        <StadiumScene zone={searchResult} uniqueGates={uniqueGates} />

        {/* Drag hint */}
        <p style={styles.dragHint}>Drag to rotate · Scroll to zoom</p>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'row',
    background: '#0a0a0f',
    backgroundImage:
      'radial-gradient(ellipse 80% 60% at 20% -10%, rgba(99,102,241,0.18) 0%, transparent 65%)',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#f1f5f9',
  },

  // ── Left panel ─────────────────────────────────────────────────────────────
  panel: {
    width: '360px',
    minWidth: '320px',
    flexShrink: 0,
    padding: '2rem 1.75rem',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    overflowY: 'auto',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  },
  logo: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '14px',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 0.2rem',
  },
  subtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: 0,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
    marginBottom: '1.25rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#f1f5f9',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  submitButton: {
    width: '100%',
    padding: '0.75rem 1.5rem',
    background: '#6366f1',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },

  errorContainer: {
    padding: '0.75rem 1rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    marginBottom: '1.25rem',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: '0.85rem',
    margin: 0,
    textAlign: 'center',
  },

  resultCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '14px',
    padding: '1.25rem',
    marginBottom: '1.25rem',
  },
  resultBadge: {
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    background: 'rgba(74,222,128,0.12)',
    border: '1px solid rgba(74,222,128,0.3)',
    borderRadius: '20px',
    marginBottom: '0.75rem',
  },
  resultBadgeText: {
    color: '#4ade80',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  resultTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 0.875rem',
  },
  resultDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    marginBottom: '0.875rem',
  },
  detailItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '0.6rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: '0.85rem',
  },
  detailValue: {
    color: '#f8fafc',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  hint: {
    color: '#64748b',
    fontSize: '0.78rem',
    margin: 0,
    lineHeight: 1.5,
  },

  legend: {
    marginTop: 'auto',
    paddingTop: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#64748b',
    fontSize: '0.8rem',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },

  // ── Canvas ─────────────────────────────────────────────────────────────────
  canvasWrapper: {
    flex: 1,
    position: 'relative',
    minHeight: '100vh',
  },
  canvasPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHint: {
    position: 'absolute',
    bottom: '1.25rem',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(148,163,184,0.6)',
    fontSize: '0.78rem',
    pointerEvents: 'none',
    margin: 0,
    whiteSpace: 'nowrap',
  },
};
