-- ============================================================================
-- Migration 006: Fix Profile RLS and Add Ensure Profile Function
-- Adds missing INSERT policy for profiles and a helper function to ensure
-- profile exists. This fixes the issue where profiles weren't being created
-- when the auto-create trigger didn't fire.
-- ============================================================================

-- Add missing INSERT policy for profiles
-- Allows authenticated users to create their own profile record
CREATE POLICY "Users can create own profile"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Create a function that can be called to ensure a user profile exists
-- This is a safety net in case the auto-create trigger didn't fire
CREATE OR REPLACE FUNCTION ensure_user_profile(user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_email TEXT;
BEGIN
    -- Check if profile already exists
    IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
        RETURN;
    END IF;

    -- Get the user's email from auth.users
    SELECT email INTO v_email FROM auth.users WHERE id = user_id;

    -- Create the profile if it doesn't exist
    INSERT INTO profiles (id, display_name, avatar_url)
    VALUES (
        user_id,
        COALESCE(
            (SELECT raw_user_meta_data ->> 'display_name' FROM auth.users WHERE id = user_id),
            (SELECT raw_user_meta_data ->> 'full_name' FROM auth.users WHERE id = user_id),
            SPLIT_PART(v_email, '@', 1)
        ),
        (SELECT raw_user_meta_data ->> 'avatar_url' FROM auth.users WHERE id = user_id)
    )
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
