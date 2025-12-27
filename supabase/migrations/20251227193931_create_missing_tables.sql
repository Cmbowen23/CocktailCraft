/*
  # Create Missing Tables for Base44 App

  1. New Tables
    - `locations` - Physical locations or venues
    - `inventory_items` - Inventory tracking for ingredients
    - `inventory_count_logs` - Historical inventory count records
    - `inventory_reports` - Generated inventory reports
    - `training_documents` - Training and onboarding documents
    - `prep_sessions` - Bartender prep session tracking
    - `menu_templates` - Reusable menu templates
    - `recipe_versions` - Version history for recipes
    - `glassware` - Glassware catalog
    - `recipe_categories` - Recipe category definitions

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Important Notes
    - All tables include standard audit fields (created_at, updated_at)
    - UUIDs used for primary keys
    - Legacy ID fields included for data migration support
*/

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read locations"
  ON locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update locations"
  ON locations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete locations"
  ON locations FOR DELETE
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid REFERENCES ingredients(id),
  location_id uuid REFERENCES locations(id),
  quantity numeric DEFAULT 0,
  unit text,
  last_counted_at timestamptz,
  par_level numeric,
  reorder_point numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory items"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage inventory items"
  ON inventory_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS inventory_count_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES inventory_items(id),
  previous_quantity numeric,
  new_quantity numeric,
  counted_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE inventory_count_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory logs"
  ON inventory_count_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create inventory logs"
  ON inventory_count_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS inventory_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  report_date date,
  location_id uuid REFERENCES locations(id),
  data jsonb DEFAULT '[]'::jsonb,
  summary jsonb,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE inventory_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage inventory reports"
  ON inventory_reports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS training_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content jsonb DEFAULT '[]'::jsonb,
  document_type text CHECK (document_type IN ('recipe', 'procedure', 'guide', 'menu')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags jsonb DEFAULT '[]'::jsonb,
  linked_recipe_ids jsonb DEFAULT '[]'::jsonb,
  linked_menu_ids jsonb DEFAULT '[]'::jsonb,
  version numeric DEFAULT 1,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE training_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage training documents"
  ON training_documents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS prep_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  session_date date,
  menu_id uuid REFERENCES menus(id),
  linked_document_ids jsonb DEFAULT '[]'::jsonb,
  tasks jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE prep_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage prep sessions"
  ON prep_sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS menu_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  recipe_ids jsonb DEFAULT '[]'::jsonb,
  layout_config jsonb,
  is_public boolean DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE menu_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read menu templates"
  ON menu_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage own menu templates"
  ON menu_templates FOR ALL
  TO authenticated
  USING (created_by = auth.jwt()->>'email' OR is_public = true)
  WITH CHECK (created_by = auth.jwt()->>'email');

CREATE TABLE IF NOT EXISTS recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id),
  version_number numeric,
  name text,
  ingredients jsonb DEFAULT '[]'::jsonb,
  instructions jsonb DEFAULT '[]'::jsonb,
  changed_by text,
  change_notes text,
  created_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recipe versions"
  ON recipe_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create recipe versions"
  ON recipe_versions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS glassware (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  capacity_oz numeric,
  image_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE glassware ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage glassware"
  ON glassware FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS recipe_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  parent_category_id uuid REFERENCES recipe_categories(id),
  display_order numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  legacy_id text
);

ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage recipe categories"
  ON recipe_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_inventory_items_ingredient_id ON inventory_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location_id ON inventory_items(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_count_logs_inventory_item_id ON inventory_count_logs(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_prep_sessions_menu_id ON prep_sessions(menu_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe_id ON recipe_versions(recipe_id);
