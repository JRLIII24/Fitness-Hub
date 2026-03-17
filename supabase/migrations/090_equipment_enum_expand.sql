-- Migration 090: Add smith_machine and kettlebell to equipment_type enum
-- These are already used in the app constants but missing from the DB enum.

ALTER TYPE equipment_type ADD VALUE IF NOT EXISTS 'smith_machine';
ALTER TYPE equipment_type ADD VALUE IF NOT EXISTS 'kettlebell';
