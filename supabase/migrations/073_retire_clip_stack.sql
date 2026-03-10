-- Migration 073: Retire clip stack
-- Drops clip triggers, functions, and tables.
-- Does NOT touch template_favorites, profiles.current_streak, or update_user_streak.
-- Storage bucket cleanup (workout-clips) is handled by scripts/purge-workout-clips.ts.

-- 1. Drop clip count triggers (from migration 017)
DROP TRIGGER IF EXISTS trg_clip_like_count ON clip_likes;
DROP TRIGGER IF EXISTS trg_clip_comment_count ON clip_comments;

-- 2. Drop clip count functions (from migration 017)
DROP FUNCTION IF EXISTS update_clip_like_count();
DROP FUNCTION IF EXISTS update_clip_comment_count();

-- 3. Drop clip tables in dependency order (from migrations 015, 016)
--    CASCADE handles RLS policies and indexes automatically.
DROP TABLE IF EXISTS clip_comments CASCADE;
DROP TABLE IF EXISTS clip_likes CASCADE;
DROP TABLE IF EXISTS workout_clips CASCADE;
