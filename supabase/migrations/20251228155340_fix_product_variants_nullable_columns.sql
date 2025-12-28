/*
  # Fix Product Variants Column Constraints

  1. Changes
    - Make size_ml nullable (it's calculated and may not always be present)
    - Make purchase_price nullable (since has_pricing constraint allows case pricing instead)
    - Remove created_by_id and is_sample columns (not in original schema requirement)

  2. Security
    - No changes to RLS policies
*/

-- Make size_ml nullable (it's calculated from purchase_quantity and purchase_unit)
ALTER TABLE product_variants ALTER COLUMN size_ml DROP NOT NULL;

-- Make purchase_price nullable (has_pricing constraint handles validation)
ALTER TABLE product_variants ALTER COLUMN purchase_price DROP NOT NULL;

-- Remove columns that aren't needed for the core functionality
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'created_by_id'
  ) THEN
    ALTER TABLE product_variants DROP COLUMN created_by_id;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'is_sample'
  ) THEN
    ALTER TABLE product_variants DROP COLUMN is_sample;
  END IF;
END $$;