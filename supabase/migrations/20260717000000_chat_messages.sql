create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  role text not null,          -- 'user' | 'assistant'
  content text not null,
  section_data jsonb,          -- nullable, stores the sectionData object when present
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;

create policy "Users can insert their own chat messages" on chat_messages
  for insert with check (auth.uid() = user_id);

create policy "Users can select their own chat messages" on chat_messages
  for select using (auth.uid() = user_id);
