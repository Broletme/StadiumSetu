'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  // hover state for each clickable card
  const [hovered, setHovered] = useState<'seat' | '3d' | 'ops' | null>(null);

  useEffect(() => {
    // Guard: redirect to login if not authenticated
    supabase.auth.getSession().then((res: any) => {
      const session = res.data?.session;
      if (!session?.user) {
        router.replace('/');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });
  }, [supabase, router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  if (loading) {
    return (
      <div style={styles.root} suppressHydrationWarning>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading...</p>
      </div>
    );
  }

  const rawName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const firstName = rawName.split(/[ ._]/)[0];
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';

  return (
    <>
      {/* ── Keyframe + responsive styles ─────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          40%       { transform: translateY(-4px); }
          70%       { transform: translateY(-2px); }
        }

        /* Floodlight sweep — single pass, ~3.5s, then stops */
        @keyframes floodlightSweep {
          0%   { opacity: 0; transform: translateX(-30%) skewX(-8deg); }
          15%  { opacity: 1; }
          80%  { opacity: 0.6; }
          100% { opacity: 0; transform: translateX(60%) skewX(-8deg); }
        }

        @media (prefers-reduced-motion: no-preference) {
          .db-floodlight-sweep {
            animation: floodlightSweep 3.5s cubic-bezier(0.4, 0, 0.2, 1) 0.4s 1 forwards;
          }
        }

        .db-header   { animation: fadeUp 0.45s ease both; animation-delay: 0ms; }
        .db-welcome  { animation: fadeUp 0.45s ease both; animation-delay: 90ms; }
        .db-card-0   { animation: fadeUp 0.45s ease both; animation-delay: 180ms; }
        .db-card-1   { animation: fadeUp 0.45s ease both; animation-delay: 270ms; }
        .db-card-2   { animation: fadeUp 0.45s ease both; animation-delay: 360ms; }

        /* icon bounce on card hover */
        .db-feature-card:hover .db-card-icon {
          animation: iconBounce 0.5s ease;
        }

        /* Sign Out subtle hover */
        .db-signout:hover {
          background: rgba(255,255,255,0.07) !important;
          border-color: rgba(255,255,255,0.18) !important;
          color: #e2e8f0 !important;
        }

        /* Keyboard focus — visible ring on all interactive elements */
        .db-signout:focus-visible,
        a:focus-visible {
          outline: 2px solid #fbbf24;
          outline-offset: 3px;
          border-radius: 4px;
        }

        /* ── Responsive ─────────────────────────────────── */
        @media (max-width: 640px) {
          .db-root { padding: 0 !important; align-items: flex-start !important; }
          .db-outer-card { border-radius: 0 !important; min-height: 100vh !important; }
          .db-card { padding: 1.25rem !important; border-radius: 16px !important; }
          .db-header-row { gap: 0.5rem !important; }
          .db-subtitle { max-width: 140px !important; font-size: 0.75rem !important; }
          .db-signout { padding: 0.35rem 0.6rem !important; font-size: 0.7rem !important; }
          .db-welcome-title { font-size: 1rem !important; }
          .db-welcome-desc  { font-size: 0.82rem !important; }
          .db-feature-card  { padding: 1rem !important; }
          .db-feature-title { font-size: 0.95rem !important; }
          /* Simplify background on mobile */
          .db-stadium-ring-outer { display: none; }
          .db-beam-secondary { display: none; }
        }
      `}</style>

      {/* ── Full-bleed stadium-at-night root ──────────────────────────────── */}
      <div style={styles.root} className="db-root" suppressHydrationWarning>

        {/* ── Stadium background layer ─────────────────────────────────────── */}
        <div style={styles.bgLayer} aria-hidden="true">

          {/* Static stadium bowl silhouette — concentric oval rings */}
          <svg
            viewBox="0 0 800 500"
            xmlns="http://www.w3.org/2000/svg"
            style={styles.stadiumSvg}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="bowlGlow" cx="50%" cy="60%" r="55%">
                <stop offset="0%" stopColor="#16a34a" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#0a0e1a" stopOpacity="0" />
              </radialGradient>
              <filter id="bowlBlur">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>

            {/* Pitch glow center */}
            <ellipse cx="400" cy="310" rx="160" ry="70" fill="url(#bowlGlow)" />

            {/* Tier rings — inner to outer */}
            <ellipse cx="400" cy="310" rx="168" ry="74"
              fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"
              filter="url(#bowlBlur)" />
            <ellipse cx="400" cy="308" rx="215" ry="100"
              fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"
              filter="url(#bowlBlur)" />
            <ellipse cx="400" cy="305" rx="268" ry="128"
              fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5"
              filter="url(#bowlBlur)" />
            <ellipse cx="400" cy="302" rx="322" ry="158"
              fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"
              filter="url(#bowlBlur)" className="db-stadium-ring-outer" />
            <ellipse cx="400" cy="298" rx="378" ry="190"
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"
              filter="url(#bowlBlur)" className="db-stadium-ring-outer" />
            <ellipse cx="400" cy="294" rx="436" ry="222"
              fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1"
              filter="url(#bowlBlur)" className="db-stadium-ring-outer" />

            {/* Roof/canopy arc */}
            <path d="M 30 260 Q 400 100 770 260" fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="1.5"
              filter="url(#bowlBlur)" className="db-stadium-ring-outer" />

            {/* Floodlight mast hints */}
            <line x1="60" y1="90" x2="90" y2="200" stroke="rgba(251,191,36,0.12)" strokeWidth="1" />
            <line x1="740" y1="90" x2="710" y2="200" stroke="rgba(251,191,36,0.12)" strokeWidth="1" />
            <circle cx="60" cy="88" r="3" fill="rgba(251,191,36,0.3)" />
            <circle cx="740" cy="88" r="3" fill="rgba(251,191,36,0.3)" />
          </svg>

          {/* Static beam 1 — top-left */}
          <div style={{
            ...styles.beam,
            left: '-10%',
            top: '-5%',
            width: '55%',
            height: '80%',
            background: 'linear-gradient(135deg, rgba(251,191,36,0.09) 0%, rgba(251,191,36,0.04) 40%, transparent 70%)',
            transform: 'skewX(-12deg)',
          }} className="db-beam-secondary" />

          {/* Static beam 2 — top-right */}
          <div style={{
            ...styles.beam,
            right: '-10%',
            top: '-5%',
            width: '50%',
            height: '75%',
            background: 'linear-gradient(225deg, rgba(251,191,36,0.07) 0%, rgba(251,191,36,0.03) 40%, transparent 70%)',
            transform: 'skewX(12deg)',
          }} className="db-beam-secondary" />

          {/* Animated sweep beam — single pass on load */}
          <div
            style={{
              ...styles.beam,
              left: '0',
              top: '-10%',
              width: '40%',
              height: '100%',
              background: 'linear-gradient(160deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.08) 30%, transparent 65%)',
              opacity: 0,
              willChange: 'transform, opacity',
            }}
            className="db-floodlight-sweep"
          />
        </div>

        {/* ── Glass card wrapper ────────────────────────────────────────────── */}
        <div style={styles.outerCard} className="db-outer-card">
          <div style={styles.card} className="db-card" suppressHydrationWarning>

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div style={styles.header} className="db-header db-header-row">
              <div style={styles.headerLeft}>
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
                  <h1 style={styles.title}>StadiumSetu</h1>
                  <p style={styles.subtitle} className="db-subtitle">
                    Welcome back{displayName ? <>, <span style={styles.nameHighlight}>{displayName}</span></> : ''}
                  </p>
                </div>
              </div>
              <button onClick={handleSignOut} style={styles.headerSignOut} className="db-signout">
                Sign Out
              </button>
            </div>

            {/* ── Welcome Section ─────────────────────────────────────────────── */}
            <div style={styles.welcomeSection} className="db-welcome">
              {/* Eyebrow — scoreboard/signage typography in Geist Mono */}
              <p style={styles.eyebrow}>LIVE · FIFA WORLD CUP 2026</p>
              <h2 style={styles.welcomeTitle} className="db-welcome-title">Find your way around the stadium</h2>
              <p style={styles.welcomeDesc} className="db-welcome-desc">
                Navigate seating, gates, and facilities across FIFA World Cup 2026 venues with our interactive fan and operations tools.
              </p>
            </div>

            {/* ── Feature Grid ─────────────────────────────────────────────────── */}
            <div style={styles.grid}>

              {/* Card 1 — Find My Seat */}
              <div className="db-card-0">
                <Link
                  href="/fan"
                  style={styles.cardLink}
                  onMouseEnter={() => setHovered('seat')}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    style={{
                      ...styles.featureCard,
                      ...(hovered === 'seat' ? styles.featureCardHovered : {}),
                    }}
                    className="db-feature-card"
                  >
                    <h3 style={styles.featureTitle} className="db-feature-title">
                      <span className="db-card-icon">🔍</span> Find My Seat
                    </h3>
                    <p style={styles.featureDesc}>Look up your section and find the nearest gate</p>
                  </div>
                </Link>
              </div>

              {/* Card 2 — 3D Stadium View */}
              <div className="db-card-1">
                <Link
                  href="/fan/3d"
                  style={styles.cardLink}
                  onMouseEnter={() => setHovered('3d')}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    style={{
                      ...styles.featureCard,
                      ...(hovered === '3d' ? styles.featureCardHovered : {}),
                    }}
                    className="db-feature-card"
                  >
                    <h3 style={styles.featureTitle} className="db-feature-title">
                      <span className="db-card-icon">🏟️</span> 3D Stadium View
                    </h3>
                    <p style={styles.featureDesc}>See your seat location in an interactive 3D stadium</p>
                  </div>
                </Link>
              </div>

              {/* Card 3 — Operations */}
              <div className="db-card-2">
                <Link
                  href="/ops"
                  style={styles.cardLink}
                  onMouseEnter={() => setHovered('ops')}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    style={{
                      ...styles.featureCard,
                      ...(hovered === 'ops' ? styles.featureCardHovered : {}),
                    }}
                    className="db-feature-card"
                  >
                    <h3 style={styles.featureTitle} className="db-feature-title">
                      <span className="db-card-icon">⚙️</span> Operations
                    </h3>
                    <p style={styles.featureDesc}>Live heatmap, real-time alerts, and crowd spike simulation</p>
                  </div>
                </Link>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0e1a',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: '1.5rem',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },

  bgLayer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
    overflow: 'hidden',
  },

  stadiumSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
  },

  beam: {
    position: 'absolute',
    pointerEvents: 'none',
    borderRadius: '50%',
    filter: 'blur(18px)',
  },

  outerCard: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '560px',
    borderRadius: '22px',
    background: 'rgba(10,14,26,0.72)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(251,191,36,0.10)',
    boxShadow:
      '0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.65), 0 0 60px rgba(251,191,36,0.04)',
    boxSizing: 'border-box',
  },

  card: {
    width: '100%',
    padding: '2rem',
    boxSizing: 'border-box',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    gap: '0.75rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    minWidth: 0,
    flex: 1,
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
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 0.2rem',
    whiteSpace: 'nowrap',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: '#64748b',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '220px',
  },
  nameHighlight: {
    color: '#e2e8f0',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  headerSignOut: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#94a3b8',
    padding: '0.4rem 0.8rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },

  eyebrow: {
    fontFamily: 'var(--font-geist-mono), "Geist Mono", monospace',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#fbbf24',
    margin: '0 0 0.6rem',
    opacity: 0.9,
  },

  welcomeSection: {
    marginBottom: '2rem',
  },
  welcomeTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#e2e8f0',
    margin: '0 0 0.5rem',
  },
  welcomeDesc: {
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: '#94a3b8',
    margin: 0,
  },

  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },

  featureCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderLeft: '3px solid transparent',
    borderRadius: '12px',
    padding: '1.25rem',
    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
    cursor: 'pointer',
  },
  featureCardHovered: {
    transform: 'scale(1.02)',
    background: 'rgba(22,163,74,0.04)',
    border: '1px solid rgba(22,163,74,0.22)',
    borderLeft: '3px solid #16a34a',
    boxShadow: '0 0 0 1px rgba(22,163,74,0.12), 0 8px 32px rgba(22,163,74,0.10)',
  },
  featureTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#f8fafc',
    margin: '0 0 0.4rem',
  },
  featureDesc: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.4,
  },
};
