# StadiumSetu API

NestJS backend for StadiumSetu — real-time fan experience platform.

## Project setup

```bash
npm install
```

## Compile and run the project

```bash
# development (watch mode)
npm run start:dev

# production
npm run start:prod
```

## Run tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

---

## Zones Data Layer

The Zones module powers the seat/gate wayfinding feature: given a section number, it returns the nearest gate and its position around the stadium bowl.

### 1. Run the database migration

Copy the migration file into your Supabase project and run it via the Supabase SQL Editor or the CLI:

**Via Supabase Dashboard (easiest):**
1. Open your project → **SQL Editor**
2. Paste the contents of `../supabase/migrations/20260714000000_zones_schema.sql`
3. Click **Run**

**Via Supabase CLI:**
```bash
# From the repo root (stadiumsetu-web/)
supabase db push
```

This creates five tables (`gates`, `sections`, `seats`, `zone_congestion`, `incidents`) with Row Level Security policies applied.

---

### 2. Run the seed script

The seed script inserts 4 gates, 24 sections, and 120 seats (5 per section).

Make sure your `stadiumsetu-api/.env` contains valid values:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run from within `stadiumsetu-api/`:
```bash
npx ts-node -r tsconfig-paths/register scripts/seed.ts
```

Expected output:
```
🌱  Starting seed...

✅  Inserted 4 gates:
     • Gate A @ 0°
     • Gate B @ 90°
     • Gate C @ 180°
     • Gate D @ 270°

✅  Inserted 24 sections:
     • [00] L01  (Lower Tier) → Gate A
     • [01] L02  (Lower Tier) → Gate A
     ...

✅  Inserted 120 seats (5 per section)

─────────────────────────────────
📊  Seed summary:
     Gates:    4
     Sections: 24
     Seats:    120
─────────────────────────────────
✨  Done!
```

> **Note:** Re-running the seed script will fail with a unique-constraint error on `section_number`. Truncate the tables first if you need a fresh seed:
> ```sql
> TRUNCATE seats, sections, zone_congestion, gates CASCADE;
> ```

---

### 3. Test the endpoints

Start the server:
```bash
npm run start:dev
# Listening on http://localhost:3001
```

**Get all sections (with nearest gate):**
```bash
curl http://localhost:3001/zones
```
Response: JSON array of 24 section objects, each with a nested `gate` field.

**Get a specific section by section number:**
```bash
# Lower Tier section 1
curl http://localhost:3001/zones/seat/L01

# Upper Tier section 5
curl http://localhost:3001/zones/seat/U05
```
Response: Single section object with gate data:
```json
{
  "id": "...",
  "section_number": "L01",
  "tier": "Lower Tier",
  "section_index": 0,
  "nearest_gate_id": "...",
  "gate": {
    "id": "...",
    "name": "Gate A",
    "angle_deg": 0,
    "lat": null,
    "lng": null
  }
}
```

**Section not found (404):**
```bash
curl http://localhost:3001/zones/seat/NOTEXIST
# HTTP 404 — { "statusCode": 404, "message": "Section \"NOTEXIST\" not found" }
```

---

## Auth (Ops module)

Protected routes under `/ops` require a valid Supabase JWT in the `Authorization: Bearer <token>` header. The user must also be registered in the `ops_users` table with an appropriate role.

See `src/ops/` for the guard and controller implementation.
