-- Diagnostic: Check Pods Schema State

-- 1. Check if tables exist
SELECT
  'accountability_pods' as table_name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accountability_pods') as exists
UNION ALL
SELECT
  'pod_members',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pod_members')
UNION ALL
SELECT
  'pod_commitments',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pod_commitments')
UNION ALL
SELECT
  'pod_messages',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pod_messages');

-- 2. Check columns in accountability_pods
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'accountability_pods'
ORDER BY ordinal_position;

-- 3. Check if RLS is enabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('accountability_pods', 'pod_members', 'pod_commitments', 'pod_messages');

-- 4. List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('accountability_pods', 'pod_members', 'pod_commitments', 'pod_messages')
ORDER BY tablename, policyname;

-- 5. Test a simple query (as authenticated user)
-- This should work if tables + RLS are configured correctly
SELECT count(*) as total_pods FROM accountability_pods;

-- 6. Check for any existing pods
SELECT id, name, creator_id, created_at
FROM accountability_pods
LIMIT 5;
