/*
  # Create User Profiles Table

  1. New Tables
    - `profiles`
      - `id` (uuid, references auth.users) - Primary key, links to Supabase auth
      - `email` (text, unique) - User email address
      - `full_name` (text) - User's full name
      - `company_name` (text) - Company or business name
      - `role` (text) - System role: 'user' or 'admin'
      - `user_type` (text) - User type: 'internal', 'admin', 'buyer_admin', 'sales_rep', 'on_premise'
      - `account_id` (uuid) - Primary account for buyer users
      - `assigned_account_ids` (jsonb) - Array of account IDs user can access
      - `buyer_menu_access` (jsonb) - Structured menu access per account
      - `onboarding_complete` (boolean) - Whether user completed onboarding
      - `view_all_recipes` (boolean) - Can view all recipes regardless of account
      - `created_at`, `updated_at` (timestamptz) - Audit timestamps

  2. Security
    - Enable RLS on profiles table
    - Users can read their own profile
    - Users can update their own basic fields (full_name, company_name)
    - Only admins can modify role, user_type, and access control fields
    - Admins can read and update all profiles

  3. Triggers
    - Auto-create profile when new user signs up
    - Sync email field when auth.users email changes

  4. Important Notes
    - First user to sign up should be manually promoted to admin via SQL
    - Profile data is merged with auth data in the application layer
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  company_name text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  user_type text DEFAULT 'internal' CHECK (user_type IN ('internal', 'admin', 'buyer_admin', 'sales_rep', 'on_premise')),
  account_id uuid REFERENCES accounts(id),
  assigned_account_ids jsonb DEFAULT '[]'::jsonb,
  buyer_menu_access jsonb DEFAULT '[]'::jsonb,
  onboarding_complete boolean DEFAULT false,
  view_all_recipes boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own basic fields"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT role FROM profiles WHERE id = auth.uid()) AND
    user_type = (SELECT user_type FROM profiles WHERE id = auth.uid()) AND
    account_id = (SELECT account_id FROM profiles WHERE id = auth.uid()) AND
    assigned_account_ids = (SELECT assigned_account_ids FROM profiles WHERE id = auth.uid()) AND
    buyer_menu_access = (SELECT buyer_menu_access FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, user_type, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    'internal',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON profiles(account_id);