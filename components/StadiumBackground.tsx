'use client';

import { useEffect, useRef } from 'react';

export default function StadiumBackground() {
  const bgLayerRef = useRef<HTMLDivElement>(null);
  const beamLRef   = useRef<HTMLDivElement>(null);
  const beamRRef   = useRef<HTMLDivElement>(null);
  const spotRef    = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const tgt = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const onMove = (e: MouseEvent) => {
      const el = bgLayerRef.current?.parentElement;
      if (!el) return;
      const r = el.getBoundingClientRect();
      tgt.current = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 };
      if (spotRef.current) {
        spotRef.current.style.transform = `translate(${e.clientX - r.left - 300}px, ${e.clientY - r.top - 300}px)`;
        spotRef.current.style.opacity = '1';
      }
    };
    const tick = () => {
      const cx = lerp(cur.current.x, tgt.current.x, 0.07);
      const cy = lerp(cur.current.y, tgt.current.y, 0.07);
      cur.current = { x: cx, y: cy };
      if (bgLayerRef.current) bgLayerRef.current.style.transform = `translate(${(cx * 20).toFixed(1)}px, ${(cy * 12).toFixed(1)}px)`;
      const t = performance.now() / 1000;
      const swayL = Math.sin(t * 0.52) * 3.5;
      const swayR = Math.sin(t * 0.52 + 1.2) * 3.5;
      if (beamLRef.current) beamLRef.current.style.transform = `skewX(${(-14 + cx * 14 + swayL).toFixed(2)}deg) rotate(${(cx * 7 + swayL * 0.5).toFixed(2)}deg)`;
      if (beamRRef.current) beamRRef.current.style.transform = `skewX(${(14 - cx * 14 - swayR).toFixed(2)}deg) rotate(${(-cx * 7 - swayR * 0.5).toFixed(2)}deg)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    rafRef.current = requestAnimationFrame(tick);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes sb-sweep { 0%{opacity:0;transform:translateX(-40%) skewX(-10deg)} 12%{opacity:1} 75%{opacity:0.9} 100%{opacity:0;transform:translateX(80%) skewX(-10deg)} }
        @keyframes sb-bulb  { 0%,100%{opacity:0.8} 50%{opacity:1} }
        @keyframes sb-pitch { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes sb-bloom { 0%,100%{opacity:0.55;transform:translateX(-50%) scale(1)} 50%{opacity:0.85;transform:translateX(-50%) scale(1.1)} }
        @media (prefers-reduced-motion: no-preference) {
          .sb-sweep  { animation: sb-sweep 3.8s cubic-bezier(0.4,0,0.2,1) 0.3s 1 forwards; }
          .sb-bulb   { animation: sb-bulb  3s ease-in-out infinite; }
          .sb-halo   { animation: sb-bulb  3s ease-in-out infinite; }
          .sb-pitch  { animation: sb-pitch 4s ease-in-out infinite; }
          .sb-bloom  { animation: sb-bloom 6s ease-in-out infinite; }
        }
      `}</style>

      {/* Green pitch ambient bloom */}
      <div className="sb-bloom" aria-hidden="true" style={{
        position:'absolute', bottom:'-5%', left:'50%', transform:'translateX(-50%)',
        width:'75%', height:'55%',
        background:'radial-gradient(ellipse at center bottom, rgba(34,197,94,0.25) 0%, rgba(22,163,74,0.12) 40%, transparent 70%)',
        filter:'blur(45px)', pointerEvents:'none', zIndex:0,
      }}/>

      {/* Amber overhead bloom */}
      <div aria-hidden="true" style={{
        position:'absolute', top:'-8%', left:'50%', transform:'translateX(-50%)',
        width:'100%', height:'50%',
        background:'radial-gradient(ellipse at center top, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.09) 50%, transparent 75%)',
        filter:'blur(40px)', pointerEvents:'none', zIndex:0,
      }}/>

      {/* Mouse spotlight */}
      <div ref={spotRef} aria-hidden="true" style={{
        position:'absolute', left:0, top:0, width:'600px', height:'600px',
        background:'radial-gradient(circle, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.07) 30%, transparent 65%)',
        filter:'blur(14px)', pointerEvents:'none', zIndex:0,
        opacity:0, willChange:'transform', transform:'translate(-1000px,-1000px)', transition:'opacity 0.4s ease',
      }}/>

      {/* Parallax container */}
      <div ref={bgLayerRef} aria-hidden="true" style={{
        position:'absolute', top:'-60px', bottom:'-60px', left:'-60px', right:'-60px',
        pointerEvents:'none', zIndex:0, overflow:'hidden', willChange:'transform',
      }}>
        {/* Left beam */}
        <div ref={beamLRef} style={{
          position:'absolute', top:'-10%', left:'-5%', width:'62%', height:'115%',
          background:'linear-gradient(150deg, rgba(251,191,36,0.58) 0%, rgba(251,191,36,0.30) 22%, rgba(251,191,36,0.12) 50%, transparent 72%)',
          filter:'blur(22px)', pointerEvents:'none', transform:'skewX(-14deg)', transformOrigin:'8% 0%',
        }}/>
        {/* Right beam */}
        <div ref={beamRRef} style={{
          position:'absolute', top:'-10%', right:'-5%', width:'58%', height:'115%',
          background:'linear-gradient(210deg, rgba(251,191,36,0.52) 0%, rgba(251,191,36,0.26) 22%, rgba(251,191,36,0.10) 50%, transparent 72%)',
          filter:'blur(22px)', pointerEvents:'none', transform:'skewX(14deg)', transformOrigin:'92% 0%',
        }}/>
        {/* Load sweep */}
        <div className="sb-sweep" style={{
          position:'absolute', top:'-12%', left:'5%', width:'55%', height:'120%',
          background:'linear-gradient(155deg, rgba(251,191,36,0.70) 0%, rgba(251,191,36,0.32) 28%, rgba(251,191,36,0.10) 55%, transparent 72%)',
          filter:'blur(16px)', opacity:0, pointerEvents:'none',
        }}/>

        {/* SVG stadium scene */}
        <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{
          position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -44%)',
          width:'155%', maxWidth:'1250px', height:'auto', pointerEvents:'none', overflow:'visible',
        }}>
          <defs>
            <radialGradient id="sb-pg" cx="50%" cy="58%" r="32%">
              <stop offset="0%"  stopColor="#22c55e" stopOpacity="0.70"/>
              <stop offset="40%" stopColor="#16a34a" stopOpacity="0.30"/>
              <stop offset="100%" stopColor="#0a0e1a" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="sb-tf" cx="50%" cy="58%" r="60%">
              <stop offset="0%"  stopColor="rgba(255,255,255,0)"/>
              <stop offset="55%" stopColor="rgba(255,255,255,0.06)"/>
              <stop offset="100%" stopColor="rgba(255,255,255,0.10)"/>
            </radialGradient>
            <radialGradient id="sb-ml" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#fbbf24" stopOpacity="1.0"/>
              <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.40"/>
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="sb-mr" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#fbbf24" stopOpacity="1.0"/>
              <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.40"/>
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
            </radialGradient>
            <filter id="sb-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Pitch */}
          <ellipse cx="400" cy="360" rx="175" ry="80" fill="url(#sb-pg)" className="sb-pitch"/>
          <ellipse cx="400" cy="360" rx="155" ry="62" fill="none" stroke="rgba(34,197,94,0.75)" strokeWidth="2"/>
          <ellipse cx="400" cy="360" rx="38"  ry="18" fill="none" stroke="rgba(34,197,94,0.55)" strokeWidth="1.3"/>
          <line x1="245" y1="360" x2="555" y2="360" stroke="rgba(34,197,94,0.50)" strokeWidth="1.3"/>
          <circle cx="400" cy="360" r="5" fill="rgba(34,197,94,0.65)"/>

          {/* Tier rings */}
          <ellipse cx="400" cy="356" rx="196" ry="92"  fill="none" stroke="rgba(255,255,255,0.80)" strokeWidth="2.5"/>
          <ellipse cx="400" cy="350" rx="248" ry="118" fill="none" stroke="rgba(255,255,255,0.62)" strokeWidth="2.2"/>
          <ellipse cx="400" cy="344" rx="302" ry="146" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="2.0"/>
          <ellipse cx="400" cy="337" rx="358" ry="175" fill="none" stroke="rgba(255,255,255,0.33)" strokeWidth="1.5"/>
          <ellipse cx="400" cy="329" rx="416" ry="206" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.3"/>
          <ellipse cx="400" cy="320" rx="476" ry="238" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.1"/>
          <ellipse cx="400" cy="344" rx="302" ry="146" fill="url(#sb-tf)"/>

          {/* Roof arcs */}
          <path d="M 20 290 Q 400 80 780 290"  fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="2.4"/>
          <path d="M 55 300 Q 400 112 745 300" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.4"/>

          {/* Dashed structural spokes */}
          <line x1="72" y1="72" x2="200" y2="290" stroke="rgba(251,191,36,0.22)" strokeWidth="1" strokeDasharray="4 6"/>
          <line x1="728" y1="72" x2="600" y2="290" stroke="rgba(251,191,36,0.22)" strokeWidth="1" strokeDasharray="4 6"/>

          {/* Left mast */}
          <line x1="72" y1="72" x2="108" y2="220" stroke="rgba(251,191,36,0.85)" strokeWidth="3"/>
          <ellipse cx="72" cy="65" rx="32" ry="32" fill="url(#sb-ml)" className="sb-halo"/>
          <circle  cx="72" cy="72" r="7"  fill="rgba(255,240,110,1.0)" className="sb-bulb" filter="url(#sb-glow)"/>
          <circle  cx="72" cy="72" r="16" fill="rgba(251,191,36,0.40)" className="sb-halo"/>
          <path d="M 72 72 L 175 345 L 108 305 Z" fill="rgba(251,191,36,0.13)"/>
          <path d="M 72 72 L 255 368 L 165 338 Z" fill="rgba(251,191,36,0.07)"/>

          {/* Right mast */}
          <line x1="728" y1="72" x2="692" y2="220" stroke="rgba(251,191,36,0.85)" strokeWidth="3"/>
          <ellipse cx="728" cy="65" rx="32" ry="32" fill="url(#sb-mr)" className="sb-halo"/>
          <circle  cx="728" cy="72" r="7"  fill="rgba(255,240,110,1.0)" className="sb-bulb" filter="url(#sb-glow)"/>
          <circle  cx="728" cy="72" r="16" fill="rgba(251,191,36,0.40)" className="sb-halo"/>
          <path d="M 728 72 L 625 345 L 692 305 Z" fill="rgba(251,191,36,0.13)"/>
          <path d="M 728 72 L 545 368 L 635 338 Z" fill="rgba(251,191,36,0.07)"/>

          {/* Crowd suggestion dots */}
          {[...Array(22)].map((_,i) => {
            const a = (i/22)*Math.PI*2;
            return <circle key={i} cx={400+232*Math.cos(a)} cy={352+106*Math.sin(a)*0.52} r="2.8" fill={`rgba(255,255,255,${0.10+(i%3)*0.05})`}/>;
          })}
        </svg>
      </div>
    </>
  );
}
