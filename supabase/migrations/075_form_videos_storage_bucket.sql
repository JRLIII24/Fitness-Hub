-- Migration 075: Create form-videos storage bucket + RLS policies
-- This was missing from migration 072 which only created the tables.

-- Create the private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-videos',
  'form-videos',
  false,
  104857600, -- 100 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "Users upload own form videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'form-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: authenticated users can read their own files
CREATE POLICY "Users read own form videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'form-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: authenticated users can delete their own files
CREATE POLICY "Users delete own form videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'form-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: service role can manage all files (for cron cleanup)
CREATE POLICY "Service role manages form videos"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'form-videos')
  WITH CHECK (bucket_id = 'form-videos');
