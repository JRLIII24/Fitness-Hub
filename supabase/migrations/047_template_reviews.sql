-- ============================================================================
-- Migration 047: Template Reviews & Ratings
-- ============================================================================
-- Adds a template_reviews table with 1-5 star ratings and optional comments.
-- Includes a computed view (template_rating_stats) for average rating and count.
-- RLS policies ensure users can only manage their own reviews.

create table public.template_reviews (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.workout_templates(id) on delete cascade,
  reviewer_id   uuid not null references auth.users(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text,                        -- optional written review
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (template_id, reviewer_id)          -- one review per user per template
);

-- RLS
alter table public.template_reviews enable row level security;

-- Anyone can read reviews
create policy "Anyone can read reviews"
  on public.template_reviews for select using (true);

-- Only the reviewer can insert their own review
create policy "Users can insert own review"
  on public.template_reviews for insert
  with check (auth.uid() = reviewer_id);

-- Only the reviewer can update their own review
create policy "Users can update own review"
  on public.template_reviews for update
  using (auth.uid() = reviewer_id);

-- Only the reviewer can delete their own review
create policy "Users can delete own review"
  on public.template_reviews for delete
  using (auth.uid() = reviewer_id);

-- Convenience view for quick stats queries
create or replace view public.template_rating_stats as
select
  template_id,
  round(avg(rating)::numeric, 1) as avg_rating,
  count(*)::int                  as review_count
from public.template_reviews
group by template_id;

-- Index for efficient queries by template_id
create index idx_template_reviews_template_id on public.template_reviews(template_id);
create index idx_template_reviews_reviewer_id on public.template_reviews(reviewer_id);
