-- ============================================================================
-- Migration 079: Add profiles FK + is_public to training_programs
-- Enables PostgREST join via profiles!training_programs_user_id_profiles_fkey
-- and community program discovery.
-- ============================================================================

-- FK to profiles so PostgREST can resolve the join
ALTER TABLE training_programs
  ADD CONSTRAINT training_programs_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Community discovery columns
ALTER TABLE training_programs
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_training_programs_public
  ON training_programs(created_at DESC) WHERE is_public = true;

-- RLS: anyone can read public programs
CREATE POLICY "Anyone can read public programs"
  ON training_programs FOR SELECT TO authenticated
  USING (is_public = true);
