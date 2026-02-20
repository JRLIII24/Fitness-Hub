-- Migration 011: Shared Items (template & meal sends between friends)

CREATE TABLE IF NOT EXISTS shared_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('template', 'meal_day')),
  -- Optional reference to source template (may be null if deleted)
  template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
  -- Full snapshot so recipient can save even if original changes
  item_snapshot JSONB NOT NULL,
  message TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_items_recipient
  ON shared_items(recipient_id, created_at DESC);

ALTER TABLE shared_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sender can share"
  ON shared_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can read own shares"
  ON shared_items FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

CREATE POLICY "Recipient can mark read"
  ON shared_items FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
