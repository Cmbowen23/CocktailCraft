/*
  # Create Product Variants Table for Multi-Size Ingredients

  1. New Tables
    - `product_variants` - Multiple size/pricing options for ingredients
      - Supports different bottle sizes (750ml, 1L, 1.75L, etc.)
      - Tracks individual and case pricing for each size
      - Links to ingredients table for relationship management

  2. Table Updates
    - `inventory_items` - Add product_variant_id column to track specific sizes

  3. Security
    - Enable RLS on product_variants table
    - Add policies for authenticated users to manage variants
    - Authenticated users can read, insert, update, and delete variants

  4. Important Notes
    - Primarily used for alcoholic ingredients with multiple bottle sizes
    - Can be used for any ingredient that has multiple purchase size options
    - size_ml is calculated from purchase_quantity and purchase_unit for sorting
    - Either purchase_price OR (case_price AND bottles_per_case) must be provided
*/

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  size_ml numeric,
  purchase_quantity numeric NOT NULL,
  purchase_unit text NOT NULL,
  purchase_price numeric,
  case_price numeric,
  bottles_per_case numeric,
  sku_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by_id text,
  is_sample boolean DEFAULT false,
  CONSTRAINT positive_purchase_quantity CHECK (purchase_quantity > 0),
  CONSTRAINT positive_prices CHECK (
    (purchase_price IS NULL OR purchase_price >= 0) AND
    (case_price IS NULL OR case_price >= 0)
  ),
  CONSTRAINT has_pricing CHECK (
    purchase_price IS NOT NULL OR
    (case_price IS NOT NULL AND bottles_per_case IS NOT NULL AND bottles_per_case > 0)
  )
);

-- Enable RLS on product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_variants
CREATE POLICY "Authenticated users can read product variants"
  ON product_variants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert product variants"
  ON product_variants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update product variants"
  ON product_variants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete product variants"
  ON product_variants FOR DELETE
  TO authenticated
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_variants_ingredient_id ON product_variants(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku_number ON product_variants(sku_number) WHERE sku_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_size_ml ON product_variants(size_ml) WHERE size_ml IS NOT NULL;

-- Update inventory_items to support product variants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'product_variant_id'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN product_variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for inventory_items.product_variant_id
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_variant_id ON inventory_items(product_variant_id) WHERE product_variant_id IS NOT NULL;

-- Add updated_at trigger for product_variants
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_variants_updated_at'
  ) THEN
    CREATE TRIGGER update_product_variants_updated_at
      BEFORE UPDATE ON product_variants
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;