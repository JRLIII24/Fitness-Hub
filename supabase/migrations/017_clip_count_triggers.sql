-- Migration 017: DB triggers to keep like_count and comment_count accurate

-- Like count trigger
CREATE OR REPLACE FUNCTION update_clip_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE workout_clips SET like_count = like_count + 1 WHERE id = NEW.clip_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workout_clips SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.clip_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_clip_like_count ON clip_likes;
CREATE TRIGGER trg_clip_like_count
  AFTER INSERT OR DELETE ON clip_likes
  FOR EACH ROW EXECUTE FUNCTION update_clip_like_count();

-- Comment count trigger
CREATE OR REPLACE FUNCTION update_clip_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE workout_clips SET comment_count = comment_count + 1 WHERE id = NEW.clip_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workout_clips SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.clip_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_clip_comment_count ON clip_comments;
CREATE TRIGGER trg_clip_comment_count
  AFTER INSERT OR DELETE ON clip_comments
  FOR EACH ROW EXECUTE FUNCTION update_clip_comment_count();
