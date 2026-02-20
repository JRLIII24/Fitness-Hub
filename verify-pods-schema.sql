-- Verification script: Check if Pods tables and triggers exist

-- Check tables
SELECT
  tablename,
  'EXISTS' as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('accountability_pods', 'pod_members', 'pod_commitments', 'pod_messages')
ORDER BY tablename;

-- Check triggers
SELECT
  trigger_name,
  event_object_table,
  'EXISTS' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_auto_add_creator', 'trg_update_pod_on_member_change', 'trg_update_pod_on_message')
ORDER BY trigger_name;

-- Check RLS policies
SELECT
  tablename,
  policyname,
  'EXISTS' as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('accountability_pods', 'pod_members', 'pod_commitments', 'pod_messages')
ORDER BY tablename, policyname;
