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
  const [hovered, setHovered] = useState<'seat' | '3d' | 'ops' | null>(null);

  useEffect(() => {
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
        @keyframes floodlightSweep {
          0%   { opacity: 0; transform: translateX(-40%) skewX(-10deg); }
          12%  { opacity: 1; }
          75%  { opacity: 0.85; }
          100% { opacity: 0; transform: translateX(80%) skewX(-10deg); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .db-floodlight-sweep {
            animation: floodlightSweep 3.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s 1 forwards;
          }
        }
        .db-header  { animation: fadeUp 0.45s ease both; animation-delay: 0ms; }
        .db-welcome { animation: fadeUp 0.45s ease both; animation-delay: 90ms; }
        .db-card-0  { animation: fadeUp 0.45s ease both; animation-delay: 180ms; }
        .db-card-1  { animation: fadeUp 0.45s ease both; animation-delay: 270ms; }
        .db-card-2  { animation: fadeUp 0.45s ease both; animation-delay: 360ms; }
        .db-feature-card:hover .db-card-icon { animation: iconBounce 0.5s ease; }
        .db-signout:hover {
          background: rgba(255,255,255,0.08) !important;
          border-color: rgba(255,255,255,0.22) !important;
          color: #f1f5f9 !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3) !important;
        }
        .db-signout:focus-visible, a:focus-visible {
          outline: 2px solid #fbbf24;
          outline-offset: 3px;
          border-radius: 4px;
        }
        /* gradient text for brand name */
        .db-brand-title {
          background: linear-gradient(105deg, #e2e8f0 0%, #a5b4fc 55%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        @media (max-width: 640px) {
          .db-root { padding: 0 !important; align-items: flex-start !important; }
          .db-outer-card { border-radius: 0 !important; min-height: 100vh !important; }
          .db-card { padding: 1.25rem !important; }
          .db-header-row { gap: 0.5rem !important; }
          .db-subtitle { max-width: 140px !important; font-size: 0.75rem !important; }
          .db-signout { padding: 0.35rem 0.6rem !important; font-size: 0.7rem !important; }
          .db-welcome-title { font-size: 1rem !important; }
          .db-welcome-desc  { font-size: 0.82rem !important; }
          .db-feature-card  { padding: 1rem !important; }
          .db-feature-title { font-size: 0.95rem !important; }
          .db-stadium-ring-outer { display: none; }
          .db-beam-side { display: none; }
        }
      `}</style>

      <div style={styles.root} className="db-root" suppressHydrationWarning>
        <div style={styles.bgLayer} aria-hidden="true">

          {/* Left amber floodlight beam */}
          <div style={{
            position: 'absolute', top: '-8%', left: '-8%',
            width: '65%', height: '110%',
            background: 'linear-gradient(145deg, rgba(251,191,36,0.32) 0%, rgba(251,191,36,0.14) 35%, rgba(251,191,36,0.04) 60%, transparent 78%)',
            transform: 'skewX(-14deg)', filter: 'blur(28px)', pointerEvents: 'none',
          }} className="db-beam-side" />

          {/* Right amber floodlight beam */}
          <div style={{
            position: 'absolute', top: '-8%', right: '-8%',
            width: '60%', height: '110%',
            background: 'linear-gradient(215deg, rgba(251,191,36,0.28) 0%, rgba(251,191,36,0.12) 35%, rgba(251,191,36,0.04) 60%, transparent 78%)',
            transform: 'skewX(14deg)', filter: 'blur(28px)', pointerEvents: 'none',
          }} className="db-beam-side" />

          {/* Animated sweep beam */}
          <div className="db-floodlight-sweep" style={{
            position: 'absolute', top: '-12%', left: '5%',
            width: '50%', height: '120%',
            background: 'linear-gradient(155deg, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0.22) 28%, rgba(251,191,36,0.06) 55%, transparent 72%)',
            filter: 'blur(22px)', opacity: 0, willChange: 'transform, opacity', pointerEvents: 'none',
          }} />

          {/* Stadium bowl SVG */}
          <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -42%)',
              width: '140%', maxWidth: '1100px', height: 'auto', pointerEvents: 'none',
            }}
            aria-hidden="true">
            <defs>
              <radialGradient id="pitchGlow" cx="50%" cy="58%" r="30%">
                <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.35" />
                <stop offset="45%"  stopColor="#16a34a" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#0a0e1a" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="tierFill" cx="50%" cy="58%" r="60%">
                <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
                <stop offset="55%"  stopColor="rgba(255,255,255,0.015)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
              </radialGradient>
              <radialGradient id="mastGlowL" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="mastGlowR" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="400" cy="360" rx="175" ry="80" fill="url(#pitchGlow)" />
            <ellipse cx="400" cy="360" rx="155" ry="62" fill="none" stroke="rgba(34,197,94,0.55)" strokeWidth="1.5" />
            <ellipse cx="400" cy="360" rx="38"  ry="18" fill="none" stroke="rgba(34,197,94,0.35)" strokeWidth="1" />
            <line x1="245" y1="360" x2="555" y2="360" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
            <ellipse cx="400" cy="356" rx="196" ry="92"  fill="none" stroke="rgba(255,255,255,0.60)" strokeWidth="2" />
            <ellipse cx="400" cy="350" rx="248" ry="118" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="1.8" />
            <ellipse cx="400" cy="344" rx="302" ry="146" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" />
            <ellipse cx="400" cy="337" rx="358" ry="175" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" className="db-stadium-ring-outer" />
            <ellipse cx="400" cy="329" rx="416" ry="206" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1"   className="db-stadium-ring-outer" />
            <ellipse cx="400" cy="320" rx="476" ry="238" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1"   className="db-stadium-ring-outer" />
            <ellipse cx="400" cy="344" rx="302" ry="146" fill="url(#tierFill)" />
            <path d="M 20 290 Q 400 80 780 290"  fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" className="db-stadium-ring-outer" />
            <path d="M 55 300 Q 400 112 745 300" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" className="db-stadium-ring-outer" />
            <line x1="72"  y1="72" x2="108" y2="220" stroke="rgba(251,191,36,0.55)" strokeWidth="2.5" />
            <ellipse cx="72"  cy="68" rx="18" ry="18" fill="url(#mastGlowL)" />
            <circle cx="72"  cy="72" r="5"  fill="rgba(251,191,36,0.95)" />
            <circle cx="72"  cy="72" r="10" fill="rgba(251,191,36,0.25)" />
            <path d="M 72 72 L 200 310 L 108 280 Z" fill="rgba(251,191,36,0.06)" />
            <line x1="728" y1="72" x2="692" y2="220" stroke="rgba(251,191,36,0.55)" strokeWidth="2.5" />
            <ellipse cx="728" cy="68" rx="18" ry="18" fill="url(#mastGlowR)" />
            <circle cx="728" cy="72" r="5"  fill="rgba(251,191,36,0.95)" />
            <circle cx="728" cy="72" r="10" fill="rgba(251,191,36,0.25)" />
            <path d="M 728 72 L 600 310 L 692 280 Z" fill="rgba(251,191,36,0.06)" />
          </svg>
        </div>

        <div style={styles.outerCard} className="db-outer-card">
          <div style={styles.card} className="db-card" suppressHydrationWarning>

            <div style={styles.header} className="db-header db-header-row">
              <div style={styles.headerLeft}>
                {/* Logo icon box */}
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

                {/* Brand + user info */}
                <div style={{ minWidth: 0 }}>
                  <h1 style={styles.title} className="db-brand-title">StadiumSetu</h1>
                  {displayName && (
                    <div style={styles.userRow}>
                      {/* User initial avatar */}
                      <div style={styles.avatar} aria-hidden="true">
                        {displayName.charAt(0)}
                      </div>
                      <p style={styles.subtitle} className="db-subtitle">
                        <span style={styles.nameHighlight}>{displayName}</span>
                        <span style={styles.statusDot} aria-label="online" />
                        <span style={styles.statusText}>online</span>
                      </p>
                    </div>
                  )}
                  {!displayName && (
                    <p style={styles.subtitle} className="db-subtitle">Welcome back</p>
                  )}
                </div>
              </div>

              {/* Sign Out */}
              <button onClick={handleSignOut} style={styles.headerSignOut} className="db-signout">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>

            <div style={styles.welcomeSection} className="db-welcome">
              <p style={styles.eyebrow}>LIVE · FIFA WORLD CUP 2026</p>
              <h2 style={styles.welcomeTitle} className="db-welcome-title">Find your way around the stadium</h2>
              <p style={styles.welcomeDesc} className="db-welcome-desc">
                Navigate seating, gates, and facilities across FIFA World Cup 2026 venues with our interactive fan and operations tools.
              </p>
            </div>

            <div style={styles.grid}>
              <div className="db-card-0">
                <Link href="/fan" style={styles.cardLink}
                  onMouseEnter={() => setHovered('seat')}
                  onMouseLeave={() => setHovered(null)}>
                  <div style={{ ...styles.featureCard, ...(hovered === 'seat' ? styles.featureCardHovered : {}) }} className="db-feature-card">
                    <h3 style={styles.featureTitle} className="db-feature-title">
                      <span className="db-card-icon">🔍</span> Find My Seat
                    </h3>
                    <p style={styles.featureDesc}>Look up your section and find the nearest gate</p>
                  </div>
                </Link>
              </div>
              <div className="db-card-1">
                <Link href="/fan/3d" style={styles.cardLink}
                  onMouseEnter={() => setHovered('3d')}
                  onMouseLeave={() => setHovered(null)}>
                  <div style={{ ...styles.featureCard, ...(hovered === '3d' ? styles.featureCardHovered : {}) }} className="db-feature-card">
                    <h3 style={styles.featureTitle} className="db-feature-title">
                      <span className="db-card-icon">🏟️</span> 3D Stadium View
                    </h3>
                    <p style={styles.featureDesc}>See your seat location in an interactive 3D stadium</p>
                  </div>
                </Link>
              </div>
              <div className="db-card-2">
                <Link href="/ops" style={styles.cardLink}
                  onMouseEnter={() => setHovered('ops')}
                  onMouseLeave={() => setHovered(null)}>
                  <div style={{ ...styles.featureCard, ...(hovered === 'ops' ? styles.featureCardHovered : {}) }} className="db-feature-card">
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
  outerCard: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '560px',
    borderRadius: '22px',
    background: 'linear-gradient(160deg, rgba(14,20,36,0.90) 0%, rgba(10,14,26,0.84) 100%)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(251,191,36,0.22)',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 0 40px 8px rgba(251,191,36,0.14), 0 0 80px 20px rgba(251,191,36,0.07), 0 24px 80px rgba(0,0,0,0.7)',
    boxSizing: 'border-box',
  },
  card: { width: '100%', padding: '2rem', boxSizing: 'border-box' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    // Gradient separator: amber tint at left fades to transparent, evoking a light source
    borderBottom: '1px solid transparent',
    backgroundImage: 'linear-gradient(90deg, rgba(251,191,36,0.18) 0%, rgba(255,255,255,0.07) 40%, transparent 100%)',
    backgroundSize: '100% 1px',
    backgroundPosition: '0 100%',
    backgroundRepeat: 'no-repeat',
    gap: '0.75rem',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: 1 },
  logo: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '48px', height: '48px',
    background: 'linear-gradient(135deg, rgba(109,112,255,0.20) 0%, rgba(99,102,241,0.10) 60%, rgba(80,84,220,0.16) 100%)',
    border: '1px solid rgba(139,92,246,0.35)',
    borderRadius: '14px',
    flexShrink: 0,
    boxShadow: [
      '0 0 0 1px rgba(99,102,241,0.12)',
      '0 0 12px 3px rgba(99,102,241,0.18)',
      '0 0 28px 6px rgba(139,92,246,0.10)',
      'inset 0 1px 0 rgba(180,182,255,0.18)',
    ].join(', '),
  },
  // Brand title — styled via .db-brand-title CSS class (gradient text)
  title: {
    fontSize: '1.2rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    margin: '0 0 0.25rem',
    whiteSpace: 'nowrap',
    color: '#e2e8f0', // fallback for browsers that don't support gradient text
  },
  // Compact row: avatar + name + status dot
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  // User initial badge
  avatar: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff',
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0',
    flexShrink: 0,
    boxShadow: '0 0 6px rgba(99,102,241,0.45)',
  },
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.8rem',
    color: '#64748b',
    margin: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  nameHighlight: { color: '#c4b5fd', fontWeight: 600 },
  statusDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#22c55e',
    flexShrink: 0,
    boxShadow: '0 0 4px rgba(34,197,94,0.7)',
  },
  statusText: {
    fontSize: '0.7rem',
    color: '#4ade80',
    fontWeight: 500,
    letterSpacing: '0.04em',
  },
  headerSignOut: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '8px',
    color: '#94a3b8',
    padding: '0.4rem 0.75rem',
    fontSize: '0.73rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  },
  eyebrow: {
    fontFamily: 'var(--font-geist-mono), "Geist Mono", monospace',
    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.18em',
    textTransform: 'uppercase' as const, color: '#fbbf24', margin: '0 0 0.6rem',
  },
  welcomeSection: { marginBottom: '2rem' },
  welcomeTitle: { fontSize: '1.15rem', fontWeight: 600, color: '#e2e8f0', margin: '0 0 0.5rem' },
  welcomeDesc: { fontSize: '0.9rem', lineHeight: 1.5, color: '#94a3b8', margin: 0 },
  grid: { display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  cardLink: { textDecoration: 'none', color: 'inherit', display: 'block' },
  featureCard: {
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
    borderLeft: '3px solid transparent', borderRadius: '12px', padding: '1.25rem',
    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
    cursor: 'pointer',
  },
  featureCardHovered: {
    transform: 'scale(1.02)', background: 'rgba(22,163,74,0.06)',
    border: '1px solid rgba(22,163,74,0.28)', borderLeft: '3px solid #16a34a',
    boxShadow: '0 0 0 1px rgba(22,163,74,0.14), 0 8px 32px rgba(22,163,74,0.12)',
  },
  featureTitle: { fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.4rem' },
  featureDesc: { fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.4 },
};
