-- Migration 019: Security fixes from audit
-- 1. Tighten food_items INSERT policy — no longer allow null created_by
-- 2. Add food_log index for faster user queries

-- Fix food_items INSERT: require authenticated user as creator
DROP POLICY IF EXISTS "Users can create food items" ON food_items;
CREATE POLICY "Users can create food items"
  ON food_items FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Add index for faster food log queries by user
CREATE INDEX IF NOT EXISTS idx_food_log_user
  ON food_log (user_id, logged_at DESC);
