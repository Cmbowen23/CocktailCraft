/*
  # Fix Profiles Insert Policy

  ## Problem
  New users cannot create their own profile because the existing INSERT policy 
  only allows admins to insert profiles. This creates a chicken-and-egg problem
  where users need a profile to be identified as having permissions, but can't 
  create a profile in the first place.

  ## Solution
  Add a new INSERT policy that allows authenticated users to insert their own 
  profile (where the profile id matches their auth.uid()). This allows new users
  to create their initial profile during onboarding.

  ## Security
  The policy ensures:
  - Only authenticated users can insert profiles
  - Users can only insert a profile with their own user ID
  - Existing admin-only insert policy remains for creating other users' profiles
*/

-- Drop the policy if it exists, then create it
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
END $$;

-- Add policy allowing users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
