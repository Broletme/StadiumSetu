'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import StadiumBackground from '@/components/StadiumBackground';

/* ─── Types ─────────────────────────────────────────────────────────────── */

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

type Session = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  text: "Hi! Tell me your section or seat number and I'll help you find your way. 👋",
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function FanPage() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slowServerNotice, setSlowServerNotice] = useState(false);

  /* Sessions state */
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Auth helper ──────────────────────────────────────────────────────── */
  const getToken = useCallback(async (): Promise<string | null> => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  /* ── Auto-scroll ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, loading]);

  /* ── Load sessions on mount ───────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setSessionsLoading(true);
      try {
        const token = await getToken();
        if (!token) return;

        const res = await fetch(`${apiUrl}/chat/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: Session[] = await res.json();
          setSessions(data);
          // Auto-open the most recent session
          if (data.length > 0) {
            loadSession(data[0], token);
          }
        }
      } catch (e) {
        console.error('Failed to load sessions', e);
      } finally {
        setSessionsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load a session's messages ────────────────────────────────────────── */
  const loadSession = useCallback(
    async (session: Session, tokenOverride?: string) => {
      setActiveSessionId(session.id);
      setMessages([GREETING]);
      try {
        const token = tokenOverride ?? (await getToken());
        if (!token) return;

        const res = await fetch(`${apiUrl}/chat/sessions/${session.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const rows: any[] = await res.json();
          if (rows.length > 0) {
            const formatted: Message[] = rows.map((m, i) => ({
              id: `sess-${i}`,
              role: m.role,
              text: m.content,
              sectionData: m.section_data ?? null,
            }));
            setMessages([GREETING, ...formatted]);
          }
        }
      } catch (e) {
        console.error('Failed to load session messages', e);
      }
    },
    [apiUrl, getToken],
  );

  /* ── New chat ─────────────────────────────────────────────────────────── */
  const startNewChat = useCallback(async () => {
    setActiveSessionId(null);
    setMessages([GREETING]);
    setInput('');
    inputRef.current?.focus();
  }, []);

  /* ── Delete session ───────────────────────────────────────────────────── */
  const deleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setDeletingId(sessionId);
      try {
        const token = await getToken();
        if (!token) return;

        await fetch(`${apiUrl}/chat/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        // If we deleted the active session, start fresh
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([GREETING]);
        }
      } catch (e) {
        console.error('Failed to delete session', e);
      } finally {
        setDeletingId(null);
      }
    },
    [activeSessionId, apiUrl, getToken],
  );

  /* ── Send message ─────────────────────────────────────────────────────── */
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setSlowServerNotice(false);

    const warmTimer = setTimeout(() => setSlowServerNotice(true), 3500);

    try {
      const token = await getToken();

      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, sessionId: activeSessionId }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: { reply: string; sectionData: SectionData | null; sessionId: string } =
        await res.json();

      // If the server created a new session for us, register it
      if (data.sessionId && data.sessionId !== activeSessionId) {
        setActiveSessionId(data.sessionId);

        // Add it to the sessions list with a temporary title
        const tempTitle = text.length > 45 ? text.slice(0, 42).trimEnd() + '…' : text;
        const newSession: Session = {
          id: data.sessionId,
          title: tempTitle,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSessions((prev) => [newSession, ...prev]);
      } else if (data.sessionId && activeSessionId) {
        // Update updated_at so it floats to top
        setSessions((prev) =>
          prev
            .map((s) =>
              s.id === data.sessionId ? { ...s, updated_at: new Date().toISOString() } : s,
            )
            .sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            ),
        );
      }

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
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: 'Something went wrong — please try again.',
        },
      ]);
    } finally {
      clearTimeout(warmTimer);
      setSlowServerNotice(false);
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [activeSessionId, apiUrl, getToken, input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <>
      {/* ── Global styles ──────────────────────────────────────────────── */}
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
        @keyframes sidebar-slideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
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

        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 2px; }

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

        /* Header bar */
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

        .fan-title-gradient {
          background: linear-gradient(105deg, #e2e8f0 0%, #fde68a 55%, #fbbf24 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .fan-back:hover {
          background: rgba(255,255,255,0.09) !important;
          color: #e2e8f0 !important;
        }

        .fan-chat-input:focus {
          border-color: rgba(99,102,241,0.5) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important;
          outline: none;
        }

        /* Sidebar session item */
        .session-item {
          position: relative;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          border: 1px solid transparent;
        }
        .session-item:hover {
          background: rgba(99,102,241,0.1) !important;
          border-color: rgba(99,102,241,0.2) !important;
        }
        .session-item.active {
          background: rgba(99,102,241,0.16) !important;
          border-color: rgba(99,102,241,0.35) !important;
        }
        .session-delete-btn {
          opacity: 0;
          transition: opacity 0.15s, background 0.15s;
        }
        .session-item:hover .session-delete-btn {
          opacity: 1;
        }
        .session-delete-btn:hover {
          background: rgba(239,68,68,0.2) !important;
          color: #f87171 !important;
        }

        /* New chat button */
        .new-chat-btn {
          transition: background 0.15s, transform 0.12s;
        }
        .new-chat-btn:hover {
          background: rgba(99,102,241,0.25) !important;
          transform: translateY(-1px);
        }
        .new-chat-btn:active { transform: translateY(0); }

        /* Sidebar toggle button */
        .sidebar-toggle:hover {
          background: rgba(255,255,255,0.08) !important;
        }

        /* Skeleton loading */
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
          border-radius: 6px;
        }
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Sidebar animation */
        .fan-sidebar {
          animation: sidebar-slideIn 0.2s ease both;
        }

        @media (max-width: 720px) {
          .fan-page-root { padding: 0 !important; height: 100dvh !important; }
          .fan-outer-wrap { gap: 0 !important; border-radius: 0 !important; }
          .fan-chat-col { border-radius: 0 !important; height: 100dvh !important; }
          .fan-sidebar-wrap {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            z-index: 100;
            width: 280px !important;
            border-radius: 0 16px 16px 0 !important;
          }
          .fan-sidebar-overlay {
            display: block !important;
          }
        }
      `}</style>

      <div
        className="fan-page-root"
        style={{
          position: 'relative',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          background: 'linear-gradient(160deg, #06090f 0%, #080d18 50%, #050a10 100%)',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Stadium atmosphere ─────────────────────────────────────── */}
        <StadiumBackground />

        {/* ── Mobile overlay (behind sidebar) ───────────────────────── */}
        {sidebarOpen && (
          <div
            className="fan-sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            style={{
              display: 'none', // shown via CSS media query on mobile
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 99,
              backdropFilter: 'blur(2px)',
            }}
          />
        )}

        {/* ── Outer flex container (sidebar + chat) ─────────────────── */}
        <div
          className="fan-outer-wrap"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: sidebarOpen ? '960px' : '680px',
            height: 'calc(100vh - 4rem)',
            display: 'flex',
            gap: '0',
            transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 35px rgba(99,102,241,0.18)',
          }}
        >
          {/* ════════════════════════════════════════════════════════════
              SIDEBAR
          ════════════════════════════════════════════════════════════ */}
          {sidebarOpen && (
            <div
              className="fan-sidebar fan-sidebar-wrap"
              style={{
                width: '260px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(5,8,16,0.80)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Sidebar header */}
              <div
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="sidebar-toggle"
                  title="Collapse sidebar"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Sidebar collapse icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="9" y1="3" x2="9" y2="21"/>
                  </svg>
                </button>
                <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: '#475569', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Chats
                </span>
              </div>

              {/* New Chat button */}
              <div style={{ padding: '0.75rem 0.875rem 0.5rem' }}>
                <button
                  onClick={startNewChat}
                  className="new-chat-btn"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.875rem',
                    background: 'rgba(99,102,241,0.14)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: '10px',
                    color: '#a5b4fc',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'background 0.15s',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New Chat
                </button>
              </div>

              {/* Sessions list */}
              <div
                className="sidebar-scroll"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0.25rem 0.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                {sessionsLoading ? (
                  // Skeleton placeholders
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div className="skeleton" style={{ height: '12px', width: `${65 + (i % 3) * 12}%` }} />
                      <div className="skeleton" style={{ height: '10px', width: '35%' }} />
                    </div>
                  ))
                ) : sessions.length === 0 ? (
                  <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center' }}>
                    <p style={{ color: '#334155', fontSize: '0.8rem', margin: 0 }}>
                      No chats yet.
                      <br />Start a conversation!
                    </p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                      onClick={() => loadSession(session)}
                      onMouseEnter={() => setHoveredSessionId(session.id)}
                      onMouseLeave={() => setHoveredSessionId(null)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: activeSessionId === session.id
                          ? 'rgba(99,102,241,0.16)'
                          : 'transparent',
                        borderColor: activeSessionId === session.id
                          ? 'rgba(99,102,241,0.35)'
                          : 'transparent',
                      }}
                    >
                      {/* Chat bubble icon */}
                      <div style={{ flexShrink: 0, color: activeSessionId === session.id ? '#818cf8' : '#334155' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </div>

                      {/* Title + date */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0,
                          fontSize: '0.82rem',
                          fontWeight: activeSessionId === session.id ? 600 : 400,
                          color: activeSessionId === session.id ? '#c7d2fe' : '#94a3b8',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {session.title}
                        </p>
                        <p style={{ margin: '0.1rem 0 0', fontSize: '0.7rem', color: '#334155' }}>
                          {relativeTime(session.updated_at)}
                        </p>
                      </div>

                      {/* Delete button */}
                      <button
                        className="session-delete-btn"
                        onClick={(e) => deleteSession(e, session.id)}
                        disabled={deletingId === session.id}
                        title="Delete chat"
                        style={{
                          flexShrink: 0,
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: 'transparent',
                          border: 'none',
                          color: '#475569',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          transition: 'background 0.15s, color 0.15s',
                          opacity: (hoveredSessionId === session.id || deletingId === session.id) ? 1 : 0,
                        }}
                      >
                        {deletingId === session.id ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'fan-dotBounce 1s infinite' }}>
                            <circle cx="12" cy="12" r="10"/>
                          </svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              CHAT PANEL
          ════════════════════════════════════════════════════════════ */}
          <div
            className="fan-chat-col"
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(6,10,18,0.65)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderLeft: sidebarOpen ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            {/* ── 1. Sticky header ─────────────────────────────────── */}
            <div className="fan-header-bar">
              {/* Top row: back link + sidebar toggle */}
              <div style={{ padding: '0.9rem 1.25rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                {/* Sidebar toggle (only shown when sidebar is closed) */}
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="sidebar-toggle"
                    title="Open sidebar"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Title row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                  padding: '0.4rem 1.25rem 1rem',
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
                    {activeSessionId
                      ? sessions.find((s) => s.id === activeSessionId)?.title || 'Chat with your stadium assistant'
                      : 'Chat with your stadium assistant'}
                  </p>
                </div>
              </div>
            </div>

            {/* ── 2. Scrollable message list ───────────────────────── */}
            <div
              ref={chatScrollRef}
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

              {/* Typing indicator */}
              {loading && (
                <div
                  className="fan-msg"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}
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
            </div>

            {/* ── 3. Sticky input bar ──────────────────────────────── */}
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
      </div>
    </>
  );
}
