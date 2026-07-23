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
  const [fbHovered, setFbHovered] = useState(false);
  const [fbSpinning, setFbSpinning] = useState(false);

  const handleFbClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // don't trigger page ripple
    if (fbSpinning) return;
    setFbSpinning(true);
    setTimeout(() => setFbSpinning(false), 620);
  }, [fbSpinning]);

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
        /* Football animations */
        @keyframes fbFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-7px) rotate(4deg); }
        }
        @keyframes fbBounce {
          0%   { transform: translateY(0) scaleX(1) scaleY(1); }
          20%  { transform: translateY(-14px) scaleX(0.92) scaleY(1.08); }
          40%  { transform: translateY(-20px) scaleX(0.95) scaleY(1.05); }
          60%  { transform: translateY(-8px) scaleX(1.05) scaleY(0.96); }
          75%  { transform: translateY(0px) scaleX(1.08) scaleY(0.94); }
          88%  { transform: translateY(-4px) scaleX(0.98) scaleY(1.02); }
          100% { transform: translateY(0) scaleX(1) scaleY(1); }
        }
        @keyframes fbSpin {
          0%   { transform: rotate(0deg) scale(1); }
          15%  { transform: rotate(90deg) scale(1.08); }
          50%  { transform: rotate(200deg) scale(1.04); }
          80%  { transform: rotate(330deg) scale(1.02); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes fbShadowBounce {
          0%, 100% { transform: scaleX(1); opacity: 0.45; }
          40%       { transform: scaleX(0.65); opacity: 0.2; }
          75%       { transform: scaleX(1.15); opacity: 0.55; }
        }
        @keyframes fbShadowSpin {
          0%, 100% { transform: scaleX(1);    opacity: 0.45; }
          25%       { transform: scaleX(0.7);  opacity: 0.25; }
          50%       { transform: scaleX(0.5);  opacity: 0.15; }
          75%       { transform: scaleX(0.7);  opacity: 0.25; }
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
          /* Football idle/interaction states */
          .db-football-idle   { animation: fbFloat 5s ease-in-out infinite; }
          .db-football-bounce { animation: fbBounce 400ms cubic-bezier(0.36,0.07,0.19,0.97) both; }
          .db-football-spin   { animation: fbSpin 580ms cubic-bezier(0.25,0.46,0.45,0.94) both; }
          .db-fb-shadow-idle   { animation: fbFloat 5s ease-in-out infinite; }
          .db-fb-shadow-bounce { animation: fbShadowBounce 400ms cubic-bezier(0.36,0.07,0.19,0.97) both; }
          .db-fb-shadow-spin   { animation: fbShadowSpin 580ms cubic-bezier(0.25,0.46,0.45,0.94) both; }
        }

        .db-header  { animation: fadeUp 0.45s ease both; animation-delay: 0ms; }
        .db-welcome { animation: fadeUp 0.45s ease both; animation-delay: 90ms; }
        .db-card-0  { animation: fadeUp 0.45s ease both; animation-delay: 180ms; }
        .db-card-1  { animation: fadeUp 0.45s ease both; animation-delay: 270ms; }
        .db-card-2  { animation: fadeUp 0.45s ease both; animation-delay: 360ms; }
        .db-hiw     { animation: fadeUp 0.45s ease both; animation-delay: 440ms; }
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
        /* Football hover cursor */
        .db-football-wrap { cursor: pointer; }
        .db-football-wrap:focus-visible { outline: 2px solid #fbbf24; outline-offset: 6px; border-radius: 50%; }
        /* How it works step hover */
        .db-step:hover .db-step-badge {
          background: rgba(251,191,36,0.18) !important;
          border-color: rgba(251,191,36,0.5) !important;
          color: #fbbf24 !important;
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
          .db-football-wrap { display: none; }
          .db-hiw-steps { flex-direction: column !important; gap: 0.75rem !important; }
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

        {/* Football accent — floats in root space, above bg (z:1), below card (z:2) */}
        <div
          className={`db-football-wrap`}
          onClick={handleFbClick}
          onMouseEnter={() => setFbHovered(true)}
          onMouseLeave={() => setFbHovered(false)}
          role="img"
          aria-label="Football"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && handleFbClick(e as any)}
          style={{
            position: 'absolute',
            top: 'calc(50% - 260px)',
            left: 'calc(50% - 380px)',
            zIndex: 1,
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {/* Shadow ellipse beneath ball */}
          <div
            className={
              fbSpinning ? 'db-fb-shadow-spin'
              : fbHovered ? 'db-fb-shadow-bounce'
              : 'db-fb-shadow-idle'
            }
            style={{
              width: '42px', height: '10px',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 80%)',
              borderRadius: '50%',
              margin: '0 auto',
              transformOrigin: 'center center',
            }}
          />
          {/* Football SVG */}
          <div
            className={
              fbSpinning ? 'db-football-spin'
              : fbHovered ? 'db-football-bounce'
              : 'db-football-idle'
            }
            style={{ marginTop: '-8px' }}
          >
            <svg
              width="48" height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              style={{
                filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.65)) drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
              }}
            >
              <defs>
                <radialGradient id="fbGrad" cx="38%" cy="32%" r="58%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                  <stop offset="55%" stopColor="#e8e4df" stopOpacity="0" />
                  <stop offset="100%" stopColor="#b0aba5" stopOpacity="0.35" />
                </radialGradient>
              </defs>
              {/* Ball body */}
              <circle cx="24" cy="24" r="22" fill="#f0ede8" />
              {/* Subtle sphere shading */}
              <circle cx="24" cy="24" r="22" fill="url(#fbGrad)" />
              {/* Outer ring */}
              <circle cx="24" cy="24" r="22" fill="none" stroke="#2a2a2a" strokeWidth="1.2" />
              {/* Center pentagon */}
              <polygon
                points="24,14.5 28.8,18.4 27,24 21,24 19.2,18.4"
                fill="#1a1a1a"
                stroke="#1a1a1a" strokeWidth="0.4"
              />
              {/* Top pentagon */}
              <polygon
                points="24,3.2 30.6,7.8 28.8,16.4 24,14.2 19.2,16.4 17.4,7.8"
                fill="none" stroke="#1a1a1a" strokeWidth="1.1"
              />
              {/* Top-left pentagon outline */}
              <polygon
                points="8.5,13.5 17.8,10.8 19.5,18.2 14,22.8 7,20"
                fill="none" stroke="#1a1a1a" strokeWidth="1.1"
              />
              {/* Bottom-left pentagon outline */}
              <polygon
                points="7,28 14,25.2 21,29.8 19.2,37.5 10.5,37.5"
                fill="none" stroke="#1a1a1a" strokeWidth="1.1"
              />
              {/* Bottom pentagon outline */}
              <polygon
                points="24,44.8 17.4,40.2 19.2,31.6 24,33.8 28.8,31.6 30.6,40.2"
                fill="none" stroke="#1a1a1a" strokeWidth="1.1"
              />
              {/* Bottom-right pentagon outline */}
              <polygon
                points="41,28 37,37.5 28.8,37.5 27,29.8 34,25.2"
                fill="none" stroke="#1a1a1a" strokeWidth="1.1"
              />
              {/* Top-right pentagon outline */}
              <polygon
                points="40.5,13.5 41,20 34,22.8 28.5,18.2 30.2,10.8"
                fill="none" stroke="#1a1a1a" strokeWidth="1.1"
              />
              {/* Seam lines connecting pentagons */}
              <line x1="24" y1="3.2"  x2="24" y2="14.5"  stroke="#1a1a1a" strokeWidth="0.9" />
              <line x1="19.2" y1="16.4" x2="14" y2="22.8" stroke="#1a1a1a" strokeWidth="0.9" />
              <line x1="21" y1="24" x2="14" y2="25.2"   stroke="#1a1a1a" strokeWidth="0.9" />
              <line x1="27" y1="24" x2="34" y2="25.2"   stroke="#1a1a1a" strokeWidth="0.9" />
              <line x1="28.8" y1="16.4" x2="34" y2="22.8" stroke="#1a1a1a" strokeWidth="0.9" />
              <line x1="19.2" y1="31.6" x2="14" y2="25.2" stroke="#1a1a1a" strokeWidth="0.9" />
              <line x1="28.8" y1="31.6" x2="34" y2="25.2" stroke="#1a1a1a" strokeWidth="0.9" />
              {/* Gloss highlight */}
              <ellipse cx="18" cy="15" rx="5" ry="3.2"
                fill="rgba(255,255,255,0.45)" style={{ filter: 'blur(1.5px)' }} />
            </svg>
          </div>
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
                Navigate seating, gates, and facilities across FIFA World Cup 2026 venues with our interactive fan and operations tools. Ask the AI assistant for turn-by-turn directions from any gate to your seat, or get instant answers about nearby concessions and facilities. Operations staff get a live real-time dashboard — crowd heatmaps, congestion alerts, and simulation tools — all in one place.
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

            {/* How it works */}
            <div style={styles.hiwSection} className="db-hiw">
              <p style={styles.hiwHeading}>HOW IT WORKS</p>
              <div style={styles.hiwSteps} className="db-hiw-steps">
                {([
                  { n: '1', icon: '🔐', title: 'Sign in', desc: 'Log in with your account to get started' },
                  { n: '2', icon: '💬', title: 'Ask the AI', desc: 'Tell the assistant your seat or section number' },
                  { n: '3', icon: '🗺️', title: 'See your path', desc: 'Follow the 3D gate-to-seat route in real time' },
                  { n: '4', icon: '📡', title: 'Ops monitors live', desc: 'Staff track crowd flow and alerts stadium-wide' },
                ] as { n: string; icon: string; title: string; desc: string }[]).map(step => (
                  <div key={step.n} style={styles.hiwStep} className="db-step">
                    <div style={styles.hiwBadge} className="db-step-badge">{step.n}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.hiwStepTitle}>{step.icon} {step.title}</div>
                      <div style={styles.hiwStepDesc}>{step.desc}</div>
                    </div>
                  </div>
                ))}
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
  // How it works
  hiwSection: {
    marginTop: '1.75rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  hiwHeading: {
    fontFamily: 'var(--font-geist-mono), "Geist Mono", monospace',
    fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em',
    textTransform: 'uppercase' as const, color: '#475569',
    margin: '0 0 1rem',
  },
  hiwSteps: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  hiwStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    flex: '1 1 calc(50% - 0.5rem)',
    minWidth: '140px',
    padding: '0.7rem 0.85rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.018)',
    border: '1px solid rgba(255,255,255,0.06)',
    transition: 'background 0.2s ease, border-color 0.2s ease',
    cursor: 'default',
  },
  hiwBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700,
    transition: 'all 0.2s ease',
  },
  hiwStepTitle: { fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.18rem' },
  hiwStepDesc: { fontSize: '0.74rem', color: '#475569', lineHeight: 1.35 },
};
