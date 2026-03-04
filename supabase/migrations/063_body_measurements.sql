-- Body measurements: circumference tracking separate from weight logs
create table if not exists public.body_measurements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  measured_date   date not null,
  waist_cm        numeric(5,1),
  chest_cm        numeric(5,1),
  hips_cm         numeric(5,1),
  left_arm_cm     numeric(5,1),
  right_arm_cm    numeric(5,1),
  left_thigh_cm   numeric(5,1),
  right_thigh_cm  numeric(5,1),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, measured_date)
);

alter table public.body_measurements enable row level security;

create policy "Users can manage own measurements"
  on public.body_measurements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_body_measurements_user_date
  on public.body_measurements (user_id, measured_date desc);

create or replace function public.set_body_measurements_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_body_measurements_updated_at
  before update on public.body_measurements
  for each row execute function public.set_body_measurements_updated_at();
