'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-root">
        <div className="login-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
          <div className="login-logo" style={{ marginBottom: '1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="spinner-icon" style={{ animation: 'spin 1.5s linear infinite' }}>
              <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#g1)" />
              <defs>
                <linearGradient id="g1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <p className="login-subtitle">Loading authentication...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(searchParams.get('error'));
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    if (isSignUp) {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push('/ops');
        router.refresh();
      } else {
        setSuccessMessage('Sign up successful! Check your email for a confirmation link.');
        setLoading(false);
      }
    } else {
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
  }

  async function handleGoogleSignIn() {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
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
          <h1 className="login-title">
            {isSignUp ? 'Create Ops Account' : 'StadiumSetu Ops'}
          </h1>
          <p className="login-subtitle">
            {isSignUp ? 'Register a new staff account to request access.' : 'Staff access only. Sign in to continue.'}
          </p>
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
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
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

          {successMessage && (
            <div id="login-success" className="form-success" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {successMessage}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="form-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="btn-spinner" aria-label={isSignUp ? 'Signing up…' : 'Signing in…'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spinner-icon">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </span>
            ) : (
              isSignUp ? 'Sign up' : 'Sign in'
            )}
          </button>

          <div className="auth-divider">
            <span className="divider-line"></span>
            <span className="divider-text">or</span>
            <span className="divider-line"></span>
          </div>

          <button
            id="google-signin"
            type="button"
            className="google-submit"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ marginRight: '10px' }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </form>

        <p className="auth-toggle-text">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button
            type="button"
            className="auth-toggle-btn"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccessMessage(null);
            }}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>

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
        .form-success {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.875rem;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 8px;
          color: #a7f3d0;
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
        .google-submit {
          width: 100%;
          padding: 0.8rem 1.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: #f1f5f9;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, transform 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
        }
        .google-submit:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-1px);
        }
        .google-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .google-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 0.5rem 0;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }
        .divider-text {
          padding: 0 0.75rem;
          color: #475569;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .auth-toggle-text {
          text-align: center;
          font-size: 0.875rem;
          color: #64748b;
          margin-top: 1.5rem;
        }
        .auth-toggle-btn {
          background: none;
          border: none;
          color: #8b5cf6;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          margin-left: 0.35rem;
          text-decoration: none;
          transition: color 0.2s;
        }
        .auth-toggle-btn:hover {
          color: #a78bfa;
          text-decoration: underline;
        }
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
