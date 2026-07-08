'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Session is stored in cookies by @supabase/ssr automatically
    router.push('/ops');
    router.refresh(); // ensure server components re-render with the new session
  }

  return (
    <div className="login-root">
      <div className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="login-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#g1)" />
              <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.15)" />
              <defs>
                <linearGradient id="g1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="login-title">StadiumSetu Ops</h1>
          <p className="login-subtitle">Staff access only. Sign in to continue.</p>
        </div>

        {/* Form */}
        <form id="ops-login-form" className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Email address</label>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="you@stadium.org"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && (
            <div id="login-error" className="form-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="form-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="btn-spinner" aria-label="Signing in…">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spinner-icon">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="login-footer">
          Having trouble? Contact your stadium administrator.
        </p>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0f;
          background-image:
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99, 102, 241, 0.18) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 110%, rgba(139, 92, 246, 0.12) 0%, transparent 70%);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          padding: 1.5rem;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 2.5rem 2rem;
          backdrop-filter: blur(12px);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.08);
          animation: card-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-brand {
          text-align: center;
          margin-bottom: 2rem;
        }
        .login-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 16px;
          margin-bottom: 1rem;
        }
        .login-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -0.025em;
          margin: 0 0 0.4rem;
        }
        .login-subtitle {
          font-size: 0.875rem;
          color: #64748b;
          margin: 0;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .form-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #94a3b8;
          letter-spacing: 0.01em;
        }
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f1f5f9;
          font-size: 0.9375rem;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          outline: none;
          box-sizing: border-box;
        }
        .form-input::placeholder { color: #475569; }
        .form-input:focus {
          border-color: rgba(99, 102, 241, 0.6);
          background: rgba(99, 102, 241, 0.05);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
        .form-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .form-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.875rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 0.8125rem;
        }
        .form-submit {
          width: 100%;
          padding: 0.8rem 1.5rem;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
        }
        .form-submit:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
        }
        .form-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .form-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-spinner { display: inline-flex; align-items: center; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner-icon { animation: spin 0.8s linear infinite; }
        .login-footer {
          text-align: center;
          font-size: 0.75rem;
          color: #334155;
          margin: 1.5rem 0 0;
        }
      `}</style>
    </div>
  );
}
