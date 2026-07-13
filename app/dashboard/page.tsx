'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  return (
    <div style={styles.root} suppressHydrationWarning>
      <div style={styles.card} suppressHydrationWarning>
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
            <h1 style={styles.title}>StadiumSetu</h1>
            <p style={styles.subtitle}>Welcome back, {user?.email}</p>
          </div>
        </div>

        <div style={styles.placeholder}>
          <p style={{ color: '#475569', fontSize: '0.875rem', textAlign: 'center', margin: 0 }}>
            🏟️ Dashboard coming soon
          </p>
        </div>

        <button onClick={handleSignOut} style={styles.signOut}>
          Sign Out
        </button>
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
    maxWidth: '480px',
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
    maxWidth: '280px',
  },
  placeholder: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '3rem 1rem',
    marginBottom: '1.5rem',
  },
  signOut: {
    width: '100%',
    padding: '0.75rem 1.5rem',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    color: '#fca5a5',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};
