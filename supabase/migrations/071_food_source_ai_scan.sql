-- Migration 071: Add 'ai-scan' to food_source_type enum
-- Needed for food items created by the AI food scanner feature.
ALTER TYPE food_source_type ADD VALUE IF NOT EXISTS 'ai-scan';
