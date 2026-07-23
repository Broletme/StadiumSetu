'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Ripple = { id: number; x: number; y: number };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();
  const [hovered, setHovered] = useState<'seat' | '3d' | 'ops' | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  // DOM refs — animation drives these directly, no React re-renders
  const rootRef      = useRef<HTMLDivElement>(null);
  const bgLayerRef   = useRef<HTMLDivElement>(null);
  const outerCardRef = useRef<HTMLDivElement>(null);
  const beamLRef     = useRef<HTMLDivElement>(null);
  const beamRRef     = useRef<HTMLDivElement>(null);
  const spotRef      = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number>(0);
  const rippleIdRef  = useRef(0);

  // Lerp targets (refs, not state — zero re-renders)
  const tgt = useRef({ x: 0, y: 0 });
  const cur  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    supabase.auth.getSession().then((res: any) => {
      const session = res.data?.session;
      if (!session?.user) { router.replace('/'); }
      else { setUser(session.user); setLoading(false); }
    });
  }, [supabase, router]);

  // Mouse parallax + beam tracking + spotlight — all direct DOM, zero state updates
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const onMove = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      const ny = ((e.clientY - r.top)  / r.height - 0.5) * 2;
      tgt.current = { x: nx, y: ny };
      // Spotlight: instant, GPU transform
      if (spotRef.current) {
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        spotRef.current.style.transform = 'translate(' + (px - 240) + 'px, ' + (py - 240) + 'px)';
        spotRef.current.style.opacity = '1';
      }
    };

    const tick = () => {
      const cx = lerp(cur.current.x, tgt.current.x, 0.07);
      const cy = lerp(cur.current.y, tgt.current.y, 0.07);
      cur.current = { x: cx, y: cy };

      // Background parallax — subtle translation for depth (oversized bgLayer prevents any edge gaps)
      if (bgLayerRef.current)
        bgLayerRef.current.style.transform = 'translate(' + (cx * 25).toFixed(1) + 'px, ' + (cy * 15).toFixed(1) + 'px)';

      // Ambient sway — slow sinusoidal oscillation (~12s period) layered on top of cursor tracking
      // Left and right beams sway gently out of phase with each other for a natural feel
      const t = performance.now() / 1000;
      const swayL = Math.sin(t * 0.52) * 2.8;   // ±2.8° at ~12s period
      const swayR = Math.sin(t * 0.52 + 1.2) * 2.8; // same period, offset phase

      // Beam angle tracks cursor X — left beam leans toward cursor, right mirrors
      // Sway is additively blended with cursor influence
      if (beamLRef.current)
        beamLRef.current.style.transform =
          'skewX(' + (-14 + cx * 14 + swayL).toFixed(2) + 'deg) rotate(' + (cx * 7 + swayL * 0.5).toFixed(2) + 'deg)';
      if (beamRRef.current)
        beamRRef.current.style.transform =
          'skewX(' + (14 - cx * 14 - swayR).toFixed(2) + 'deg) rotate(' + (-cx * 7 - swayR * 0.5).toFixed(2) + 'deg)';

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  // Click anywhere on background -> stadium-ring shockwave ripple
  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if ((e.target as Element).closest('.db-outer-card')) return;
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const id = ++rippleIdRef.current;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(rp => rp.id !== id)), 1800);
  }, []);

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

        @keyframes bulbPulse {
          0%, 100% { opacity: 0.85; }
          50%       { opacity: 1; }
        }
        /* Click shockwave — stadium ellipse expands from click point */
        @keyframes rippleExpand {
          0%   { transform: scale(0.02); opacity: 1; }
          60%  { opacity: 0.5; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes flashFade {
          0%   { opacity: 1; transform: scale(0.5); }
          100% { opacity: 0; transform: scale(3); }
        }

        @media (prefers-reduced-motion: no-preference) {
          .db-floodlight-sweep {
            animation: floodlightSweep 3.8s cubic-bezier(0.4,0,0.2,1) 0.3s 1 forwards;
          }
          .db-bulb      { animation: bulbPulse 4s ease-in-out infinite; }
          .db-bulb-halo { animation: bulbPulse 4s ease-in-out infinite; }
          .db-ripple-1 {
            animation: rippleExpand 1.6s cubic-bezier(0.1,0,0.25,1) forwards;
            transform-origin: 0 0;
          }
          .db-ripple-2 {
            animation: rippleExpand 1.6s cubic-bezier(0.1,0,0.25,1) 0.2s both;
            transform-origin: 0 0;
          }
          .db-ripple-3 {
            animation: rippleExpand 1.6s cubic-bezier(0.1,0,0.25,1) 0.42s both;
            transform-origin: 0 0;
          }
          .db-ripple-flash {
            animation: flashFade 0.45s ease-out forwards;
            transform-origin: 0 0;
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

      <div
        style={styles.root}
        ref={rootRef}
        onClick={handlePageClick}
        className="db-root"
        suppressHydrationWarning
      >
        {/* Cursor spotlight — stays in root space (not parallaxed), GPU-accelerated */}
        <div ref={spotRef} style={styles.spotlight} aria-hidden="true" />

        {/* Background layer — gets parallax transform via ref */}
        <div ref={bgLayerRef} style={styles.bgLayer} aria-hidden="true">

          {/* Left beam — transformOrigin top-left, tracks cursor via ref */}
          <div ref={beamLRef} style={{
            position: 'absolute', top: '-8%', left: '-8%',
            width: '65%', height: '110%',
            background: 'linear-gradient(145deg, rgba(251,191,36,0.32) 0%, rgba(251,191,36,0.14) 35%, rgba(251,191,36,0.04) 60%, transparent 78%)',
            filter: 'blur(28px)', pointerEvents: 'none',
            transform: 'skewX(-14deg)',
            transformOrigin: '8% 0%',
          }} className="db-beam-side" />

          {/* Right beam — transformOrigin top-right, tracks cursor via ref */}
          <div ref={beamRRef} style={{
            position: 'absolute', top: '-8%', right: '-8%',
            width: '60%', height: '110%',
            background: 'linear-gradient(215deg, rgba(251,191,36,0.28) 0%, rgba(251,191,36,0.12) 35%, rgba(251,191,36,0.04) 60%, transparent 78%)',
            filter: 'blur(28px)', pointerEvents: 'none',
            transform: 'skewX(14deg)',
            transformOrigin: '92% 0%',
          }} className="db-beam-side" />

          {/* One-shot sweep on load */}
          <div className="db-floodlight-sweep" style={{
            position: 'absolute', top: '-12%', left: '5%',
            width: '50%', height: '120%',
            background: 'linear-gradient(155deg, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0.22) 28%, rgba(251,191,36,0.06) 55%, transparent 72%)',
            filter: 'blur(22px)', opacity: 0, pointerEvents: 'none',
          }} />

          {/* Stadium SVG */}
          <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -42%)',
              width: '140%', maxWidth: '1100px', height: 'auto',
              pointerEvents: 'none', overflow: 'visible',
            }} aria-hidden="true">
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
            <g className="db-rings-group">
              <ellipse cx="400" cy="356" rx="196" ry="92"  fill="none" stroke="rgba(255,255,255,0.60)" strokeWidth="2" />
              <ellipse cx="400" cy="350" rx="248" ry="118" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="1.8" />
              <ellipse cx="400" cy="344" rx="302" ry="146" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" />
              <ellipse cx="400" cy="337" rx="358" ry="175" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" className="db-stadium-ring-outer" />
              <ellipse cx="400" cy="329" rx="416" ry="206" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1"   className="db-stadium-ring-outer" />
              <ellipse cx="400" cy="320" rx="476" ry="238" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1"   className="db-stadium-ring-outer" />
              <ellipse cx="400" cy="344" rx="302" ry="146" fill="url(#tierFill)" />
            </g>
            <path d="M 20 290 Q 400 80 780 290"  fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" className="db-stadium-ring-outer" />
            <path d="M 55 300 Q 400 112 745 300" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" className="db-stadium-ring-outer" />
            <line x1="72"  y1="72" x2="108" y2="220" stroke="rgba(251,191,36,0.55)" strokeWidth="2.5" />
            <ellipse cx="72"  cy="68" rx="18" ry="18" fill="url(#mastGlowL)" className="db-bulb-halo" />
            <circle cx="72"  cy="72" r="5"  fill="rgba(251,191,36,0.95)" className="db-bulb" />
            <circle cx="72"  cy="72" r="10" fill="rgba(251,191,36,0.25)" className="db-bulb-halo" />
            <path d="M 72 72 L 200 310 L 108 280 Z" fill="rgba(251,191,36,0.06)" />
            <line x1="728" y1="72" x2="692" y2="220" stroke="rgba(251,191,36,0.55)" strokeWidth="2.5" />
            <ellipse cx="728" cy="68" rx="18" ry="18" fill="url(#mastGlowR)" className="db-bulb-halo" />
            <circle cx="728" cy="72" r="5"  fill="rgba(251,191,36,0.95)" className="db-bulb" />
            <circle cx="728" cy="72" r="10" fill="rgba(251,191,36,0.25)" className="db-bulb-halo" />
            <path d="M 728 72 L 600 310 L 692 280 Z" fill="rgba(251,191,36,0.06)" />
          </svg>
        </div>

        {/* Click ripples — root space, between bg (z:0) and card (z:1) */}
        {ripples.map(r => (
          <div key={r.id} style={{
            position: 'absolute',
            left: r.x, top: r.y,
            width: 0, height: 0,
            zIndex: 0, pointerEvents: 'none',
          }}>
            <svg width="0" height="0" style={{ overflow: 'visible' }} aria-hidden="true">
              <ellipse cx="0" cy="0" rx="260" ry="130" fill="none"
                stroke="rgba(251,191,36,0.70)" strokeWidth="2.5" className="db-ripple-1" />
              <ellipse cx="0" cy="0" rx="260" ry="130" fill="none"
                stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" className="db-ripple-2" />
              <ellipse cx="0" cy="0" rx="260" ry="130" fill="none"
                stroke="rgba(251,191,36,0.28)" strokeWidth="1"   className="db-ripple-3" />
              <circle cx="0" cy="0" r="8"
                fill="rgba(251,191,36,0.95)" className="db-ripple-flash" />
            </svg>
          </div>
        ))}

        {/* Card — subtle parallax via outerCardRef */}
        <div ref={outerCardRef} style={styles.outerCard} className="db-outer-card">
          <div style={styles.card} className="db-card" suppressHydrationWarning>

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
                <div style={{ minWidth: 0 }}>
                  <h1 style={styles.title} className="db-brand-title">StadiumSetu</h1>
                  {displayName && (
                    <div style={styles.userRow}>
                      <div style={styles.avatar} aria-hidden="true">{displayName.charAt(0)}</div>
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
              <button onClick={handleSignOut} style={styles.headerSignOut} className="db-signout">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true" style={{ flexShrink: 0 }}>
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
    cursor: 'crosshair',
  },
  // Cursor spotlight — stays in root space (not affected by bg parallax)
  // Positioned via transform in the RAF loop for GPU compositing
  spotlight: {
    position: 'absolute',
    left: 0, top: 0,
    width: '480px', height: '480px',
    background: 'radial-gradient(circle, rgba(251,191,36,0.11) 0%, rgba(251,191,36,0.05) 35%, transparent 70%)',
    filter: 'blur(10px)',
    pointerEvents: 'none',
    zIndex: 0,
    opacity: 0,
    willChange: 'transform',
    transform: 'translate(-1000px, -1000px)',
    transition: 'opacity 0.5s ease',
  },
  bgLayer: {
    position: 'absolute',
    top: '-60px',
    bottom: '-60px',
    left: '-60px',
    right: '-60px',
    pointerEvents: 'none',
    zIndex: 0,
    overflow: 'hidden',
    willChange: 'transform',
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
    willChange: 'transform',
    cursor: 'default',
  },
  card: { width: '100%', padding: '2rem', boxSizing: 'border-box' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '2rem', paddingBottom: '1.5rem',
    borderBottom: '1px solid transparent',
    backgroundImage: 'linear-gradient(90deg, rgba(251,191,36,0.18) 0%, rgba(255,255,255,0.07) 40%, transparent 100%)',
    backgroundSize: '100% 1px', backgroundPosition: '0 100%', backgroundRepeat: 'no-repeat',
    gap: '0.75rem',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: 1 },
  logo: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '48px', height: '48px',
    background: 'linear-gradient(135deg, rgba(109,112,255,0.20) 0%, rgba(99,102,241,0.10) 60%, rgba(80,84,220,0.16) 100%)',
    border: '1px solid rgba(139,92,246,0.35)', borderRadius: '14px', flexShrink: 0,
    boxShadow: '0 0 0 1px rgba(99,102,241,0.12), 0 0 12px 3px rgba(99,102,241,0.18), 0 0 28px 6px rgba(139,92,246,0.10), inset 0 1px 0 rgba(180,182,255,0.18)',
  },
  title: { fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em', margin: '0 0 0.25rem', whiteSpace: 'nowrap', color: '#e2e8f0' },
  userRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  avatar: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '18px', height: '18px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0',
    flexShrink: 0, boxShadow: '0 0 6px rgba(99,102,241,0.45)',
  },
  subtitle: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    fontSize: '0.8rem', color: '#64748b', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap',
  },
  nameHighlight: { color: '#c4b5fd', fontWeight: 600 },
  statusDot: {
    display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%',
    background: '#22c55e', flexShrink: 0, boxShadow: '0 0 4px rgba(34,197,94,0.7)',
  },
  statusText: { fontSize: '0.7rem', color: '#4ade80', fontWeight: 500, letterSpacing: '0.04em' },
  headerSignOut: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '8px', color: '#94a3b8', padding: '0.4rem 0.75rem',
    fontSize: '0.73rem', fontWeight: 500, cursor: 'pointer',
    transition: 'all 0.2s ease', flexShrink: 0, whiteSpace: 'nowrap', letterSpacing: '0.02em',
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
    transform: 'scale(1.025) translateY(-2px)',
    background: 'rgba(22,163,74,0.08)',
    border: '1px solid rgba(22,163,74,0.30)', borderLeft: '3px solid #16a34a',
    boxShadow: '0 0 0 1px rgba(22,163,74,0.14), 0 12px 40px rgba(22,163,74,0.15), 0 4px 16px rgba(22,163,74,0.10)',
  },
  featureTitle: { fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.4rem' },
  featureDesc: { fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.4 },
};
