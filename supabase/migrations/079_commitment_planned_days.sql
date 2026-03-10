-- Add planned_days column to pod_commitments
-- Stores which specific days the user plans to work out (e.g. ['mon','wed','fri'])
ALTER TABLE pod_commitments
  ADD COLUMN IF NOT EXISTS planned_days text[] DEFAULT '{}';
