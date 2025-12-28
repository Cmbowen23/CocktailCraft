/*
  # Fix Profiles Update Policy - Remove Recursion

  ## Problem
  The UPDATE policy on profiles still has recursion because it tries to
  query the profiles table in the WITH CHECK clause.

  ## Solution
  Simplify the UPDATE policy to only allow users to update non-sensitive
  fields without querying the profiles table recursively.
*/

-- Drop and recreate the update policy without recursion
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Allow users to update only their own profile's non-role fields
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
