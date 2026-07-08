'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Props {
  userEmail: string;
  accessToken: string;
}

interface OpsUser {
  userId: string;
  role: string | null;
  assignedZone: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const ROLE_COLORS: Record<string, string> = {
  admin: '#f59e0b',
  zone_lead: '#6366f1',
  medical: '#10b981',
  security: '#ef4444',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  zone_lead: 'Zone Lead',
  medical: 'Medical',
  security: 'Security',
};

export default function OpsDashboardClient({ userEmail, accessToken }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [opsUser, setOpsUser] = useState<OpsUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  /**
   * Wrapper for all /ops/* backend calls.
   * Automatically attaches the Authorization: Bearer <token> header.
   */
  const apiFetch = useCallback(
    (path: string, init?: RequestInit) => {
      return fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(init?.headers ?? {}),
        },
      });
    },
    [accessToken],
  );

  async function loadProfile() {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await apiFetch('/ops/me');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setOpsUser(data.user);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const roleColor = opsUser?.role ? (ROLE_COLORS[opsUser.role] ?? '#64748b') : '#64748b';
  const roleLabel = opsUser?.role ? (ROLE_LABELS[opsUser.role] ?? opsUser.role) : 'No role assigned';

  return (
    <div className="ops-root">
      {/* Header */}
      <header className="ops-header">
        <div className="ops-header-inner">
          <div className="ops-brand">
            <div className="ops-logo">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#og1)" />
                <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.2)" />
                <defs>
                  <linearGradient id="og1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366f1" /><stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="ops-brand-name">StadiumSetu <span className="ops-brand-tag">OPS</span></span>
          </div>

          <div className="ops-header-right">
            <span className="ops-user-email" title={userEmail}>{userEmail}</span>
            <button
              id="ops-logout-btn"
              className="logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sign out"
            >
              {loggingOut ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spinner-icon" aria-hidden="true">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              )}
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="ops-main">
        <div className="ops-grid">

          {/* Welcome card */}
          <div className="ops-card ops-welcome-card">
            <div className="ops-card-glow" style={{ background: `radial-gradient(ellipse at top left, ${roleColor}22 0%, transparent 60%)` }} />
            <div className="ops-card-header">
              <h2 className="ops-card-title">Welcome back</h2>
            </div>
            <p className="ops-welcome-text">
              You&apos;re signed in as <strong>{userEmail}</strong>.
              Use the panel below to load your role and access ops features.
            </p>
          </div>

          {/* Profile / Role card */}
          <div className="ops-card">
            <div className="ops-card-header">
              <h2 className="ops-card-title">Your Role</h2>
              <button
                id="ops-load-profile-btn"
                className="ops-action-btn"
                onClick={loadProfile}
                disabled={profileLoading}
              >
                {profileLoading ? 'Loading…' : 'Fetch from API'}
              </button>
            </div>

            {profileError && (
              <div className="ops-alert ops-alert-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {profileError}
              </div>
            )}

            {opsUser ? (
              <div className="ops-profile">
                <div className="ops-role-badge" style={{ '--role-color': roleColor } as React.CSSProperties}>
                  <div className="ops-role-dot" style={{ background: roleColor }} />
                  <span>{roleLabel}</span>
                </div>
                {opsUser.assignedZone && (
                  <div className="ops-profile-detail">
                    <span className="ops-detail-label">Assigned Zone</span>
                    <span className="ops-detail-value">{opsUser.assignedZone}</span>
                  </div>
                )}
                <div className="ops-profile-detail">
                  <span className="ops-detail-label">User ID</span>
                  <code className="ops-detail-code">{opsUser.userId.slice(0, 8)}…</code>
                </div>
              </div>
            ) : (
              !profileLoading && (
                <p className="ops-placeholder">
                  Click &quot;Fetch from API&quot; to load your profile from the backend.
                </p>
              )
            )}
          </div>

          {/* Status card */}
          <div className="ops-card ops-status-card">
            <div className="ops-card-header">
              <h2 className="ops-card-title">System Status</h2>
              <div className="ops-status-dot-wrap">
                <span className="ops-status-dot ops-status-online" />
                <span className="ops-status-label">Operational</span>
              </div>
            </div>
            <div className="ops-status-list">
              {['Auth Service', 'Incident API', 'Zone Comms', 'Medical Relay'].map((svc) => (
                <div key={svc} className="ops-status-item">
                  <span className="ops-status-name">{svc}</span>
                  <span className="ops-status-value ops-ok">Online</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        .ops-root {
          min-height: 100vh;
          background: #090910;
          background-image: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 70%);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #e2e8f0;
        }
        .ops-header {
          position: sticky; top: 0; z-index: 50;
          background: rgba(9, 9, 16, 0.85);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
        }
        .ops-header-inner {
          max-width: 1100px; margin: 0 auto;
          padding: 0 1.5rem;
          height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .ops-brand { display: flex; align-items: center; gap: 0.625rem; }
        .ops-logo {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 10px;
        }
        .ops-brand-name { font-size: 0.9375rem; font-weight: 700; color: #f1f5f9; letter-spacing: -0.01em; }
        .ops-brand-tag {
          font-size: 0.625rem; font-weight: 700; letter-spacing: 0.08em;
          background: linear-gradient(135deg,#6366f1,#8b5cf6);
          color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 4px; vertical-align: middle;
        }
        .ops-header-right { display: flex; align-items: center; gap: 0.75rem; }
        .ops-user-email {
          font-size: 0.8125rem; color: #475569;
          max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .logout-btn {
          display: inline-flex; align-items: center; gap: 0.375rem;
          padding: 0.4rem 0.875rem;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          color: #fca5a5; font-size: 0.8125rem; font-weight: 500; cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .logout-btn:hover:not(:disabled) { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.35); }
        .logout-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner-icon { animation: spin 0.8s linear infinite; }
        .ops-main { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
        .ops-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; }
        .ops-card {
          position: relative; overflow: hidden;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 1.5rem;
          animation: card-in 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ops-card-glow { position: absolute; inset: 0; pointer-events: none; }
        .ops-welcome-card { grid-column: 1 / -1; }
        .ops-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .ops-card-title { font-size: 0.9375rem; font-weight: 600; color: #cbd5e1; margin: 0; }
        .ops-welcome-text { font-size: 0.875rem; color: #64748b; line-height: 1.6; margin: 0; }
        .ops-welcome-text strong { color: #94a3b8; font-weight: 500; }
        .ops-action-btn {
          padding: 0.35rem 0.75rem;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 7px;
          color: #a5b4fc; font-size: 0.75rem; font-weight: 500; cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .ops-action-btn:hover:not(:disabled) { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.4); }
        .ops-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ops-alert {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 0.75rem; border-radius: 8px;
          font-size: 0.8rem; margin-bottom: 1rem;
        }
        .ops-alert-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; }
        .ops-profile { display: flex; flex-direction: column; gap: 0.75rem; }
        .ops-role-badge {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.4rem 0.875rem;
          background: color-mix(in srgb, var(--role-color) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--role-color) 30%, transparent);
          border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
          color: var(--role-color); width: fit-content;
        }
        .ops-role-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .ops-profile-detail { display: flex; align-items: center; justify-content: space-between; }
        .ops-detail-label { font-size: 0.75rem; color: #475569; }
        .ops-detail-value { font-size: 0.8125rem; color: #94a3b8; font-weight: 500; }
        .ops-detail-code { font-size: 0.75rem; color: #64748b; font-family: 'JetBrains Mono', monospace; background: rgba(255,255,255,0.04); padding: 2px 6px; border-radius: 4px; }
        .ops-placeholder { font-size: 0.8125rem; color: #334155; margin: 0; }
        .ops-status-card {}
        .ops-status-dot-wrap { display: flex; align-items: center; gap: 0.4rem; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .ops-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .ops-status-online { background: #10b981; animation: pulse 2s ease-in-out infinite; }
        .ops-status-label { font-size: 0.75rem; color: #10b981; font-weight: 500; }
        .ops-status-list { display: flex; flex-direction: column; gap: 0.625rem; }
        .ops-status-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .ops-status-item:last-child { border-bottom: none; }
        .ops-status-name { font-size: 0.8125rem; color: #64748b; }
        .ops-status-value { font-size: 0.75rem; font-weight: 500; }
        .ops-ok { color: #10b981; }
      `}</style>
    </div>
  );
}
