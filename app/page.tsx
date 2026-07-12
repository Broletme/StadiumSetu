'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Message {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  timestamp: string;
}

const SUGGESTIONS = [
  'Show World Cup 2026 schedule',
  'How to reach Wankhede Stadium?',
  'What are the stadium baggage rules?',
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! Welcome to StadiumSetu, your FIFA World Cup 2026 fan assistant. Ask me any questions about match schedules, transport guides, or stadium guidelines!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Call simulated assistant response (with hooks for real backend integration later)
    setTimeout(() => {
      const assistantMsg: Message = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: `I received your question: "${textToSend}". Connect me to the NestJS backend \`/fan/ask\` to fetch real-time FIFA World Cup 2026 answers!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-950 font-sans text-slate-100 min-h-screen relative overflow-hidden">
      {/* Decorative Blur Overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[45%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="currentColor" className="text-white" />
              <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.25)" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              StadiumSetu
            </h1>
            <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Live Fan Zone</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
          <Link
            href="/ops"
            className="text-xs text-slate-400 hover:text-white transition-colors duration-200 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3.5 py-1.5 rounded-lg font-medium"
          >
            Staff Dashboard
          </Link>
        </div>
      </header>

      {/* Main chat section */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 lg:p-6 flex flex-col gap-4 relative z-10 h-[calc(100vh-80px)]">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 md:p-6 space-y-4 backdrop-blur-sm custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gradient-to-tr from-indigo-500 to-violet-600 text-white'
                }`}
              >
                {msg.sender === 'user' ? 'U' : 'AI'}
              </div>
              <div className="flex flex-col gap-1">
                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600/90 text-white rounded-tr-none'
                      : 'bg-slate-800/80 border border-slate-700/30 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-500 px-1">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-[85%] mr-auto items-center">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
              <span className="text-xs text-slate-500 italic">Assistant is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap gap-2 py-1 justify-center">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="text-xs bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-colors text-slate-300 px-3 py-1.5 rounded-full cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2 bg-slate-900/80 border border-slate-800 p-2 rounded-xl focus-within:border-indigo-500/80 transition-colors"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about FIFA World Cup 2026..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none px-3"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-xs font-semibold text-white transition-colors duration-200 cursor-pointer"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
