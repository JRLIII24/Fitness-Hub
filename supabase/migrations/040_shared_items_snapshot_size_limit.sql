-- Migration 040: Enforce 50 KB size limit on shared_items.item_snapshot
--
-- Motivation: item_snapshot is a JSONB column that stores serialized workout
-- templates or meal-day summaries. Without a bound, a malicious or buggy client
-- can write arbitrarily large blobs, bloating the table and degrading query
-- performance.
--
-- The client-side guard in use-shared-items.ts (sendTemplate / sendMealDay)
-- rejects payloads before they hit the network.  This DB constraint is the
-- authoritative enforcement layer that survives any future client refactors.
--
-- 51200 bytes = 50 KiB, chosen to comfortably fit realistic templates and meal
-- logs while blocking runaway payloads.

ALTER TABLE shared_items
  ADD CONSTRAINT shared_items_snapshot_size_check
  CHECK (octet_length(item_snapshot::text) <= 51200);
