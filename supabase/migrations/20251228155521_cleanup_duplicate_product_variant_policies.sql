/*
  # Clean Up Duplicate Product Variant Policies

  1. Changes
    - Remove duplicate RLS policies that were created during migration re-runs
    - Keep only one set of policies for each operation
*/

-- Drop duplicate policies (keeping the ones with "product_variants" naming)
DROP POLICY IF EXISTS "Authenticated users can read product variants" ON product_variants;
DROP POLICY IF EXISTS "Authenticated users can insert product variants" ON product_variants;
DROP POLICY IF EXISTS "Authenticated users can update product variants" ON product_variants;
DROP POLICY IF EXISTS "Authenticated users can delete product variants" ON product_variants;