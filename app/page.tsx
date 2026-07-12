'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  avatarColor: string;
  isSelf?: boolean;
}

const AVATAR_COLORS = [
  'bg-indigo-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-black',
  'bg-rose-500 text-white',
  'bg-cyan-500 text-black',
  'bg-violet-500 text-white',
  'bg-fuchsia-500 text-white',
];

const MOCK_NAMES = [
  'WankhedeRoarer',
  'CoverDriveKing',
  'YorkerSpecialist',
  'BoundaryRider',
  'SuperFan_07',
  'CricketCrazy',
  'GoIndia_18',
  'SpinWizard',
  'StumpFlyer',
  'StadiumWave',
];

const MOCK_COMMENTS = [
  'BUMRAH! What a delivery! 🎯',
  'That was a massive sixer! 🚀',
  'Is that out? Checking DRS...',
  'What a match, guys! Wankhede is absolutely electric today!',
  'Can\'t believe he caught that! Catch of the tournament! 🏆',
  'Let\'s gooo! 🇮🇳',
  'Shami is on fire! 🔥',
  'Need 12 runs from 6 balls. Absolute nail-biter!',
  'What a captaincy move by Rohit.',
  'Who\'s at the stadium right now? Stand B is roaring!',
  'Unbelievable shot! Over the roof!',
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'SuperFan_07',
      text: 'Wankhede is absolutely packed today! Let\'s go!',
      timestamp: '20:15',
      avatarColor: 'bg-indigo-500 text-white',
    },
    {
      id: '2',
      sender: 'YorkerSpecialist',
      text: 'Hoping for a Shardul Thakur masterclass in the death overs.',
      timestamp: '20:16',
      avatarColor: 'bg-emerald-500 text-white',
    },
    {
      id: '3',
      sender: 'BoundaryRider',
      text: 'What a cover drive by Rohit! Shot of the day so far.',
      timestamp: '20:18',
      avatarColor: 'bg-rose-500 text-white',
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [hasSetNickname, setHasSetNickname] = useState(false);
  const [userColor, setUserColor] = useState('bg-indigo-500 text-white');

  // Interactive Poll state
  const [pollVotes, setPollVotes] = useState({ optionA: 142, optionB: 89, optionC: 67 });
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Cheers floaters
  const [cheers, setCheers] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const cheerIdRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate incoming live messages
  useEffect(() => {
    const interval = setInterval(() => {
      const randomName = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
      const randomText = MOCK_COMMENTS[Math.floor(Math.random() * MOCK_COMMENTS.length)];
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const newMessage: Message = {
        id: Math.random().toString(),
        sender: randomName,
        text: randomText,
        timestamp: timeStr,
        avatarColor: randomColor,
      };

      setMessages((prev) => [...prev, newMessage]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const currentNickname = nickname.trim() || 'Anonymous Fan';
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newMsg: Message = {
      id: Math.random().toString(),
      sender: currentNickname,
      text: inputMessage.trim(),
      timestamp: timeStr,
      avatarColor: userColor,
      isSelf: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');
  };

  const handleVote = (option: 'optionA' | 'optionB' | 'optionC') => {
    if (hasVoted) return;
    setPollVotes((prev) => ({
      ...prev,
      [option]: prev[option] + 1,
    }));
    setHasVoted(true);
    setSelectedOption(option);
  };

  const handleCheer = (emoji: string) => {
    const newCheer = {
      id: cheerIdRef.current++,
      emoji,
      x: 10 + Math.random() * 80, // Random percentage offset
    };
    setCheers((prev) => [...prev, newCheer]);

    // Clean up floaters
    setTimeout(() => {
      setCheers((prev) => prev.filter((c) => c.id !== newCheer.id));
    }, 2000);
  };

  const totalVotes = pollVotes.optionA + pollVotes.optionB + pollVotes.optionC;
  const getPercent = (votes: number) => {
    if (totalVotes === 0) return '0%';
    return `${Math.round((votes / totalVotes) * 100)}%`;
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
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            14,204 Fans Live
          </span>
          <a
            href="/ops"
            className="text-xs text-slate-400 hover:text-white transition-colors duration-200 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3.5 py-1.5 rounded-lg font-medium"
          >
            Staff Dashboard
          </a>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Left Column: Match Status & Interactive Polls */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Match Scorecard Card */}
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 px-3 py-1 bg-red-500/10 border-b border-l border-red-500/20 text-[10px] font-bold text-red-400 rounded-bl-xl tracking-wider uppercase animate-pulse">
              LIVE
            </div>
            
            <p className="text-xs text-indigo-400 font-semibold tracking-wide uppercase mb-3">T20 Champions Trophy — Final</p>
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm">
                  IND
                </div>
                <div>
                  <h3 className="font-bold text-slate-100">India</h3>
                  <p className="text-xs text-slate-400">Batting</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-50 tracking-tight">325/4</p>
                <p className="text-xs text-slate-400">48.2 Overs</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-sm">
                  AUS
                </div>
                <div>
                  <h3 className="font-bold text-slate-100">Australia</h3>
                  <p className="text-xs text-slate-400">Yet to bat</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-500">—</p>
              </div>
            </div>

            <div className="border-t border-slate-800/60 pt-4 flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Batter at crease:</span>
                <span className="font-medium text-slate-200">Rohit Sharma 142* (68)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Bowler:</span>
                <span className="font-medium text-slate-200">Mitchell Starc 9.2-0-84-2</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Venue:</span>
                <span className="font-medium text-slate-200">Wankhede Stadium, Mumbai</span>
              </div>
            </div>
          </section>

          {/* Interactive Live Poll Card */}
          <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400">
                <path d="M12 20V10M18 20V4M6 20v-6" />
              </svg>
              Live Poll
            </h3>
            <h4 className="font-bold text-slate-100 text-base mb-4">Who will win the Man of the Match award?</h4>

            <div className="flex flex-col gap-3">
              <button
                id="poll-option-a"
                disabled={hasVoted}
                onClick={() => handleVote('optionA')}
                className={`relative w-full overflow-hidden text-left p-3.5 rounded-xl border transition-all duration-300 ${
                  selectedOption === 'optionA'
                    ? 'bg-indigo-600/20 border-indigo-500'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 bg-indigo-500/10 transition-all duration-500"
                  style={{ width: hasVoted ? getPercent(pollVotes.optionA) : '0%' }}
                />
                <div className="relative flex justify-between items-center text-xs font-semibold">
                  <span className={selectedOption === 'optionA' ? 'text-indigo-300' : 'text-slate-200'}>Rohit Sharma</span>
                  {hasVoted && <span className="text-slate-400">{getPercent(pollVotes.optionA)}</span>}
                </div>
              </button>

              <button
                id="poll-option-b"
                disabled={hasVoted}
                onClick={() => handleVote('optionB')}
                className={`relative w-full overflow-hidden text-left p-3.5 rounded-xl border transition-all duration-300 ${
                  selectedOption === 'optionB'
                    ? 'bg-indigo-600/20 border-indigo-500'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 bg-indigo-500/10 transition-all duration-500"
                  style={{ width: hasVoted ? getPercent(pollVotes.optionB) : '0%' }}
                />
                <div className="relative flex justify-between items-center text-xs font-semibold">
                  <span className={selectedOption === 'optionB' ? 'text-indigo-300' : 'text-slate-200'}>Jasprit Bumrah</span>
                  {hasVoted && <span className="text-slate-400">{getPercent(pollVotes.optionB)}</span>}
                </div>
              </button>

              <button
                id="poll-option-c"
                disabled={hasVoted}
                onClick={() => handleVote('optionC')}
                className={`relative w-full overflow-hidden text-left p-3.5 rounded-xl border transition-all duration-300 ${
                  selectedOption === 'optionC'
                    ? 'bg-indigo-600/20 border-indigo-500'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 bg-indigo-500/10 transition-all duration-500"
                  style={{ width: hasVoted ? getPercent(pollVotes.optionC) : '0%' }}
                />
                <div className="relative flex justify-between items-center text-xs font-semibold">
                  <span className={selectedOption === 'optionC' ? 'text-indigo-300' : 'text-slate-200'}>Virat Kohli</span>
                  {hasVoted && <span className="text-slate-400">{getPercent(pollVotes.optionC)}</span>}
                </div>
              </button>
            </div>
            {hasVoted && (
              <p className="text-[10px] text-slate-500 text-center mt-3">Thank you for voting! Real-time results updated.</p>
            )}
          </section>
        </div>

        {/* Center/Right Columns: Chat Area */}
        <div className="lg:col-span-2 flex flex-col bg-slate-900/40 border border-slate-800/80 rounded-2xl h-[550px] lg:h-[650px] overflow-hidden backdrop-blur-sm">
          
          {/* Chat header */}
          <div className="p-4 border-b border-slate-800/60 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Live Chat Feed</span>
            </div>
            {!hasSetNickname ? (
              <button
                id="set-nick-btn"
                onClick={() => {
                  const defaultNick = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
                  setNickname(defaultNick);
                  setUserColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
                  setHasSetNickname(true);
                }}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider transition-colors duration-200"
              >
                Set Nickname
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Chatting as:</span>
                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">{nickname}</span>
              </div>
            )}
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${msg.isSelf ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs uppercase ${msg.avatarColor}`}>
                  {msg.sender.substring(0, 2)}
                </div>
                <div>
                  <div className={`flex items-baseline gap-2 mb-0.5 ${msg.isSelf ? 'justify-end' : ''}`}>
                    <span className="text-xs font-bold text-slate-300">{msg.sender}</span>
                    <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                  </div>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.isSelf
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800/80 text-slate-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Cheer Floater Area & Controls */}
          <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/60 flex items-center justify-between gap-4 relative">
            
            {/* Render Floating Cheers */}
            <div className="absolute inset-x-0 bottom-full h-48 pointer-events-none overflow-hidden z-20">
              {cheers.map((c) => (
                <div
                  key={c.id}
                  className="cheer-floater text-2xl absolute bottom-0 select-none animate-float-up"
                  style={{ left: `${c.x}%` }}
                >
                  {c.emoji}
                </div>
              ))}
            </div>

            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Send Cheer:</span>
            <div className="flex gap-2">
              <button
                id="cheer-btn-fire"
                onClick={() => handleCheer('🔥')}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center transition-all duration-200 active:scale-95 text-base"
              >
                🔥
              </button>
              <button
                id="cheer-btn-clap"
                onClick={() => handleCheer('👏')}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center transition-all duration-200 active:scale-95 text-base"
              >
                👏
              </button>
              <button
                id="cheer-btn-bat"
                onClick={() => handleCheer('🏏')}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center transition-all duration-200 active:scale-95 text-base"
              >
                🏏
              </button>
              <button
                id="cheer-btn-wow"
                onClick={() => handleCheer('🙌')}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center transition-all duration-200 active:scale-95 text-base"
              >
                🙌
              </button>
            </div>
          </div>

          {/* Form message input */}
          <div className="p-4 border-t border-slate-800/60 bg-slate-900/60">
            {!hasSetNickname ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="nickname-input"
                  type="text"
                  placeholder="Choose a screen nickname..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-100"
                />
                <button
                  id="join-chat-btn"
                  onClick={() => {
                    if (nickname.trim()) {
                      setUserColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
                      setHasSetNickname(true);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 transition-colors duration-200 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 active:scale-[0.98]"
                >
                  Join Chat
                </button>
              </div>
            ) : (
              <form id="chat-send-form" onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  id="chat-message-input"
                  type="text"
                  placeholder="Say something to the stadium..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-100 placeholder-slate-500"
                />
                <button
                  id="chat-send-btn"
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 transition-colors duration-200 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 active:scale-[0.98] flex items-center gap-1.5"
                >
                  <span>Send</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            )}
          </div>

        </div>
      </main>

      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translateY(-20px) scale(1.1);
          }
          50% {
            transform: translateY(-80px) translateX(-15px) scale(1);
          }
          85% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-180px) translateX(10px) scale(0.8);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: float-up 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .cheer-floater {
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}
