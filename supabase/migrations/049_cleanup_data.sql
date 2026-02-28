-- ============================================================================
-- Migration 049: Clean All Data (Dev Only)
-- ============================================================================
-- Removes all user data except auth.users and profiles.
-- Safe to run on local development databases only.
-- Deletes in order respecting FK constraints (leaf tables first).

-- Delete in order of FK dependencies
delete from public.workout_sets;
delete from public.run_sessions;
delete from public.workout_sessions;
delete from public.pod_messages;
delete from public.pod_challenges;
delete from public.pod_members;
delete from public.accountability_pods;
delete from public.template_reviews;
delete from public.template_saves;
delete from public.template_exercises;
delete from public.workout_templates;
