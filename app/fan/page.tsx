'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

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

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll to bottom whenever messages change */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

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
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'Something went wrong — please try again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
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
      {/* ── Keyframes ─────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }

        .fan-msg { animation: fadeSlideUp 0.25s ease both; }

        .fan-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
                   background: #818cf8; margin: 0 2px; animation: dotBounce 1.2s infinite ease-in-out; }
        .fan-dot:nth-child(2) { animation-delay: 0.2s; }
        .fan-dot:nth-child(3) { animation-delay: 0.4s; }

        .fan-send-btn:hover:not(:disabled) {
          background: #4f46e5 !important;
          transform: scale(1.04);
        }
        .fan-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .fan-view3d:hover {
          background: rgba(99,102,241,0.25) !important;
          border-color: rgba(99,102,241,0.5) !important;
        }

        .fan-back:hover {
          background: rgba(255,255,255,0.09) !important;
          color: #e2e8f0 !important;
        }

        /* thin custom scrollbar for message list */
        .fan-scroll::-webkit-scrollbar { width: 4px; }
        .fan-scroll::-webkit-scrollbar-track { background: transparent; }
        .fan-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }
      `}</style>

      <div style={styles.root}>
        {/* ── Outer card ────────────────────────────────────────────────── */}
        <div style={styles.card}>

          {/* ── Top nav ──────────────────────────────────────────────────── */}
          <div style={styles.topNav}>
            <Link href="/dashboard" style={styles.backButton} className="fan-back">
              ← Back to Dashboard
            </Link>
          </div>

          {/* ── Header ───────────────────────────────────────────────────── */}
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
              <h1 style={styles.title}>Find Your Seat</h1>
              <p style={styles.subtitle}>Chat with your stadium assistant</p>
            </div>
          </div>

          {/* ── Message list ─────────────────────────────────────────────── */}
          <div style={styles.messageList} className="fan-scroll">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="fan-msg"
                style={{
                  ...styles.messageRow,
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{ maxWidth: '85%' }}>
                  {/* Bubble */}
                  <div
                    style={
                      msg.role === 'user'
                        ? styles.userBubble
                        : styles.assistantBubble
                    }
                  >
                    {msg.text}
                  </div>

                  {/* Section data card (only for assistant messages with sectionData) */}
                  {msg.role === 'assistant' && msg.sectionData && (
                    <div style={styles.infoCard}>
                      <div style={styles.infoCardHeader}>
                        <span style={styles.infoCardSection}>
                          Section {msg.sectionData.section_number}
                        </span>
                      </div>
                      <div style={styles.infoCardDetails}>
                        <div style={styles.infoDetail}>
                          <span style={styles.infoLabel}>Tier</span>
                          <span style={styles.infoValue}>{msg.sectionData.tier}</span>
                        </div>
                        <div style={styles.infoDetail}>
                          <span style={styles.infoLabel}>Nearest Gate</span>
                          <span style={styles.infoValue}>{msg.sectionData.gate?.name || 'Unknown'}</span>
                        </div>
                      </div>
                      <Link href={`/fan/3d?section=${encodeURIComponent(msg.sectionData.section_number)}`} style={styles.view3dBtn} className="fan-view3d">
                        🏟️ View in 3D
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing / loading indicator */}
            {loading && (
              <div className="fan-msg" style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
                <div style={styles.assistantBubble}>
                  <span className="fan-dot" />
                  <span className="fan-dot" />
                  <span className="fan-dot" />
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ────────────────────────────────────────────────── */}
          <div style={styles.inputBar}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your section or question…"
              disabled={loading}
              style={styles.chatInput}
              autoFocus
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={styles.sendButton}
              className="fan-send-btn"
              aria-label="Send message"
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

/* ─── Styles ─────────────────────────────────────────────────────────────── */

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

  /* Main card — taller to give the chat room to breathe */
  card: {
    width: '100%',
    maxWidth: '520px',
    height: 'min(680px, 90vh)',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '0',
  },

  topNav: {
    padding: '1.25rem 1.5rem 0',
  },

  backButton: {
    display: 'inline-block',
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 500,
    padding: '0.4rem 0.8rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.5rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },

  logo: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '12px',
    flexShrink: 0,
  },

  title: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 0.15rem',
  },

  subtitle: {
    fontSize: '0.775rem',
    color: '#64748b',
    margin: 0,
  },

  /* Scrollable message area */
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem 1.25rem 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },

  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
  },

  /* User bubble */
  userBubble: {
    background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
    color: '#ffffff',
    borderRadius: '18px 18px 4px 18px',
    padding: '0.65rem 1rem',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
    wordBreak: 'break-word',
  },

  /* Assistant bubble */
  assistantBubble: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: '#e2e8f0',
    borderRadius: '18px 18px 18px 4px',
    padding: '0.65rem 1rem',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    wordBreak: 'break-word',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },

  /* Compact section info card beneath assistant message */
  infoCard: {
    marginTop: '0.5rem',
    background: 'rgba(99,102,241,0.06)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: '12px',
    padding: '0.85rem 1rem',
  },

  infoCardHeader: {
    marginBottom: '0.6rem',
  },

  infoCardSection: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#c7d2fe',
  },

  infoCardDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    marginBottom: '0.75rem',
  },

  infoDetail: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  infoLabel: {
    color: '#64748b',
    fontSize: '0.8rem',
  },

  infoValue: {
    color: '#f8fafc',
    fontSize: '0.85rem',
    fontWeight: 500,
  },

  view3dBtn: {
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
  },

  /* Input row fixed at bottom */
  inputBar: {
    padding: '0.875rem 1.25rem',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.2)',
    flexShrink: 0,
  },

  chatInput: {
    flex: 1,
    padding: '0.65rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#f1f5f9',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },

  sendButton: {
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
  },
};
