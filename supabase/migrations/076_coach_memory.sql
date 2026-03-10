-- ============================================================================
-- 076: Coach Memory — persistent facts the AI coach remembers about each user
-- ============================================================================

create table if not exists coach_memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  category    text not null check (category in ('preference', 'injury', 'goal', 'note')),
  content     text not null,
  source      text not null default 'coach' check (source in ('coach', 'user')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Fast lookup by user
create index idx_coach_memories_user_id on coach_memories(user_id);

-- RLS ────────────────────────────────────────────────────────────────────────
alter table coach_memories enable row level security;

create policy "Users can read own memories"
  on coach_memories for select
  using (auth.uid() = user_id);

create policy "Users can insert own memories"
  on coach_memories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own memories"
  on coach_memories for update
  using (auth.uid() = user_id);

create policy "Users can delete own memories"
  on coach_memories for delete
  using (auth.uid() = user_id);
