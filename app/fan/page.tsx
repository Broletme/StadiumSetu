'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import StadiumBackground from '@/components/StadiumBackground';

/* ─── Types ────────────────────────────────────────────────────────────── */

type SectionData = {
  section_number: string;
  tier: string;
  gate: {
    name: string;
    angle_deg: number;
    lat?: number | null;
    lng?: number | null;
  };
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sectionData?: SectionData | null;
};

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  text: "Hi! Tell me your section or seat number and I'll help you find your way. 👋",
};

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function FanPage() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slowServerNotice, setSlowServerNotice] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  /* Auto-scroll to bottom whenever messages change */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  /* Fetch chat history on load */
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/chat/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const history = await res.json();
          if (history && history.length > 0) {
            const formattedHistory: Message[] = history.map((msg: any, idx: number) => ({
              id: `hist-${idx}`,
              role: msg.role,
              text: msg.content,
              sectionData: msg.section_data ?? null,
            }));
            setMessages([GREETING, ...formattedHistory]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      }
    };
    fetchHistory();
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setSlowServerNotice(false);

    const warmTimer = setTimeout(() => setSlowServerNotice(true), 3500);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'No text');
        console.error('API Error:', res.status, errorText);
        throw new Error(`Non-200 response: ${res.status}`);
      }

      const data: { reply: string; sectionData: SectionData | null } = await res.json();

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        sectionData: data.sectionData ?? null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', text: 'Something went wrong — please try again.' },
      ]);
    } finally {
      clearTimeout(warmTimer);
      setSlowServerNotice(false);
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <>
      {/* ── Global styles for this page ─────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        @keyframes fan-fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fan-dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }

        .fan-msg { animation: fan-fadeSlideUp 0.25s ease both; }

        .fan-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: #818cf8; margin: 0 2px;
          animation: fan-dotBounce 1.2s infinite ease-in-out;
        }
        .fan-dot:nth-child(2) { animation-delay: 0.2s; }
        .fan-dot:nth-child(3) { animation-delay: 0.4s; }

        /* Thin custom scrollbar */
        .fan-scroll::-webkit-scrollbar { width: 4px; }
        .fan-scroll::-webkit-scrollbar-track { background: transparent; }
        .fan-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }

        /* Send button */
        .fan-send-btn:hover:not(:disabled) {
          background: #4f46e5 !important;
          transform: scale(1.04);
        }
        .fan-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* 3D link */
        .fan-view3d:hover {
          background: rgba(99,102,241,0.25) !important;
          border-color: rgba(99,102,241,0.5) !important;
        }

        /* Header bar amber glow (matching dashboard card) */
        .fan-header-bar {
          position: sticky;
          top: 0;
          z-index: 10;
          background: linear-gradient(180deg, rgba(6,10,18,0.92) 0%, rgba(5,9,16,0.86) 100%);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 1px 0 rgba(251,191,36,0.18),
            0 6px 32px rgba(0,0,0,0.6),
            0 0 0 1px rgba(251,191,36,0.05);
        }
        /* Amber rim on top of the sticky header */
        .fan-header-bar::before {
          content: '';
          position: absolute;
          top: 0; left: 8%; right: 8%; height: 1px;
          background: linear-gradient(90deg,
            transparent,
            rgba(251,191,36,0.4) 35%,
            rgba(255,255,255,0.2) 50%,
            rgba(251,191,36,0.3) 65%,
            transparent
          );
          pointer-events: none;
        }

        /* "Find Your Seat" amber headline (matching dashboard headline treatment) */
        .fan-title-gradient {
          background: linear-gradient(105deg, #e2e8f0 0%, #fde68a 55%, #fbbf24 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Back link hover */
        .fan-back:hover {
          background: rgba(255,255,255,0.09) !important;
          color: #e2e8f0 !important;
        }

        /* Input focus ring */
        .fan-chat-input:focus {
          border-color: rgba(99,102,241,0.5) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important;
          outline: none;
        }

        @media (max-width: 720px) {
          .fan-page-root { padding: 0.75rem !important; }
          .fan-chat-col  { max-width: 100% !important; height: min(640px, calc(100vh - 1.5rem)) !important; aspect-ratio: auto !important; border-radius: 16px !important; }
        }
      `}</style>

      {/*
        ── Page root ──────────────────────────────────────────────────────
        position: relative so StadiumBackground absolute-positions inside it.
        min-height: 100vh + overflow: hidden so background doesn't spill.
        The chat column is a flex child that fills the remaining space.
      */}
      <div
        className="fan-page-root"
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: 'linear-gradient(160deg, #06090f 0%, #080d18 50%, #050a10 100%)',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Stadium atmosphere (behind everything) ───────────────────── */}
        <StadiumBackground />

        {/*
          ── Chat column ──────────────────────────────────────────────────
          A vertically-stacked flex column inside a spacious 1:1 square glass box:
            1. header bar (fixed top inside card)
            2. scrollable message list (flex: 1, overflowY: auto inside card)
            3. input bar (fixed bottom inside card)
        */}
        <div
          className="fan-chat-col"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '680px',
            height: 'min(680px, 84vh)',
            aspectRatio: '1 / 1',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '24px',
            overflow: 'hidden',
            /* Frosted-glass panel — transparent enough to see the stadium */
            background: 'rgba(6,10,18,0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 35px rgba(99,102,241,0.18), inset 0 1px 0 rgba(251,191,36,0.15)',
          }}
        >
          {/* ── 1. Sticky header ─────────────────────────────────────── */}
          <div className="fan-header-bar">
            {/* Back link row */}
            <div style={{ padding: '0.9rem 1.25rem 0.6rem' }}>
              <Link
                href="/dashboard"
                className="fan-back"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#94a3b8',
                  textDecoration: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  padding: '0.35rem 0.75rem',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
              >
                ← Back to Dashboard
              </Link>
            </div>

            {/* Title row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.5rem 1.25rem 1rem',
              }}
            >
              {/* Logo */}
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '42px', height: '42px', flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(109,112,255,0.18) 0%, rgba(99,102,241,0.08) 100%)',
                  border: '1px solid rgba(139,92,246,0.30)',
                  borderRadius: '12px',
                  boxShadow: '0 0 12px 3px rgba(99,102,241,0.14), 0 0 0 1px rgba(99,102,241,0.08)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#fan-dg1)" />
                  <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.15)" />
                  <defs>
                    <linearGradient id="fan-dg1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6366f1" />
                      <stop offset="1" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div>
                <h1
                  className="fan-title-gradient"
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    margin: '0 0 0.15rem',
                  }}
                >
                  Find Your Seat
                </h1>
                <p style={{ fontSize: '0.75rem', color: '#4e5f78', margin: 0 }}>
                  Chat with your stadium assistant
                </p>
              </div>
            </div>
          </div>

          {/* ── 2. Scrollable message list ───────────────────────────── */}
          <div
            className="fan-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem 1.25rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="fan-msg"
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{ maxWidth: '85%' }}>
                  {/* Bubble */}
                  <div
                    style={
                      msg.role === 'user'
                        ? {
                            background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                            color: '#ffffff',
                            borderRadius: '18px 18px 4px 18px',
                            padding: '0.65rem 1rem',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
                            wordBreak: 'break-word',
                          }
                        : {
                            background: 'rgba(12,18,32,0.82)',
                            border: '1px solid rgba(255,255,255,0.13)',
                            color: '#e8edf6',
                            borderRadius: '18px 18px 18px 4px',
                            padding: '0.65rem 1rem',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            wordBreak: 'break-word',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            backdropFilter: 'blur(8px)',
                          }
                    }
                  >
                    {msg.text}
                  </div>

                  {/* Section data card */}
                  {msg.role === 'assistant' && msg.sectionData && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        background: 'rgba(10,16,30,0.85)',
                        border: '1px solid rgba(99,102,241,0.28)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      <div style={{ marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c7d2fe' }}>
                          Section {msg.sectionData.section_number}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Tier</span>
                          <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 500 }}>{msg.sectionData.tier}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Nearest Gate</span>
                          <span style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 500 }}>
                            {msg.sectionData.gate?.name || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/fan/3d?section=${encodeURIComponent(msg.sectionData.section_number)}`}
                        className="fan-view3d"
                        style={{
                          display: 'block',
                          textAlign: 'center',
                          padding: '0.5rem 1rem',
                          background: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: '8px',
                          color: '#a5b4fc',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          transition: 'background 0.2s, border-color 0.2s',
                        }}
                      >
                        🏟️ View in 3D
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing / loading indicator */}
            {loading && (
              <div
                className="fan-msg"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: '#e2e8f0',
                    borderRadius: '18px 18px 18px 4px',
                    padding: '0.65rem 1rem',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <span className="fan-dot" />
                  <span className="fan-dot" />
                  <span className="fan-dot" />
                </div>
                {slowServerNotice && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', paddingLeft: '4px' }}>
                    Waking up the server, please wait…
                  </span>
                )}
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} style={{ height: '0.25rem' }} />
          </div>

          {/* ── 3. Sticky input bar ──────────────────────────────────── */}
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              padding: '0.875rem 1.25rem',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              background: 'linear-gradient(180deg, rgba(8,12,22,0.88) 0%, rgba(6,10,18,0.96) 100%)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'center',
              flexShrink: 0,
              zIndex: 10,
            }}
          >
            <input
              ref={inputRef}
              className="fan-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your section or question…"
              disabled={loading}
              autoFocus
              style={{
                flex: 1,
                padding: '0.65rem 1rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '10px',
                color: '#f1f5f9',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="fan-send-btn"
              aria-label="Send message"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#6366f1',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s, transform 0.15s',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

