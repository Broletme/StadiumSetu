-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: chat_sessions
-- Adds a chat_sessions table and links chat_messages to sessions.
-- session_id is nullable to preserve backward-compat with existing messages.
-- ─────────────────────────────────────────────────────────────────────────────

create table chat_sessions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  title      text        not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_sessions enable row level security;

-- Users can do everything with their own sessions
create policy "Users own their sessions"
  on chat_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add session_id FK to chat_messages (nullable — old messages are unaffected)
alter table chat_messages
  add column session_id uuid references chat_sessions(id) on delete cascade;

create index chat_messages_session_id_idx on chat_messages(session_id);

-- Auto-update updated_at on chat_sessions whenever a row is touched
create or replace function update_chat_session_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_chat_sessions_updated_at
  before update on chat_sessions
  for each row execute procedure update_chat_session_timestamp();
