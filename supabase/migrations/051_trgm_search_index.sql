-- ============================================================================
-- Migration 051: pg_trgm GIN Index for Template Fuzzy Search
-- ============================================================================
-- Enables fast ILIKE fuzzy search on template names and descriptions.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_templates_name_trgm
  ON public.workout_templates
  USING GIN (name gin_trgm_ops)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_templates_description_trgm
  ON public.workout_templates
  USING GIN (description gin_trgm_ops)
  WHERE is_public = true;
