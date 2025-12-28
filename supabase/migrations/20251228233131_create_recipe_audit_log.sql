/*
  # Recipe Audit Log Table

  This migration creates an audit log table to track recipe deletions and modifications
  during the duplicate cleanup process. This ensures we can restore recipes if needed.

  1. New Tables
    - `recipe_audit_log`
      - `id` (uuid, primary key) - Unique log entry ID
      - `recipe_id` (uuid) - ID of the affected recipe
      - `action` (text) - Type of action (deleted, merged, restored)
      - `recipe_data` (jsonb) - Full snapshot of recipe data before action
      - `performed_by` (uuid) - User who performed the action
      - `reason` (text) - Reason for the action
      - `related_recipe_ids` (jsonb) - IDs of related recipes (for merges)
      - `created_at` (timestamp) - When the action occurred

  2. Security
    - Enable RLS on `recipe_audit_log` table
    - Only admins can insert audit log entries
    - Only admins can read audit log entries
*/

CREATE TABLE IF NOT EXISTS recipe_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('deleted', 'merged', 'restored', 'updated')),
  recipe_data jsonb NOT NULL,
  performed_by uuid REFERENCES auth.users(id),
  reason text,
  related_recipe_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recipe_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can insert audit logs"
  ON recipe_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can view audit logs"
  ON recipe_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_recipe_audit_log_recipe_id ON recipe_audit_log(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_audit_log_action ON recipe_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_recipe_audit_log_created_at ON recipe_audit_log(created_at DESC);
