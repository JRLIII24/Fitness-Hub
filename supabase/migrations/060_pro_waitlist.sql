-- Pro waitlist: stores emails from /upgrade page
create table if not exists public.pro_waitlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text not null,
  created_at  timestamptz not null default now(),
  unique (user_id),
  unique (email)
);

alter table public.pro_waitlist enable row level security;

create policy "Users can insert own waitlist entry"
  on public.pro_waitlist for insert
  with check (auth.uid() = user_id);

create policy "Users can update own waitlist entry"
  on public.pro_waitlist for update
  using (auth.uid() = user_id);

create policy "Users can read own waitlist entry"
  on public.pro_waitlist for select
  using (auth.uid() = user_id);
