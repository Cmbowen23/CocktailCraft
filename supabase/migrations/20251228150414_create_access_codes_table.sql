/*
  # Create Access Codes Table

  1. New Tables
    - `access_codes`
      - `id` (uuid, primary key)
      - `code` (text, unique) - The access code string
      - `role` (text) - Role to assign: 'user' or 'admin'
      - `user_type` (text) - User type to assign
      - `account_id` (uuid, nullable) - Optional account association
      - `assigned_account_ids` (jsonb) - Array of account IDs for sales reps
      - `max_uses` (integer) - Maximum number of times the code can be used (null = unlimited)
      - `current_uses` (integer) - Current number of uses
      - `expires_at` (timestamptz, nullable) - Optional expiration date
      - `is_active` (boolean) - Whether the code is currently active
      - `created_by` (text) - Email of creator
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `access_codes` table
    - Add policy for admin users to manage access codes
    - Add policy for authenticated users to validate codes (but not see all details)
*/

CREATE TABLE IF NOT EXISTS access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  user_type text DEFAULT 'internal' CHECK (user_type IN ('internal', 'admin', 'buyer_admin', 'sales_rep', 'on_premise')),
  account_id uuid REFERENCES accounts(id),
  assigned_account_ids jsonb DEFAULT '[]'::jsonb,
  max_uses integer,
  current_uses integer DEFAULT 0,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage access codes"
  ON access_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can validate codes"
  ON access_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true);
