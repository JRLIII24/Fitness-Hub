-- Migration 025: Pod Invitation System
-- Allows users to send/receive pod invites that must be accepted

-- Pod invitations table
CREATE TABLE pod_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT uq_pod_invite UNIQUE (pod_id, invitee_id),
  CONSTRAINT no_self_invite CHECK (inviter_id <> invitee_id)
);

CREATE INDEX idx_pod_invites_invitee ON pod_invites(invitee_id, status);
CREATE INDEX idx_pod_invites_pod ON pod_invites(pod_id, status);

-- RLS Policies

ALTER TABLE pod_invites ENABLE ROW LEVEL SECURITY;

-- Pod creators can create invites
CREATE POLICY "Pod creators can send invites"
  ON pod_invites FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id
    AND EXISTS (
      SELECT 1 FROM accountability_pods
      WHERE accountability_pods.id = pod_invites.pod_id
        AND accountability_pods.creator_id = auth.uid()
    )
  );

-- Users can view invites they sent or received
CREATE POLICY "Users can view their own invites"
  ON pod_invites FOR SELECT TO authenticated
  USING (
    auth.uid() = inviter_id
    OR auth.uid() = invitee_id
  );

-- Invitees can update invites (accept/decline)
CREATE POLICY "Invitees can respond to invites"
  ON pod_invites FOR UPDATE TO authenticated
  USING (auth.uid() = invitee_id)
  WITH CHECK (auth.uid() = invitee_id);

-- Trigger: When invite is accepted, add user to pod
CREATE OR REPLACE FUNCTION handle_pod_invite_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Add user to pod as active member
    INSERT INTO pod_members (pod_id, user_id, status)
    VALUES (NEW.pod_id, NEW.invitee_id, 'active')
    ON CONFLICT (pod_id, user_id) DO UPDATE
    SET status = 'active', joined_at = now();

    -- Update responded_at timestamp
    NEW.responded_at := now();
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    NEW.responded_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_pod_invite_response
  BEFORE UPDATE ON pod_invites
  FOR EACH ROW EXECUTE FUNCTION handle_pod_invite_accepted();
