# StadiumSetu

A GenAI-enabled stadium operations platform built for FIFA World Cup 2026, enhancing fan navigation and crowd management through natural language assistance, interactive 3D visualization, and real-time operational intelligence.

## What it does

StadiumSetu has two sides to it:

**For fans** — find your seat, understand where your gate is, and see exactly how to walk there, in your own language, without needing to read a static stadium map.

**For operations staff** — a live crowd congestion heatmap with GenAI-generated, actionable alerts, so staff know where a problem is developing and what to do about it before it escalates.

## Features

### Fan-facing
- **Conversational seat finder** — chat interface (Groq / Llama 3.3 70B) that understands free-text questions like "where is my seat, I'm in L02" or "how do I get to my gate," detects the language you're writing in and replies in that same language, and resolves your section/gate from the real venue database
- **Persistent chat history** — tied to your account via Supabase, so your conversation follows you across devices
- **Interactive 3D stadium view** — a procedurally generated stadium bowl (Three.js / React Three Fiber) showing your exact section highlighted, with an animated walking path from your nearest gate, through the concourse, through the vomitory (tunnel entrance), to your seat
- **Auth** — Google OAuth via Supabase

### Operations-facing
- **Live congestion dashboard** — real-time section-by-section crowd status (Low/Medium/High), updating live via Supabase Realtime, with per-section detail popovers
- **GenAI-generated alerts** — when a section's crowd level spikes, Groq generates a specific, actionable alert (grounded in real gate names and device counts, not hallucinated) recommending which gate to redirect fans to and what staff action to take
- **Auto-resolving alerts** — alerts clear automatically once a section's congestion returns to normal, so the feed stays current rather than accumulating stale entries
- **3D congestion heatmap** — the same stadium bowl, recolored to show live crowd intensity per section, with a priority-ranked list of the most congested areas and one-click camera highlighting
- **Demo controls** — simulate a crowd spike or reset to baseline on demand, for live demonstration purposes

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), Tailwind CSS |
| Backend | NestJS |
| Database & Realtime | Supabase (Postgres, Realtime, Auth) |
| GenAI | Groq API (`llama-3.3-70b-versatile`) |
| 3D rendering | Three.js, React Three Fiber, drei |

## Where GenAI is actually used

1. **Fan chat assistant** — natural language understanding (intent classification, language detection, entity extraction) and response generation, grounded in real database lookups
2. **Crowd alert generation** — Groq generates specific, actionable operational alerts when congestion spikes, using real gate names and live device counts as grounding context to avoid hallucinated details

Crowd/device data itself is **synthetic** (simulated for demo purposes, not real sensor input) — this is intentional and clearly separated from the GenAI-generated reasoning layered on top of it.

## Project structure

This is two separate projects, not a monorepo:

```
stadiumsetu-web/     — Next.js frontend
stadiumsetu-api/     — NestJS backend
```

## Setup & running locally

### Prerequisites
- Node.js and npm
- A Supabase project (free tier is fine)
- A Groq API key (free tier available at console.groq.com)

### 1. Backend setup (`stadiumsetu-api`)

```bash
cd stadiumsetu-api
npm install
```

Create a `.env` file (copy from `.env.example`) with:
```
SUPABASE_URL=<your supabase project url>
SUPABASE_SERVICE_ROLE_KEY=<your supabase service role key>
GROQ_API_KEY=<your groq api key>
FRONTEND_URL=http://localhost:3000
PORT=3001
```

Link and apply database migrations:
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Seed the database with sample stadium data (gates, sections, seats):
```bash
npx ts-node scripts/seed.ts
```

Start the API server:
```bash
npm run start:dev
```
The API runs on `http://localhost:3001`.

### 2. Frontend setup (`stadiumsetu-web`)

```bash
cd stadiumsetu-web
npm install
```

Create a `.env.local` file with:
```
NEXT_PUBLIC_SUPABASE_URL=<your supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Start the frontend:
```bash
npm run dev
```
The app runs on `http://localhost:3000`.

### 3. Using the app

1. Go to `http://localhost:3000` and sign in with Google
2. From the dashboard, try:
   - **Find My Seat** (`/fan`) — chat with the assistant, e.g. "where is section L02?"
   - **3D Stadium View** (`/fan/3d`) — enter a section number to see it highlighted with a walking path
   - **Operations** (`/ops`) — view the live congestion dashboard; click **Simulate Crowd Spike** to see GenAI-generated alerts appear in real time, and **Reset to Normal** to clear them

## Quick API test (optional, for verifying the backend independently)

```bash
curl http://localhost:3001/zones/seat/L01
curl -X POST http://localhost:3001/congestion/simulate-spike
curl http://localhost:3001/alerts
```

## Known limitations

- **Crowd data is synthetic**, simulated via an on-demand "spike" trigger rather than real sensor/mobile-signal input — this is a deliberate hackathon scope decision, called out explicitly rather than presented as real data
- **No role-based access control** — any signed-in user can currently access the Operations dashboard; a production version would restrict this to verified staff accounts via a role field, enforced in both the UI and Supabase RLS policies
- **Single venue** — the data model currently represents one stadium; multi-venue support would require an additional `venues` table and scoping existing tables to it
- **Voice input** — not implemented in this version; the chat assistant is text-only (Groq Whisper integration would be the natural next step)

## Future enhancements

- Real IoT/mobile-signal integration for genuine crowd sensing (e.g. WiFi/Bluetooth presence analytics, similar to Cisco Meraki-style systems used in real stadiums)
- Voice input for the fan chat assistant
- Multi-venue support
- Staff role-based access control
- Gradual congestion decay logic (rather than only resetting via demo controls)