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

        /* ── Responsive ─────────────────────────────────── */
        @media (max-width: 640px) {
          .db-root { padding: 1rem !important; align-items: flex-start !important; padding-top: 2rem !important; }
          .db-card { padding: 1.25rem !important; border-radius: 16px !important; }
          .db-header-row { gap: 0.5rem !important; }
          .db-subtitle { max-width: 140px !important; font-size: 0.75rem !important; }
          .db-signout { padding: 0.35rem 0.6rem !important; font-size: 0.7rem !important; }
          .db-welcome-title { font-size: 1rem !important; }
          .db-welcome-desc  { font-size: 0.82rem !important; }
          .db-feature-card  { padding: 1rem !important; }
          .db-feature-title { font-size: 0.95rem !important; }
        }
      `}</style>

      <div style={styles.root} className="db-root" suppressHydrationWarning>
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
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0f',
    backgroundImage:
      'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 70%)',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: '1.5rem',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '560px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '2rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    gap: '0.75rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    minWidth: 0, // allow text truncation
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
    borderRadius: '12px',
    padding: '1.25rem',
    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer',
  },
  featureCardHovered: {
    transform: 'scale(1.02)',
    border: '1px solid rgba(99,102,241,0.45)',
    boxShadow: '0 0 0 1px rgba(99,102,241,0.2), 0 8px 32px rgba(99,102,241,0.12)',
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
