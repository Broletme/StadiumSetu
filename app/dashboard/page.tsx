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
    <div style={styles.root} suppressHydrationWarning>
      <div style={styles.card} suppressHydrationWarning>
        {/* Header with Logo and Sign Out */}
        <div style={styles.header}>
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
              <p style={styles.subtitle}>
                Welcome back{displayName ? <>, <span style={styles.nameHighlight}>{displayName}</span></> : ''}
              </p>
            </div>
          </div>
          <button onClick={handleSignOut} style={styles.headerSignOut}>
            Sign Out
          </button>
        </div>

        {/* Welcome Section */}
        <div style={styles.welcomeSection}>
          <h2 style={styles.welcomeTitle}>Find your way around the stadium</h2>
          <p style={styles.welcomeDesc}>
            Navigate seating, gates, and facilities across FIFA World Cup 2026 venues with our interactive fan and operations tools.
          </p>
        </div>

        {/* Feature Grid */}
        <div style={styles.grid}>
          <Link href="/fan" style={styles.cardLink}>
            <div style={styles.featureCard}>
              <h3 style={styles.featureTitle}>🔍 Find My Seat</h3>
              <p style={styles.featureDesc}>Look up your section and find the nearest gate</p>
            </div>
          </Link>

          <Link href="/fan/3d" style={styles.cardLink}>
            <div style={styles.featureCard}>
              <h3 style={styles.featureTitle}>🏟️ 3D Stadium View</h3>
              <p style={styles.featureDesc}>See your seat location in an interactive 3D stadium</p>
            </div>
          </Link>

          {/* Disabled placeholder for Operations */}
          <div style={{ ...styles.cardLink, ...styles.featureCardDisabled }}>
            <div style={styles.featureCard}>
              <div style={styles.featureTitleRow}>
                <h3 style={styles.featureTitle}>⚙️ Operations</h3>
                <span style={styles.badge}>Coming Soon</span>
              </div>
              <p style={styles.featureDesc}>Manage zones, real-time incidents and staff deployments</p>
            </div>
          </div>
        </div>
      </div>
    </div>
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
  },
  card: {
    width: '100%',
    maxWidth: '560px', // slightly wider for the grid
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '2rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
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
    color: '#e2e8f0', // Brighter white for the highlighted name
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
    transition: 'all 0.2s',
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
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  featureCardDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  featureTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.4rem',
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
  badge: {
    background: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
    border: '1px solid rgba(99,102,241,0.3)',
    fontSize: '0.65rem',
    fontWeight: 600,
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    textTransform: 'uppercase',
  },
};
