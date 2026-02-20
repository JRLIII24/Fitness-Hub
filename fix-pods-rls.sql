-- Fix: Infinite Recursion in pod_members RLS Policy

-- 1. Drop the problematic policy
DROP POLICY IF EXISTS "Users can read pod members" ON pod_members;

-- 2. Create a SECURITY DEFINER function to check membership (bypasses RLS)
CREATE OR REPLACE FUNCTION user_is_pod_member(p_pod_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pod_members
    WHERE pod_id = p_pod_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the policy using the helper function
CREATE POLICY "Users can read pod members"
  ON pod_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_is_pod_member(pod_id, auth.uid())
  );
