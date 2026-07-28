'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  type AmenityType,
  AMENITY_TYPE_COLORS,
  AMENITY_TYPE_LABELS,
  AMENITY_ICONS,
} from '@/lib/stadiumGeometry';

const StadiumMap2D = dynamic(
  () => import('@/components/StadiumMap2D'),
  { ssr: false },
);

const ALL_TYPES: AmenityType[] = [
  'restroom',
  'food',
  'merchandise',
  'firstaid',
  'elevator',
  'exit',
];

export default function FanMapPage() {
  const [activeAmenities, setActiveAmenities] = useState<Set<AmenityType>>(
    new Set(ALL_TYPES),
  );
  const [highlightedType, setHighlightedType] = useState<AmenityType | null>(
    null,
  );

  const toggleAmenity = useCallback((type: AmenityType) => {
    setActiveAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setActiveAmenities((prev) =>
      prev.size > 0 ? new Set() : new Set(ALL_TYPES),
    );
  }, []);

  return (
    <div style={styles.root}>
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div style={styles.panel}>
        {/* Top nav */}
        <div style={styles.topNav}>
          <Link href="/fan/3d" style={styles.backButton}>
            ← 3D View
          </Link>
          <Link href="/fan" style={styles.askAiButton}>
            ✨ Ask AI
          </Link>
        </div>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#dg2)" />
              <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.15)" />
              <defs>
                <linearGradient id="dg2" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>2D Stadium Map</h1>
            <p style={styles.subtitle}>
              Explore amenities & facilities
            </p>
          </div>
        </div>

        {/* Amenity toggles */}
        <div style={styles.amenitySection}>
          <div style={styles.amenityHeader}>
            <h3 style={styles.amenityTitle}>Facilities</h3>
            <button onClick={toggleAll} style={styles.amenityToggleAll}>
              {activeAmenities.size > 0 ? 'Hide All' : 'Show All'}
            </button>
          </div>
          <div style={styles.amenityGrid}>
            {ALL_TYPES.map((type) => {
              const isActive = activeAmenities.has(type);
              const isHighlighted = highlightedType === type;
              return (
                <label
                  key={type}
                  style={{
                    ...styles.amenityItem,
                    background: isHighlighted
                      ? 'rgba(255,255,255,0.06)'
                      : 'transparent',
                  }}
                  onMouseEnter={() => setHighlightedType(type)}
                  onMouseLeave={() => setHighlightedType(null)}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleAmenity(type)}
                    style={styles.amenityCheckbox}
                  />
                  <span
                    style={{
                      ...styles.amenityDot,
                      background: AMENITY_TYPE_COLORS[type],
                      boxShadow:
                        isActive || isHighlighted
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
                    {AMENITY_ICONS[type]} {AMENITY_TYPE_LABELS[type]}
                  </span>
                </label>
              );
            })}
          </div>
          {activeAmenities.size === 0 && (
            <p style={styles.hint}>
              Toggle facilities above to see their locations on the map
            </p>
          )}
        </div>

        {/* Map hint */}
        <div style={styles.hintBox}>
          <p style={styles.hintText}>
            Hover over any facility in the list to highlight it on the map
          </p>
        </div>

        {/* Legend */}
        <div style={styles.legend}>
          <div style={styles.legendTitle}>Map Legend</div>
          {ALL_TYPES.map((type) => (
            <div key={type} style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendDot,
                  background: AMENITY_TYPE_COLORS[type],
                }}
              />
              <span>{AMENITY_TYPE_LABELS[type]}</span>
            </div>
          ))}
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#f59e0b' }} />
            <span>Gate / Entrance</span>
          </div>
          <div style={styles.legendItem}>
            <span
              style={{
                ...styles.legendDot,
                background: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            />
            <span>Sections 1-24</span>
          </div>
        </div>

        {/* Section reference */}
        <div style={styles.sectionRef}>
          <span style={styles.sectionRefLabel}>Lower Tier</span>
          <span style={{ ...styles.sectionRefBadge, background: 'rgba(79,70,229,0.2)', color: '#818cf8' }}>
            L01-L24
          </span>
          <span style={styles.sectionRefLabel}>Upper Tier</span>
          <span style={{ ...styles.sectionRefBadge, background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>
            U01-U24
          </span>
        </div>
      </div>

      {/* ── Map area ────────────────────────────────────────────────────── */}
      <div style={styles.mapWrapper}>
        <div style={styles.mapTitle}>
          <span style={styles.mapTitleText}>StadiumSetu Arena — 2D Overview</span>
        </div>
        <div style={styles.mapContainer}>
          <StadiumMap2D
            activeAmenities={activeAmenities}
            highlightedType={highlightedType}
            onHover={setHighlightedType}
          />
        </div>
        <p style={styles.hint}>
          Hover over markers for details · Scroll to zoom · Drag to pan · {activeAmenities.size} facility type
          {activeAmenities.size !== 1 ? 's' : ''} shown
        </p>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'row',
    background: '#0a0a0f',
    backgroundImage:
      'radial-gradient(ellipse 80% 60% at 20% -10%, rgba(99,102,241,0.18) 0%, transparent 65%)',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#f1f5f9',
    overflow: 'hidden',
  },

  // ── Left panel ─────────────────────────────────────────────────────────────
  panel: {
    width: '340px',
    minWidth: '300px',
    flexShrink: 0,
    padding: '2rem 1.5rem',
    borderRight: '1px solid rgba(255,255,255,0.06)',
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

  // ── Amenity toggles ───────────────────────────────────────────────────────
  amenitySection: {
    marginBottom: '1rem',
  },
  amenityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  amenityTitle: {
    fontSize: '0.85rem',
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
    gap: '0.3rem',
  },
  amenityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    cursor: 'pointer',
    padding: '0.3rem 0.35rem',
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

  // ── Hint box ───────────────────────────────────────────────────────────────
  hintBox: {
    padding: '0.65rem 0.75rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    marginBottom: '1.25rem',
  },
  hintText: {
    color: '#64748b',
    fontSize: '0.75rem',
    margin: 0,
    lineHeight: 1.4,
    fontStyle: 'italic',
  },

  // ── Legend ─────────────────────────────────────────────────────────────────
  legend: {
    paddingTop: '1.25rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  legendTitle: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#e2e8f0',
    marginBottom: '0.2rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#64748b',
    fontSize: '0.75rem',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },

  // ── Section reference ─────────────────────────────────────────────────────
  sectionRef: {
    marginTop: 'auto',
    paddingTop: '1rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    alignItems: 'center',
  },
  sectionRefLabel: {
    color: '#64748b',
    fontSize: '0.72rem',
    fontWeight: 500,
  },
  sectionRefBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    marginRight: '0.3rem',
  },

  // ── Map area ───────────────────────────────────────────────────────────────
  mapWrapper: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  mapTitle: {
    position: 'absolute',
    top: '1.25rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
  },
  mapTitleText: {
    fontSize: '1.05rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(241, 245, 249, 0.55)',
    textShadow: '0 1px 8px rgba(99, 102, 241, 0.25)',
  },
  mapContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    bottom: '1.25rem',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(148,163,184,0.6)',
    fontSize: '0.78rem',
    pointerEvents: 'none' as const,
    margin: 0,
    whiteSpace: 'nowrap',
  },
};
