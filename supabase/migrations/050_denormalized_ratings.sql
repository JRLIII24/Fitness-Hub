-- ============================================================================
-- Migration 050: Denormalized Rating Columns + Sync Trigger
-- ============================================================================
-- Adds avg_rating and review_count directly to workout_templates for
-- efficient DB-level sorting. A trigger keeps them in sync with template_reviews.

ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS avg_rating numeric(3,1),
  ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0;

-- Backfill from existing view
UPDATE public.workout_templates wt
SET
  avg_rating   = s.avg_rating,
  review_count = s.review_count
FROM public.template_rating_stats s
WHERE wt.id = s.template_id;

-- Index for efficient DB-level rating sort
CREATE INDEX IF NOT EXISTS idx_templates_rating
  ON public.workout_templates (avg_rating DESC NULLS LAST, review_count DESC)
  WHERE is_public = true;

-- Trigger function to keep denormalized columns in sync
CREATE OR REPLACE FUNCTION sync_template_rating_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_template_id uuid;
BEGIN
  v_template_id := COALESCE(NEW.template_id, OLD.template_id);
  UPDATE public.workout_templates
  SET
    avg_rating   = (SELECT round(avg(rating)::numeric, 1) FROM public.template_reviews WHERE template_id = v_template_id),
    review_count = (SELECT count(*)::int FROM public.template_reviews WHERE template_id = v_template_id)
  WHERE id = v_template_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_template_rating_stats ON public.template_reviews;
CREATE TRIGGER trg_sync_template_rating_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.template_reviews
  FOR EACH ROW EXECUTE FUNCTION sync_template_rating_stats();
