# Database Cleanup Scripts

This directory contains utility scripts for maintaining and fixing data issues in the database.

## deduplicate-recipes.sql (RECOMMENDED)

SQL script to remove duplicate recipes from the database, keeping the most recent version.

### What it does:
- Identifies all recipes with duplicate names
- Keeps the most recent version (by created_at timestamp)
- Deletes older duplicate versions
- Provides a preview query before execution

### Usage:

**Step 1: Preview duplicates**

Run this query to see what would be deleted:

```sql
SELECT
  name,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at DESC) as recipe_ids
FROM recipes
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

**Step 2: Execute deletion**

Uncomment and run the DO block in the SQL file to delete duplicates.

**Step 3: Add unique constraint**

After successful deduplication:
```sql
ALTER TABLE recipes ADD CONSTRAINT recipes_name_unique UNIQUE (name);
```

### When to use:
- After bulk imports that created duplicates
- When the recipe page shows multiple copies of the same recipe
- Before applying the unique constraint migration

---

## deduplicate-recipes.js (Alternative - Has RLS Issues)

Node.js script to remove duplicates. **Note:** This currently doesn't work due to Row Level Security requiring authentication.

### Issue:
The script uses the anon key which cannot read recipes due to RLS policies requiring authenticated users.

### Solution:
Use the SQL script above instead, which runs with proper database permissions.

---

## fix-recipe-json.js

Fixes malformed JSON in recipe fields by attempting to parse and correct common JSON errors.

### What it does:
- Scans all recipes in the database
- Identifies JSON fields with parsing errors (ingredients, tags, garnish, allergens, prep_actions, batch_settings)
- Attempts to fix common issues:
  - Unquoted property names (e.g., `{name: "test"}` → `{"name": "test"}`)
  - Unquoted string values (e.g., `"type": Nutmeg` → `"type": "Nutmeg"`)
  - Trailing commas (e.g., `[1, 2,]` → `[1, 2]`)
- Updates recipes with corrected JSON
- Sets empty arrays for fields that cannot be fixed

### Usage:

```bash
# Run the script
node scripts/fix-recipe-json.js
```

### Output:
The script will log:
- Each recipe being processed
- Success/failure for each field fix attempt
- Summary of total recipes, fixes, and errors

### Safety:
- The script only updates fields with malformed JSON
- Invalid fields are set to safe defaults (empty arrays for list fields, null for object fields)
- No data is deleted, only corrected or defaulted

### When to use:
- After importing recipes from external sources
- When recipe pages show blank or have console errors about JSON parsing
- As part of database maintenance

---

## Migration: add_recipe_name_unique_constraint

Adds a database constraint to prevent duplicate recipe names from being created in the future.

### Prerequisites:
**You must run `deduplicate-recipes.js --execute` FIRST** to remove existing duplicates. The migration will fail if any duplicates exist.

### What it does:
- Adds a UNIQUE constraint on the `recipes.name` column
- Prevents the database from accepting duplicate recipe names
- Ensures data integrity going forward

### How to apply:
The migration is already in the migrations folder and will be automatically applied after duplicates are removed.
