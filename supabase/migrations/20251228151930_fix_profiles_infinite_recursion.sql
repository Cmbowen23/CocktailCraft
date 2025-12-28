/*
  # Fix Infinite Recursion in Profiles RLS Policies

  ## Problem
  The admin policies on the profiles table create infinite recursion because they
  try to check if the current user is an admin by querying the profiles table,
  which itself requires passing the RLS policy, creating an infinite loop.

  ## Solution
  Redesign the policies to avoid self-referencing:
  - Keep simple policies for users to manage their own profile
  - Use service role for admin operations instead of relying on RLS policies
  - Remove the problematic admin policies that cause recursion

  ## Changes
  1. Drop all existing policies on profiles table
  2. Recreate only the safe, non-recursive policies
  3. Users can read and insert their own profile
  4. Users can update their own non-sensitive fields
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own basic fields" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create safe, non-recursive policies

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to insert their own profile during onboarding
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile (with restrictions on sensitive fields)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM profiles WHERE id = auth.uid() FOR UPDATE)
    AND user_type = (SELECT user_type FROM profiles WHERE id = auth.uid() FOR UPDATE)
  );
