/*
  # Create execute_sql RPC function

  1. New Functions
    - `execute_sql(query text)` - Executes raw SQL queries for admin users
  2. Security
    - Only admin users can execute arbitrary SQL
    - Validates user role before execution
  3. Notes
    - Used by duplicate recipe detection and other admin functions
*/

CREATE OR REPLACE FUNCTION execute_sql(query text)
RETURNS json AS $$
DECLARE
  result json;
  v_user_id uuid;
  v_role text;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get user role from profiles
  SELECT role INTO v_role FROM profiles WHERE id = v_user_id;
  
  -- Only allow admins to execute raw SQL
  IF v_role != 'admin' THEN
    RAISE EXCEPTION 'Admin access required for SQL execution';
  END IF;
  
  -- Execute the query and return results as JSON
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;