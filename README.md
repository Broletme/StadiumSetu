# StadiumSetu

Dual-interface FIFA World Cup 2026 fan assistant + ops dashboard.

## Stack
- **Frontend:** Next.js (App Router) — `/web`
- **Backend:** NestJS — `/api`
- **DB + Realtime:** Supabase (Postgres)
- **LLM:** Groq

## Repo layout
```
stadiumsetu/
  api/          NestJS backend (fan chat + ops routes)
  web/          Next.js frontend (fan UI + /ops dashboard)
  schema.sql    Supabase table definitions + RLS
```

## Setup (one-time)

### 1. Supabase
- Create a project at supabase.com
- Run `schema.sql` in the SQL editor
- Copy your project URL + anon key + service role key

### 2. Backend (`/api`) — install
```bash
cd api
npm install
cp .env.example .env   # fill in GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
```

### 3. Frontend (`/web`) — install
```bash
cd web
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
```

`NEXT_PUBLIC_API_URL` should be `http://localhost:3001` for local dev.

---

## Running the project (every time)

You need **two terminals open at the same time** — one for backend, one for frontend.

**Terminal 1 — Backend**
```bash
cd api
npm run start:dev
```
Runs on `http://localhost:3001`

**Terminal 2 — Frontend**
```bash
cd web
npm run dev
```
Runs on `http://localhost:3000`

Then open:
- `http://localhost:3000` — fan chat assistant
- `http://localhost:3000/ops` — live ops dashboard

If either `.env` / `.env.local` is missing or has placeholder values, the app will run but API calls (Groq, Supabase) will fail.

## What's wired up right now
- `POST /fan/ask` → calls Groq, saves query+response to `fan_queries`
- `GET /ops/incidents`, `POST /ops/incidents` → incident CRUD
- `GET /ops/zones` → zone status
- Frontend `/ops` subscribes to Supabase Realtime on `incidents` table — no polling

## Next slice to build
Pick ONE and we build it end-to-end before moving on:
1. Zone density updates (who reports this — sensors? manual ops entry?)
2. Auth for ops staff (Supabase Auth, role-gated)
3. Fan chat streaming responses (currently returns full response, not streamed)
