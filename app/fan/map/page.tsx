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
    <div style={styles.root} className="map-root">
      <style>{`
        @media (max-width: 768px) {
          .map-root {
            flex-direction: column !important;
            height: 100dvh !important;
          }
          .map-panel {
            width: 100% !important;
            min-width: 100% !important;
            padding: 0.75rem 1rem !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            max-height: 180px !important;
            flex-shrink: 0 !important;
          }
          .map-header {
            display: none !important;
          }
          .map-top-nav {
            margin-bottom: 0.5rem !important;
          }
          .map-amenity-grid {
            display: flex !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            gap: 0.4rem !important;
            padding-bottom: 0.25rem !important;
            scrollbar-width: none !important;
          }
          .map-amenity-card {
            flex-shrink: 0 !important;
            padding: 0.35rem 0.6rem !important;
          }
          .map-wrapper {
            flex: 1 !important;
            min-height: 0 !important;
          }
        }
      `}</style>

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div style={styles.panel} className="map-panel">
        {/* Top nav */}
        <div style={styles.topNav} className="map-top-nav">
          <Link href="/fan/3d" style={styles.backButton}>
            ← 3D View
          </Link>
          <Link href="/fan" style={styles.askAiButton}>
            ✨ Ask AI
          </Link>
        </div>

        {/* Header */}
        <div style={styles.header} className="map-header">
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
            <div style={styles.titleGroup}>
              <h3 style={styles.amenityTitle}>Facilities</h3>
              <span style={styles.countBadge}>
                {activeAmenities.size}/{ALL_TYPES.length}
              </span>
            </div>
            <button onClick={toggleAll} style={styles.amenityToggleAll}>
              {activeAmenities.size > 0 ? 'Hide All' : 'Show All'}
            </button>
          </div>
          <div style={styles.amenityGrid} className="map-amenity-grid">
            {ALL_TYPES.map((type) => {
              const isActive = activeAmenities.has(type);
              const isHighlighted = highlightedType === type;
              const themeColor = AMENITY_TYPE_COLORS[type];

              return (
                <div
                  key={type}
                  onClick={() => toggleAmenity(type)}
                  onMouseEnter={() => setHighlightedType(type)}
                  onMouseLeave={() => setHighlightedType(null)}
                  className="map-amenity-card"
                  style={{
                    ...styles.amenityCard,
                    background: isActive
                      ? `linear-gradient(90deg, ${themeColor}1a 0%, rgba(255,255,255,0.03) 100%)`
                      : isHighlighted
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(255,255,255,0.02)',
                    borderColor: isActive
                      ? `${themeColor}55`
                      : isHighlighted
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(255,255,255,0.06)',
                    boxShadow: isActive
                      ? `0 2px 10px ${themeColor}18`
                      : 'none',
                    transform: isHighlighted ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <div
                    style={{
                      ...styles.iconContainer,
                      background: isActive
                        ? `${themeColor}28`
                        : 'rgba(255,255,255,0.05)',
                      borderColor: isActive
                        ? `${themeColor}66`
                        : 'rgba(255,255,255,0.08)',
                      boxShadow: isActive
                        ? `0 0 8px ${themeColor}44`
                        : 'none',
                    }}
                  >
                    <span style={styles.iconSymbol}>{AMENITY_ICONS[type]}</span>
                  </div>

                  <span
                    style={{
                      ...styles.amenityLabel,
                      color: isActive ? '#f8fafc' : '#64748b',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    {AMENITY_TYPE_LABELS[type]}
                  </span>

                  {/* Custom Toggle Switch */}
                  <div
                    style={{
                      ...styles.toggleSwitch,
                      background: isActive
                        ? themeColor
                        : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <div
                      style={{
                        ...styles.toggleKnob,
                        transform: isActive
                          ? 'translateX(14px)'
                          : 'translateX(2px)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {activeAmenities.size === 0 && (
            <p style={styles.hintText}>
              Toggle facilities above to see their locations on the map
            </p>
          )}
        </div>

      </div>

      {/* ── Map area ────────────────────────────────────────────────────── */}
      <div style={styles.mapWrapper} className="map-wrapper">
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
    marginBottom: '1.5rem',
  },
  amenityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.85rem',
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  amenityTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#f8fafc',
    margin: 0,
    letterSpacing: '0.02em',
  },
  countBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '0.1rem 0.45rem',
    borderRadius: '12px',
    background: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    border: '1px solid rgba(99, 102, 241, 0.3)',
  },
  amenityToggleAll: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: '#94a3b8',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.25rem 0.65rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  amenityGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  amenityCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    cursor: 'pointer',
    padding: '0.55rem 0.75rem',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    transition: 'all 0.2s ease',
    userSelect: 'none' as const,
  },
  iconContainer: {
    width: '28px',
    height: '28px',
    borderRadius: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  iconSymbol: {
    fontSize: '0.95rem',
    lineHeight: 1,
  },
  amenityLabel: {
    fontSize: '0.78rem',
    flex: 1,
    lineHeight: 1.3,
    transition: 'color 0.2s ease',
  },
  toggleSwitch: {
    width: '28px',
    height: '16px',
    borderRadius: '10px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    transition: 'background-color 0.2s ease',
  },
  toggleKnob: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.2s ease',
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
    padding: '0.75rem 1.5rem',
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
