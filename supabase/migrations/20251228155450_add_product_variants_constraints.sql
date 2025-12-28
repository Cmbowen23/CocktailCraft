/*
  # Add Check Constraints to Product Variants

  1. Constraints
    - Ensure purchase_quantity is positive
    - Ensure prices are non-negative
    - Ensure at least one pricing method is provided (purchase_price OR case pricing)
*/

-- Add constraint to ensure purchase_quantity is positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'positive_purchase_quantity' AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants 
      ADD CONSTRAINT positive_purchase_quantity 
      CHECK (purchase_quantity > 0);
  END IF;
END $$;

-- Add constraint to ensure prices are non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'positive_prices' AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants 
      ADD CONSTRAINT positive_prices 
      CHECK (
        (purchase_price IS NULL OR purchase_price >= 0) AND
        (case_price IS NULL OR case_price >= 0)
      );
  END IF;
END $$;

-- Add constraint to ensure at least one pricing method exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'has_pricing' AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants 
      ADD CONSTRAINT has_pricing 
      CHECK (
        purchase_price IS NOT NULL OR
        (case_price IS NOT NULL AND bottles_per_case IS NOT NULL AND bottles_per_case > 0)
      );
  END IF;
END $$;