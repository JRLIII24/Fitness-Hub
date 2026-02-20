-- ============================================================================
-- Migration 026: Allow Pod Invitees to Read Pod Details
-- Invitees need to see pod name/description when they receive an invitation
-- ============================================================================

-- Allow users to read pods they've been invited to
CREATE POLICY "Pod invitees can read pod details"
  ON accountability_pods FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_invites
      WHERE pod_invites.pod_id = accountability_pods.id
        AND pod_invites.invitee_id = auth.uid()
        AND pod_invites.status = 'pending'
    )
  );
