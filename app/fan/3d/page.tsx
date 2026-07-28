'use client';

import { useState, useMemo, useEffect, Suspense, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  type AmenityType,
  AMENITY_TYPE_COLORS,
  AMENITY_TYPE_LABELS,
  AMENITY_ICONS,
} from '@/lib/stadiumGeometry';

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

function Fan3DContent() {
  const [sectionQuery, setSectionQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchResult, setSearchResult] = useState<Zone | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Tracks known gates so we can render all gate markers even before a search
  // (starts empty; populated after first successful query)
  const [knownGates, setKnownGates] = useState<Gate[]>([]);

  // ── Amenity type visibility toggles ──────────────────────────────────────
  const [activeAmenities, setActiveAmenities] = useState<Set<AmenityType>>(new Set());
  const toggleAmenity = useCallback((type: AmenityType) => {
    setActiveAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);
  const [highlightedAmenityType, setHighlightedAmenityType] = useState<AmenityType | null>(null);

  const searchParams = useSearchParams();
  const initialSection = searchParams.get('section');
  const hasLoadedInitial = useRef(false);

  // Check localStorage for onboarding guide on mount
  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem('stadiumsetu_fan_3d_guide_seen');
      if (!hasSeen) {
        setShowGuide(true);
      }
    } catch {
      setShowGuide(true);
    }
  }, []);

  const closeGuide = (savePreference = false) => {
    setShowGuide(false);
    if (savePreference || dontShowAgain) {
      try {
        localStorage.setItem('stadiumsetu_fan_3d_guide_seen', 'true');
      } catch (e) {
        console.error('Could not save onboarding preference', e);
      }
    }
  };

  const executeSearch = async (query: string) => {
    if (!query.trim()) return;

    setSearchLoading(true);
    setSearchError(false);
    setSearchResult(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/zones/seat/${encodeURIComponent(query.trim())}`,
      );
      if (!res.ok) throw new Error('Not found');

      const data: Zone = await res.json();
      setSearchResult(data);
      setSectionQuery(query.trim());

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

  useEffect(() => {
    if (initialSection && !hasLoadedInitial.current) {
      hasLoadedInitial.current = true;
      setSectionQuery(initialSection);
      executeSearch(initialSection);
    }
  }, [initialSection]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(sectionQuery);
  };

  // Deduplicated gate list for the scene
  const uniqueGates = useMemo(() => knownGates, [knownGates]);

  return (
    <div style={styles.root}>
      {/* ── Left panel (form + info card) ─────────────────────────────────── */}
      <div style={styles.panel}>
        <div style={styles.topNav}>
          <Link href="/dashboard" style={styles.backButton}>
            ← Dashboard
          </Link>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Link href="/fan/map" style={styles.map2dButton}>
              🗺 Map
            </Link>
            <button
              onClick={() => setShowGuide(true)}
              style={styles.guideTriggerButton}
              title="How to use 3D finder"
            >
              ℹ️ Guide
            </button>
            <Link href="/fan" style={styles.askAiButton}>
              ✨ Ask AI
            </Link>
          </div>
        </div>
        
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

        {/* ── Stadium Amenities Toggles ──────────────────────────────────── */}
        <div style={styles.amenitySection}>
          <div style={styles.amenityHeader}>
            <h3 style={styles.amenityTitle}>Stadium Amenities</h3>
            <button
              onClick={() => {
                setActiveAmenities((prev) =>
                  prev.size > 0 ? new Set() : new Set<AmenityType>(['restroom', 'food', 'merchandise', 'firstaid', 'elevator', 'exit']),
                );
              }}
              style={styles.amenityToggleAll}
            >
              {activeAmenities.size > 0 ? 'Hide All' : 'Show All'}
            </button>
          </div>
          <div style={styles.amenityGrid}>
            {(
              [
                'restroom',
                'food',
                'merchandise',
                'firstaid',
                'elevator',
                'exit',
              ] as AmenityType[]
            ).map((type) => {
              const isHighlighted = highlightedAmenityType === type;
              return (
                <label
                  key={type}
                  style={{
                    ...styles.amenityItem,
                    background: isHighlighted
                      ? 'rgba(255,255,255,0.06)'
                      : 'transparent',
                  }}
                  onMouseEnter={() => setHighlightedAmenityType(type)}
                  onMouseLeave={() => setHighlightedAmenityType(null)}
                >
                  <input
                    type="checkbox"
                    checked={activeAmenities.has(type)}
                    onChange={() => toggleAmenity(type)}
                    style={styles.amenityCheckbox}
                  />
                  <span
                    style={{
                      ...styles.amenityDot,
                      background: AMENITY_TYPE_COLORS[type],
                      boxShadow: activeAmenities.has(type) || isHighlighted
                        ? `0 0 6px ${AMENITY_TYPE_COLORS[type]}66`
                        : 'none',
                    }}
                  />
                  <span
                    style={{
                      ...styles.amenityLabel,
                      color: isHighlighted ? '#f1f5f9' : undefined,
                    }}
                  >
                    {AMENITY_ICONS[type]}{' '}
                    {AMENITY_TYPE_LABELS[type]}
                  </span>
                </label>
              );
            })}
          </div>
          {activeAmenities.size === 0 && (
            <p style={styles.amenityHint}>
              Toggle amenities above to see their locations in the 3D stadium
            </p>
          )}
        </div>

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
        {/* Stadium name overlay (HTML, not 3D) */}
        <div style={styles.stadiumName}>
          <span style={styles.stadiumNameText}>StadiumSetu Arena</span>
        </div>

        <StadiumScene
          zone={searchResult}
          uniqueGates={uniqueGates}
          activeAmenities={activeAmenities}
        />

        {/* Drag hint */}
        <p style={styles.dragHint}>Drag to rotate · Scroll to zoom</p>
      </div>

      {/* ── Onboarding / Information Modal ───────────────────────────────── */}
      {showGuide && (
        <div style={styles.modalOverlay} onClick={() => closeGuide(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              style={styles.modalCloseBtn}
              onClick={() => closeGuide(false)}
              aria-label="Close guide"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalBadge}>
                <span>🏟️ FIFA World Cup 2026</span>
              </div>
              <h2 style={styles.modalTitle}>3D Stadium Seat Finder Guide</h2>
              <p style={styles.modalSubtitle}>
                Interactively locate your seating section, view entrance gates, and navigate the stadium in 3D.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div style={styles.guideGrid}>
              <div style={styles.guideCard}>
                <div style={styles.guideCardIcon}>🔍</div>
                <div>
                  <h3 style={styles.guideCardTitle}>1. Search Your Section</h3>
                  <p style={styles.guideCardText}>
                    Type your section number (e.g. <b>L01</b>, <b>U06</b>, <b>210</b>) in the search box on the left panel to locate it.
                  </p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideCardIcon}>🟢</div>
                <div>
                  <h3 style={styles.guideCardTitle}>2. View Your Gate & Path</h3>
                  <p style={styles.guideCardText}>
                    Your section will highlight in green, with an animated guide line pointing directly to your nearest entrance gate.
                  </p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideCardIcon}>🎮</div>
                <div>
                  <h3 style={styles.guideCardTitle}>3. Interactive 3D Controls</h3>
                  <p style={styles.guideCardText}>
                    <b>Rotate:</b> Left-click & drag anywhere on the 3D view.<br />
                    <b>Zoom:</b> Scroll mouse wheel up or down.<br />
                    <b>Pan:</b> Right-click & drag.
                  </p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideCardIcon}>✨</div>
                <div>
                  <h3 style={styles.guideCardTitle}>4. Smart AI Integration</h3>
                  <p style={styles.guideCardText}>
                    Click <b>✨ Ask AI</b> anytime to chat naturally with your stadium assistant and get automatic 3D directions!
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={styles.modalFooter}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  style={styles.checkboxInput}
                />
                <span style={styles.checkboxText}>Don't show this again</span>
              </label>

              <button
                onClick={() => closeGuide(true)}
                style={styles.modalActionBtn}
              >
                Start Exploring 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Fan3DPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.root}>
          <div style={styles.panel}>
            <p style={{ color: '#64748b' }}>Loading 3D Finder...</p>
          </div>
        </div>
      }
    >
      <Fan3DContent />
    </Suspense>
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
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  topNav: {
    marginBottom: '1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    display: 'inline-block',
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 500,
    padding: '0.4rem 0.8rem',
    background: 'rgba(0,0,0,0.65)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  askAiButton: {
    display: 'inline-block',
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: '0.4rem 0.8rem',
    background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
    border: '1px solid rgba(99,102,241,0.5)',
    borderRadius: '8px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
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
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.45)',
    borderRadius: '10px',
    color: '#e0e7ff',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
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

  // ── Amenity toggles ───────────────────────────────────────────────────────
  amenitySection: {
    paddingTop: '1.25rem',
    marginTop: '0.5rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  amenityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  amenityTitle: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#e2e8f0',
    margin: 0,
    letterSpacing: '0.02em',
  },
  amenityToggleAll: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#94a3b8',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.2rem 0.6rem',
    cursor: 'pointer',
  },
  amenityGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  amenityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    cursor: 'pointer',
    padding: '0.25rem 0.35rem',
    borderRadius: '6px',
    transition: 'background 0.15s',
    userSelect: 'none' as const,
  },
  amenityCheckbox: {
    accentColor: '#6366f1',
    cursor: 'pointer',
    width: '13px',
    height: '13px',
    flexShrink: 0,
  },
  amenityDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
    transition: 'box-shadow 0.2s',
  },
  amenityLabel: {
    color: '#94a3b8',
    fontSize: '0.78rem',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  amenityHint: {
    color: '#64748b',
    fontSize: '0.72rem',
    margin: '0.6rem 0 0',
    fontStyle: 'italic',
    lineHeight: 1.4,
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

  // ── Stadium name overlay ─────────────────────────────────────────────────────
  stadiumName: {
    position: 'absolute',
    top: '1.25rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  stadiumNameText: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: '1.05rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(241, 245, 249, 0.55)',
    textShadow: '0 1px 8px rgba(99, 102, 241, 0.25)',
  },

  map2dButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    color: '#a5b4fc',
    textDecoration: 'none',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '8px',
    padding: '0.4rem 0.65rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  guideTriggerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    color: '#cbd5e1',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    padding: '0.4rem 0.65rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // ── Modal Styles ────────────────────────────────────────────────────────────
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    background: 'rgba(5, 8, 16, 0.75)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    animation: 'fan-fadeSlideUp 0.25s ease both',
  },
  modalContent: {
    position: 'relative',
    width: '100%',
    maxWidth: '560px',
    background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '20px',
    boxShadow:
      '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: '1.25rem',
    right: '1.25rem',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#94a3b8',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  modalHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  modalBadge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    padding: '0.25rem 0.65rem',
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.35)',
    borderRadius: '20px',
    color: '#a5b4fc',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  modalTitle: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#f8fafc',
    margin: '0.2rem 0 0',
    letterSpacing: '-0.01em',
  },
  modalSubtitle: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.5,
  },
  guideGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '0.875rem',
  },
  guideCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '12px',
    padding: '0.9rem 1rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  guideCardIcon: {
    fontSize: '1.25rem',
    lineHeight: 1,
    flexShrink: 0,
    marginTop: '0.1rem',
  },
  guideCardTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#e2e8f0',
    margin: '0 0 0.25rem',
  },
  guideCardText: {
    fontSize: '0.78rem',
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.45,
  },
  modalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkboxInput: {
    accentColor: '#6366f1',
    cursor: 'pointer',
    width: '15px',
    height: '15px',
  },
  checkboxText: {
    fontSize: '0.82rem',
    color: '#94a3b8',
  },
  modalActionBtn: {
    padding: '0.65rem 1.4rem',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    border: '1px solid rgba(99, 102, 241, 0.5)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
    transition: 'transform 0.15s, background 0.2s',
  },
};
