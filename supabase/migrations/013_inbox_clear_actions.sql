-- ============================================================================
-- Migration 013: Inbox Clear Actions
-- Allows recipients to delete messages/items from their inbox after reading.
-- ============================================================================

-- pings: allow recipient to delete messages from own inbox
DROP POLICY IF EXISTS "Recipient can delete own pings" ON pings;
CREATE POLICY "Recipient can delete own pings"
  ON pings FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);

-- shared_items: allow recipient to delete items from own inbox
DROP POLICY IF EXISTS "Recipient can delete own shares" ON shared_items;
CREATE POLICY "Recipient can delete own shares"
  ON shared_items FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);
