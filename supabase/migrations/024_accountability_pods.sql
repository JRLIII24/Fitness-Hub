-- Migration 024: Accountability Pods
-- Social accountability groups for workout consistency

-- Pods table (groups of 2-8 members)
CREATE TABLE accountability_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
  description TEXT CHECK (char_length(description) <= 200),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pods_creator ON accountability_pods(creator_id);

-- Pod members (many-to-many)
CREATE TABLE pod_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pod_member UNIQUE (pod_id, user_id)
);

CREATE INDEX idx_pod_members_pod ON pod_members(pod_id, status);
CREATE INDEX idx_pod_members_user ON pod_members(user_id, status);

-- Weekly commitments
CREATE TABLE pod_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workouts_per_week INTEGER NOT NULL CHECK (workouts_per_week BETWEEN 1 AND 7),
  week_start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pod_commitment_week UNIQUE (pod_id, user_id, week_start_date)
);

CREATE INDEX idx_pod_commitments_week ON pod_commitments(pod_id, week_start_date);

-- Encouragement messages
CREATE TABLE pod_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES accountability_pods(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL = message to whole pod
  message TEXT NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pod_messages_pod ON pod_messages(pod_id, created_at DESC);
CREATE INDEX idx_pod_messages_recipient ON pod_messages(recipient_id, created_at DESC) WHERE recipient_id IS NOT NULL;

-- RLS Policies

-- Pods: members can read their own pods
ALTER TABLE accountability_pods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own pods"
  ON accountability_pods FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = accountability_pods.id
        AND pod_members.user_id = auth.uid()
        AND pod_members.status = 'active'
    )
  );

CREATE POLICY "Users can create pods"
  ON accountability_pods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their pods"
  ON accountability_pods FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their pods"
  ON accountability_pods FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

-- Pod members: members can read/manage
ALTER TABLE pod_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read pod members"
  ON pod_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pod_members pm
      WHERE pm.pod_id = pod_members.pod_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

CREATE POLICY "Pod creators can add members"
  ON pod_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accountability_pods
      WHERE accountability_pods.id = pod_members.pod_id
        AND accountability_pods.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave pods"
  ON pod_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Pod creators can remove members"
  ON pod_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accountability_pods
      WHERE accountability_pods.id = pod_members.pod_id
        AND accountability_pods.creator_id = auth.uid()
    )
  );

-- Commitments: members can manage their own
ALTER TABLE pod_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read pod commitments"
  ON pod_commitments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = pod_commitments.pod_id
        AND pod_members.user_id = auth.uid()
        AND pod_members.status = 'active'
    )
  );

CREATE POLICY "Users can manage their own commitments"
  ON pod_commitments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Messages: members can read/send
ALTER TABLE pod_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read pod messages"
  ON pod_messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (recipient_id IS NULL AND EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = pod_messages.pod_id
        AND pod_members.user_id = auth.uid()
        AND pod_members.status = 'active'
    ))
  );

CREATE POLICY "Pod members can send messages"
  ON pod_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = pod_messages.pod_id
        AND pod_members.user_id = auth.uid()
        AND pod_members.status = 'active'
    )
  );

-- Helper function: Get current week's Monday (ISO week start)
CREATE OR REPLACE FUNCTION get_week_start(input_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
  RETURN input_date - ((EXTRACT(DOW FROM input_date)::INTEGER + 6) % 7);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: Auto-add creator as first member when pod is created
CREATE OR REPLACE FUNCTION auto_add_creator_to_pod()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pod_members (pod_id, user_id, status)
  VALUES (NEW.id, NEW.creator_id, 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_add_creator
  AFTER INSERT ON accountability_pods
  FOR EACH ROW EXECUTE FUNCTION auto_add_creator_to_pod();

-- Trigger: Update pod updated_at timestamp
CREATE OR REPLACE FUNCTION update_pod_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE accountability_pods
  SET updated_at = now()
  WHERE id = NEW.pod_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_pod_on_member_change
  AFTER INSERT OR UPDATE ON pod_members
  FOR EACH ROW EXECUTE FUNCTION update_pod_timestamp();

CREATE TRIGGER trg_update_pod_on_message
  AFTER INSERT ON pod_messages
  FOR EACH ROW EXECUTE FUNCTION update_pod_timestamp();
