-- Migration 055: Body weight logs for historical tracking
-- Stores per-day weight entries per user. One row per (user, date).

create table if not exists public.body_weight_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  logged_date date not null,
  weight_kg   numeric(5,2) not null check (weight_kg > 0 and weight_kg < 700),
  body_fat_pct numeric(4,1) check (body_fat_pct >= 0 and body_fat_pct <= 100),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, logged_date)
);

-- RLS
alter table public.body_weight_logs enable row level security;

create policy "Users can view own weight logs"
  on public.body_weight_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own weight logs"
  on public.body_weight_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own weight logs"
  on public.body_weight_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own weight logs"
  on public.body_weight_logs for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_body_weight_logs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_body_weight_logs_updated_at
  before update on public.body_weight_logs
  for each row execute function public.set_body_weight_logs_updated_at();

-- Index for efficient user+date queries
create index if not exists idx_body_weight_logs_user_date
  on public.body_weight_logs (user_id, logged_date desc);
