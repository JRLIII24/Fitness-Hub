-- ============================================================================
-- Migration 048: Template Difficulty Levels
-- ============================================================================
-- Allows users to explicitly set difficulty for their templates with fun names.
-- 'warm_up' (easy), 'grind' (medium), 'beast_mode' (hard)

alter table public.workout_templates
  add column difficulty_level text default 'grind' check (difficulty_level in ('warm_up', 'grind', 'beast_mode'));

-- Index for queries (if needed in future)
create index idx_templates_difficulty on public.workout_templates(difficulty_level);
