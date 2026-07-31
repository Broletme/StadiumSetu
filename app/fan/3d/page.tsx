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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <div style={styles.spinner} />
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0, fontWeight: 500 }}>
          Initializing 3D Stadium Environment...
        </p>
      </div>
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

const POPULAR_SECTIONS = ['L01', 'L05', 'U02', 'U11'];

const SHORT_AMENITY_LABELS: Record<AmenityType, string> = {
  restroom: 'Restrooms',
  food: 'Food & Drinks',
  merchandise: 'Merch Kiosks',
  firstaid: 'First Aid',
  elevator: 'Elevators',
  exit: 'Evacuation Exits',
};

// ─── Page component ───────────────────────────────────────────────────────────

function Fan3DContent() {
  const [sectionQuery, setSectionQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchResult, setSearchResult] = useState<Zone | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [cameraMode, setCameraMode] = useState<'default' | 'top' | 'pitch'>('default');

  // Tracks known gates so we can render all gate markers even before a search
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
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(
        `${baseUrl}/zones/seat/${encodeURIComponent(query.trim())}`,
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
    <div style={styles.root} className="fan3d-root">
      <style>{`
        @media (max-width: 768px) {
          .fan3d-root {
            flex-direction: column !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
          }
          .fan3d-panel {
            width: 100% !important;
            min-width: 100% !important;
            height: auto !important;
            max-height: 220px !important;
            padding: 0.75rem 1rem !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            flex-shrink: 0 !important;
          }
          .fan3d-canvas-wrapper {
            flex: 1 !important;
            height: 100% !important;
            min-height: 0 !important;
            position: relative !important;
          }
          .fan3d-camera-bar {
            bottom: 12px !important;
            right: 12px !important;
            top: auto !important;
            left: auto !important;
            transform: none !important;
            padding: 4px 8px !important;
            gap: 4px !important;
          }
          .fan3d-stadium-name {
            top: 10px !important;
            left: 10px !important;
          }
          .fan3d-drag-hint {
            display: none !important;
          }
          .fan3d-header {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Left Sidebar Panel ────────────────────────────────────────────── */}
      <div style={styles.panel} className="fan3d-panel ops-scrollbar">
        {/* Top Nav Pill Bar */}
        <div style={styles.topNav}>
          <Link href="/dashboard" style={styles.backButton}>
            &larr; Dashboard
          </Link>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <Link href="/fan/map" style={styles.map2dButton}>
              🗺 2D Map
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

        {/* Brand Header */}
        <div style={styles.header} className="fan3d-header">
          <div style={styles.logo}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#fanLogoGrad)" />
              <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.2)" />
              <defs>
                <linearGradient id="fanLogoGrad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a855f7" />
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
          <div style={styles.inputWrapper}>
            <input
              type="text"
              value={sectionQuery}
              onChange={(e) => setSectionQuery(e.target.value)}
              placeholder="Enter section number, e.g. L01"
              style={styles.input}
            />
            {sectionQuery && (
              <button
                type="button"
                onClick={() => {
                  setSectionQuery('');
                  setSearchResult(null);
                }}
                style={styles.clearInputBtn}
              >
                &times;
              </button>
            )}
          </div>

          {/* Quick presets */}
          <div style={styles.presetContainer}>
            <span style={styles.presetLabel}>Quick try:</span>
            {POPULAR_SECTIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  setSectionQuery(sec);
                  executeSearch(sec);
                }}
                style={{
                  ...styles.presetChip,
                  ...(sectionQuery === sec ? styles.presetChipActive : {}),
                }}
              >
                {sec}
              </button>
            ))}
          </div>

          <button type="submit" disabled={searchLoading} style={styles.submitButton}>
            {searchLoading ? 'Searching Section…' : 'Find My Seat 🚀'}
          </button>
        </form>

        {/* Error state */}
        {searchError && (
          <div style={styles.errorContainer}>
            <p style={styles.errorText}>
              We couldn't find section &quot;{sectionQuery}&quot; — check the section code (e.g. L01, U05) and try again.
            </p>
          </div>
        )}

        {/* Result info card */}
        {searchResult && (
          <div style={styles.resultCard}>
            <div style={styles.resultHeader}>
              <span style={styles.resultBadgeText}>✓ Section Found</span>
              <span style={styles.resultSectionNumber}>{searchResult.section_number}</span>
            </div>
            <div style={styles.resultDetails}>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Seating Tier</span>
                <span style={styles.detailValue}>{searchResult.tier}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Nearest Gate</span>
                <span style={styles.detailValueHighlight}>
                  {searchResult.gate?.name || 'Gate A'}
                </span>
              </div>
            </div>
            <p style={styles.hint}>
              🟢 Section <b>{searchResult.section_number}</b> is highlighted in green. Animated path guides you to <b>{searchResult.gate?.name || 'Gate A'}</b> (~2 min walk).
            </p>
          </div>
        )}

        {/* ── Stadium Amenities Toggles ──────────────────────────────────── */}
        <div style={styles.amenitySection}>
          <div style={styles.amenityHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem' }}>📍</span>
              <h3 style={styles.amenityTitle}>Stadium Amenities</h3>
            </div>
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
              const isChecked = activeAmenities.has(type);
              const color = AMENITY_TYPE_COLORS[type];

              return (
                <div
                  key={type}
                  onClick={() => toggleAmenity(type)}
                  onMouseEnter={() => setHighlightedAmenityType(type)}
                  onMouseLeave={() => setHighlightedAmenityType(null)}
                  style={{
                    ...styles.amenityCard,
                    background: isChecked
                      ? `linear-gradient(135deg, ${color}22 0%, rgba(15,23,42,0.85) 100%)`
                      : isHighlighted
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.03)',
                    borderColor: isChecked
                      ? `${color}66`
                      : isHighlighted
                        ? 'rgba(255,255,255,0.15)'
                        : 'rgba(255,255,255,0.07)',
                    boxShadow: isChecked
                      ? `0 4px 12px ${color}25`
                      : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        ...styles.amenityDot,
                        background: color,
                        boxShadow: isChecked ? `0 0 8px ${color}` : 'none',
                      }}
                    />
                    <span style={{ fontSize: '0.9rem', lineHeight: 1, flexShrink: 0 }}>{AMENITY_ICONS[type]}</span>
                    <span
                      style={{
                        ...styles.amenityLabel,
                        color: isChecked ? '#ffffff' : '#94a3b8',
                        fontWeight: isChecked ? 700 : 500,
                      }}
                    >
                      {SHORT_AMENITY_LABELS[type]}
                    </span>
                  </div>

                  {/* Custom Toggle Switch */}
                  <div
                    style={{
                      ...styles.switchTrack,
                      background: isChecked ? color : 'rgba(255,255,255,0.12)',
                    }}
                  >
                    <div
                      style={{
                        ...styles.switchThumb,
                        transform: isChecked ? 'translateX(10px)' : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {activeAmenities.size === 0 && (
            <p style={styles.amenityHint}>
              Toggle amenities above to show interactive 3D wayfinding markers.
            </p>
          )}
        </div>

        {/* ── Legend Section ────────────────────────────────────────────── */}
        <div style={styles.legendContainer}>
          <h4 style={styles.legendTitle}>Stadium Legend</h4>
          <div style={styles.legendGrid}>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, background: '#4f46e5' }} />
              <span>Lower Tier</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, background: '#7c3aed' }} />
              <span>Upper Tier</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
              <span>Your Section</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, background: '#f59e0b' }} />
              <span>Entrance Gate</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-D Canvas Area ───────────────────────────────────────────────── */}
      <div style={styles.canvasWrapper} className="fan3d-canvas-wrapper">
        {/* Stadium Title Overlay */}
        <div style={styles.stadiumName} className="fan3d-stadium-name">
          <div style={styles.stadiumBadge}>
            <span style={styles.stadiumLiveDot} />
            <span style={styles.stadiumNameText}>STADIUMSETU ARENA</span>
          </div>
        </div>

        {/* Camera View Mode Preset Bar Overlay */}
        <div style={styles.cameraControlsBar} className="fan3d-camera-bar">
          <button
            type="button"
            onClick={() => setCameraMode('default')}
            style={{
              ...styles.cameraBtn,
              ...(cameraMode === 'default' ? styles.cameraBtnActive : {}),
            }}
          >
            🏟️ Bowl View
          </button>
          <button
            type="button"
            onClick={() => setCameraMode('top')}
            style={{
              ...styles.cameraBtn,
              ...(cameraMode === 'top' ? styles.cameraBtnActive : {}),
            }}
          >
            🎥 Overhead
          </button>
          <button
            type="button"
            onClick={() => setCameraMode('pitch')}
            style={{
              ...styles.cameraBtn,
              ...(cameraMode === 'pitch' ? styles.cameraBtnActive : {}),
            }}
          >
            ⚽ Pitch View
          </button>
        </div>

        <StadiumScene
          zone={searchResult}
          uniqueGates={uniqueGates}
          activeAmenities={activeAmenities}
          cameraMode={cameraMode}
        />

        {/* Drag & Controls Overlay Hint */}
        <div style={styles.dragHintBox} className="fan3d-drag-hint">
          <span>🖱️ Drag to rotate &bull; Scroll to zoom &bull; Right-click to pan</span>
        </div>
      </div>

      {/* ── Onboarding / Guide Modal ───────────────────────────────── */}
      {showGuide && (
        <div style={styles.modalOverlay} onClick={() => closeGuide(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              style={styles.modalCloseBtn}
              onClick={() => closeGuide(false)}
              aria-label="Close guide"
            >
              ✕
            </button>

            <div style={styles.modalHeader}>
              <div style={styles.modalBadge}>
                <span>🏟️ Interactive 3D Stadium</span>
              </div>
              <h2 style={styles.modalTitle}>3D Stadium Seat Finder Guide</h2>
              <p style={styles.modalSubtitle}>
                Locate your section, explore gate paths, and find nearby stadium amenities in real-time 3D.
              </p>
            </div>

            <div style={styles.guideGrid}>
              <div style={styles.guideCard}>
                <div style={styles.guideCardIcon}>🔍</div>
                <div>
                  <h3 style={styles.guideCardTitle}>1. Search Your Section</h3>
                  <p style={styles.guideCardText}>
                    Type your section number (e.g. <b>L01</b>, <b>U06</b>) or click quick section presets to locate it instantly.
                  </p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideCardIcon}>🟢</div>
                <div>
                  <h3 style={styles.guideCardTitle}>2. View Your Gate & Path</h3>
                  <p style={styles.guideCardText}>
                    Your section highlights in green with an animated path directing you straight to your assigned entrance gate.
                  </p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideCardIcon}>🎮</div>
                <div>
                  <h3 style={styles.guideCardTitle}>3. 3D Stadium Navigation</h3>
                  <p style={styles.guideCardText}>
                    <b>Rotate:</b> Left-click & drag anywhere.<br />
                    <b>Zoom:</b> Scroll mouse wheel.<br />
                    <b>Pan:</b> Right-click & drag.
                  </p>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.guideCardIcon}>✨</div>
                <div>
                  <h3 style={styles.guideCardTitle}>4. Smart AI Assistant</h3>
                  <p style={styles.guideCardText}>
                    Click <b>✨ Ask AI</b> anytime to chat with your stadium assistant for personalized directions!
                  </p>
                </div>
              </div>
            </div>

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
            <p style={{ color: '#94a3b8' }}>Loading 3D Finder...</p>
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
    height: '100vh',
    maxHeight: '100vh',
    display: 'flex',
    flexDirection: 'row',
    background: '#0a0a0f',
    backgroundImage:
      'radial-gradient(ellipse 80% 60% at 20% -10%, rgba(99,102,241,0.15) 0%, transparent 70%)',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#f8fafc',
    overflow: 'hidden',
  },

  // ── Left Panel Sidebar ───────────────────────────────────────────────────────
  panel: {
    width: '380px',
    minWidth: '340px',
    flexShrink: 0,
    padding: '1.25rem 1.25rem 2rem',
    borderRight: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(16px)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    height: '100vh',
    maxHeight: '100vh',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  topNav: {
    marginBottom: '1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '0.4rem 0.75rem',
    background: 'rgba(255,255,255,0.04)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: '10px',
    transition: 'all 0.2s',
  },
  map2dButton: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#a5b4fc',
    textDecoration: 'none',
    background: 'rgba(99,102,241,0.12)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(99,102,241,0.3)',
    borderRadius: '10px',
    padding: '0.4rem 0.65rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  guideTriggerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#cbd5e1',
    background: 'rgba(255,255,255,0.06)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '0.4rem 0.65rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  askAiButton: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '0.8rem',
    fontWeight: 700,
    padding: '0.4rem 0.75rem',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(139,92,246,0.6)',
    borderRadius: '10px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    marginBottom: '1.25rem',
  },
  logo: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    background: 'rgba(99,102,241,0.15)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(99,102,241,0.3)',
    borderRadius: '14px',
    flexShrink: 0,
    boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#ffffff',
    margin: '0 0 0.15rem',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: '0.78rem',
    color: '#94a3b8',
    margin: 0,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    padding: '0.75rem 2.2rem 0.75rem 1rem',
    background: 'rgba(0,0,0,0.4)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  clearInputBtn: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: 0,
  },

  presetContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  presetLabel: {
    fontSize: '0.72rem',
    color: '#64748b',
    fontWeight: 600,
    marginRight: '0.2rem',
  },
  presetChip: {
    background: 'rgba(255,255,255,0.04)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: '#94a3b8',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.15rem 0.5rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  presetChipActive: {
    background: 'rgba(99,102,241,0.2)',
    borderColor: 'rgba(99,102,241,0.5)',
    color: '#a5b4fc',
  },

  submitButton: {
    width: '100%',
    padding: '0.75rem 1.25rem',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(79,70,229,0.35) 100%)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(99,102,241,0.6)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
  },

  errorContainer: {
    padding: '0.75rem 1rem',
    background: 'rgba(239,68,68,0.12)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: '12px',
    marginBottom: '1.25rem',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: '0.82rem',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.4,
  },

  resultCard: {
    background: 'linear-gradient(165deg, rgba(99,102,241,0.14) 0%, rgba(15,23,42,0.7) 100%)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(99,102,241,0.35)',
    borderRadius: '14px',
    padding: '1.1rem',
    marginBottom: '1.25rem',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  resultBadgeText: {
    color: '#4ade80',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: 'rgba(74,222,128,0.12)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(74,222,128,0.3)',
    borderRadius: '20px',
    padding: '0.2rem 0.6rem',
  },
  resultSectionNumber: {
    fontSize: '1.1rem',
    fontWeight: 900,
    color: '#ffffff',
  },
  resultDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  detailItem: {
    background: 'rgba(0,0,0,0.4)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: '10px',
    padding: '0.5rem 0.65rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
  },
  detailValue: {
    color: '#f8fafc',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  detailValueHighlight: {
    color: '#f59e0b',
    fontSize: '0.85rem',
    fontWeight: 700,
  },
  hint: {
    color: '#cbd5e1',
    fontSize: '0.78rem',
    margin: 0,
    lineHeight: 1.45,
  },

  // ── Amenity Toggles ───────────────────────────────────────────────────────
  amenitySection: {
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '1.25rem',
  },
  amenityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  amenityTitle: {
    fontSize: '0.82rem',
    fontWeight: 800,
    color: '#f1f5f9',
    margin: 0,
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
  },
  amenityToggleAll: {
    background: 'rgba(255,255,255,0.06)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: '#cbd5e1',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.2rem 0.55rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  amenityGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.45rem',
  },
  amenityCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.45rem 0.55rem',
    borderRadius: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    userSelect: 'none' as const,
  },
  switchTrack: {
    width: '24px',
    height: '14px',
    borderRadius: '10px',
    position: 'relative' as const,
    transition: 'background 0.2s',
    flexShrink: 0,
  },
  switchThumb: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#ffffff',
    position: 'absolute' as const,
    top: '2px',
    transition: 'transform 0.2s ease-in-out',
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },
  amenityDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
    transition: 'box-shadow 0.2s',
  },
  amenityLabel: {
    fontSize: '0.72rem',
    lineHeight: 1.2,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  },
  amenityHint: {
    color: '#64748b',
    fontSize: '0.72rem',
    margin: '0.6rem 0 0',
    fontStyle: 'italic',
    lineHeight: 1.4,
  },

  // ── Legend Container ─────────────────────────────────────────────────────
  legendContainer: {
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    marginTop: 'auto',
  },
  legendTitle: {
    fontSize: '0.75rem',
    fontWeight: 800,
    color: '#94a3b8',
    margin: '0 0 0.6rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  legendGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    color: '#cbd5e1',
    fontSize: '0.78rem',
    fontWeight: 500,
  },
  dot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },

  // ── Canvas Area ────────────────────────────────────────────────────────────
  canvasWrapper: {
    flex: 1,
    position: 'relative',
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    background: '#07090e',
  },
  canvasPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#07090e',
  },
  spinner: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    borderWidth: '3px',
    borderStyle: 'solid',
    borderColor: 'rgba(99,102,241,0.2)',
    borderTopColor: '#6366f1',
    animation: 'spin 1s linear infinite',
  },
  dragHintBox: {
    position: 'absolute',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(15, 23, 42, 0.75)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(12px)',
    borderRadius: '20px',
    padding: '0.4rem 1rem',
    color: '#cbd5e1',
    fontSize: '0.75rem',
    fontWeight: 600,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },

  // ── Stadium Name Overlay ───────────────────────────────────────────────────
  stadiumName: {
    position: 'absolute',
    top: '1.25rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  stadiumBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(15, 23, 42, 0.75)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(99, 102, 241, 0.3)',
    backdropFilter: 'blur(12px)',
    borderRadius: '20px',
    padding: '0.35rem 1rem',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  stadiumLiveDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 8px #22c55e',
  },
  stadiumNameText: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: '0.85rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: '#f8fafc',
  },

  // ── Camera Controls Bar Overlay ─────────────────────────────────────────────
  cameraControlsBar: {
    position: 'absolute',
    top: '1.25rem',
    right: '1.5rem',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    background: 'rgba(15, 23, 42, 0.75)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(12px)',
    borderRadius: '12px',
    padding: '0.3rem 0.4rem',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  cameraBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.3rem 0.65rem',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  cameraBtnActive: {
    background: 'rgba(99, 102, 241, 0.25)',
    color: '#ffffff',
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
  },

  // ── Modal Styles ────────────────────────────────────────────────────────────
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    background: 'rgba(5, 8, 16, 0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  },
  modalContent: {
    position: 'relative',
    width: '100%',
    maxWidth: '560px',
    background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 30, 0.99) 100%)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(99, 102, 241, 0.35)',
    borderRadius: '20px',
    boxShadow:
      '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.25)',
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
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.1)',
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
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(99, 102, 241, 0.35)',
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
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.07)',
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
