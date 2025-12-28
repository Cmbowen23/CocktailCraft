-- Recipe Deduplication Script
-- This script removes duplicate recipes, keeping the most recent version of each

-- First, let's see what duplicates exist
SELECT
  name,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at DESC) as recipe_ids,
  array_agg(created_at ORDER BY created_at DESC) as created_dates
FROM recipes
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- To execute the deletion, run this:
-- WARNING: This will permanently delete duplicate recipes!
-- Only the most recent version of each recipe will be kept.

/*
DO $$
DECLARE
  recipe_group RECORD;
  ids_to_delete uuid[];
BEGIN
  FOR recipe_group IN
    SELECT
      name,
      array_agg(id ORDER BY created_at DESC) as all_ids
    FROM recipes
    GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first ID (most recent), delete the rest
    ids_to_delete := recipe_group.all_ids[2:array_length(recipe_group.all_ids, 1)];

    -- Delete the duplicates
    DELETE FROM recipes
    WHERE id = ANY(ids_to_delete);

    RAISE NOTICE 'Deleted % duplicates for recipe: %', array_length(ids_to_delete, 1), recipe_group.name;
  END LOOP;

  RAISE NOTICE 'Deduplication complete!';
END $$;
*/

-- After successful deduplication, add the unique constraint:
-- ALTER TABLE recipes ADD CONSTRAINT recipes_name_unique UNIQUE (name);
