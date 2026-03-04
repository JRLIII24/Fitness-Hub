-- Meal templates: saved meal combos for quick re-logging
create table if not exists public.meal_templates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  items          jsonb not null default '[]',
  -- items schema: [{ food_item_id, name, brand, servings, calories, protein_g, carbs_g, fat_g }]
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.meal_templates enable row level security;

create policy "Users can manage own meal templates"
  on public.meal_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_meal_templates_user
  on public.meal_templates (user_id, created_at desc);

create or replace function public.set_meal_templates_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_meal_templates_updated_at
  before update on public.meal_templates
  for each row execute function public.set_meal_templates_updated_at();
