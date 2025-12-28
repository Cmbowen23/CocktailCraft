import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function attemptJSONFix(value, fieldName, recipeName) {
  if (!value) return null;

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (e) {
    console.log(`Attempting to fix ${fieldName} for recipe: ${recipeName}`);

    let fixed = value.trim();

    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    fixed = fixed.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, ':"$1"$2');

    fixed = fixed.replace(/,\s*([}\]])/g, '$1');

    try {
      const parsed = JSON.parse(fixed);
      console.log(`✓ Successfully fixed ${fieldName}`);
      return parsed;
    } catch (e2) {
      console.log(`✗ Could not fix ${fieldName}: ${e2.message}`);
      return null;
    }
  }
}

async function fixRecipeJSON() {
  console.log('Fetching all recipes...');

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*');

  if (error) {
    console.error('Error fetching recipes:', error);
    return;
  }

  console.log(`Found ${recipes.length} recipes. Checking for malformed JSON...`);

  const fieldsToCheck = ['ingredients', 'tags', 'garnish', 'allergens', 'prep_actions', 'batch_settings'];
  let fixedCount = 0;
  let errorCount = 0;

  for (const recipe of recipes) {
    const updates = {};
    let needsUpdate = false;

    for (const field of fieldsToCheck) {
      const value = recipe[field];

      if (!value) {
        if (field === 'ingredients' || field === 'tags' || field === 'allergens' || field === 'prep_actions') {
          updates[field] = [];
          needsUpdate = true;
        }
        continue;
      }

      if (typeof value === 'string') {
        const fixed = attemptJSONFix(value, field, recipe.name);

        if (fixed !== null) {
          updates[field] = fixed;
          needsUpdate = true;
        } else {
          if (field === 'ingredients' || field === 'tags' || field === 'allergens' || field === 'prep_actions') {
            console.log(`Setting ${field} to empty array for recipe: ${recipe.name}`);
            updates[field] = [];
            needsUpdate = true;
            errorCount++;
          }
        }
      }
    }

    if (needsUpdate) {
      console.log(`Updating recipe: ${recipe.name} (ID: ${recipe.id})`);

      const { error: updateError } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', recipe.id);

      if (updateError) {
        console.error(`Error updating recipe ${recipe.name}:`, updateError);
        errorCount++;
      } else {
        fixedCount++;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total recipes: ${recipes.length}`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`Errors: ${errorCount}`);
}

fixRecipeJSON().catch(console.error);
