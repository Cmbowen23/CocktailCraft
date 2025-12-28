import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvFile() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envFile = readFileSync(envPath, 'utf8');

    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const [key, ...values] = trimmed.split('=');
      const value = values.join('=');

      if (key && value) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn('Could not load .env file:', error.message);
  }
}

loadEnvFile();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findDuplicates() {
  console.log('Finding duplicate recipes...\n');

  let allRecipes = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error, count } = await supabase
      .from('recipes')
      .select('id, name, is_cocktail, created_at, legacy_id', { count: 'exact' })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching recipes:', error);
      return [];
    }

    allRecipes = allRecipes.concat(data || []);

    if (!data || data.length < pageSize) break;
    page++;
  }

  console.log(`Fetched ${allRecipes.length} total recipes`);

  if (allRecipes.length === 0) {
    console.error('No recipes found in database');
    return [];
  }

  const nameGroups = {};
  allRecipes.forEach(recipe => {
    const key = recipe.name;
    if (!nameGroups[key]) {
      nameGroups[key] = [];
    }
    nameGroups[key].push(recipe);
  });

  const duplicateGroups = [];
  Object.entries(nameGroups).forEach(([name, recipes]) => {
    if (recipes.length > 1) {
      duplicateGroups.push({
        name,
        count: recipes.length,
        recipes: recipes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      });
    }
  });

  duplicateGroups.sort((a, b) => b.count - a.count);

  return duplicateGroups;
}

async function deduplicateRecipes(dryRun = true) {
  console.log('=== Recipe Deduplication Tool ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (recipes will be deleted)'}\n`);

  const duplicateGroups = await findDuplicates();

  if (duplicateGroups.length === 0) {
    console.log('No duplicates found!');
    return;
  }

  console.log(`Found ${duplicateGroups.length} recipe names with duplicates:\n`);

  let totalToDelete = 0;
  const deletionPlan = [];

  duplicateGroups.forEach(group => {
    console.log(`\n"${group.name}" - ${group.count} copies`);
    console.log('  Keeping most recent:', group.recipes[0].id, '(created:', new Date(group.recipes[0].created_at).toISOString(), ')');

    for (let i = 1; i < group.recipes.length; i++) {
      const recipe = group.recipes[i];
      console.log(`  Deleting:`, recipe.id, '(created:', new Date(recipe.created_at).toISOString(), ')');
      deletionPlan.push(recipe.id);
      totalToDelete++;
    }
  });

  console.log(`\n\n=== Summary ===`);
  console.log(`Total duplicate groups: ${duplicateGroups.length}`);
  console.log(`Total recipes to delete: ${totalToDelete}`);
  console.log(`Total recipes to keep: ${duplicateGroups.length}`);

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made.');
    console.log('To execute deletions, run: node scripts/deduplicate-recipes.js --execute');
    return;
  }

  console.log('\n🔥 Executing deletions...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const id of deletionPlan) {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`❌ Failed to delete ${id}:`, error.message);
      errorCount++;
    } else {
      successCount++;
      process.stdout.write(`✓ Deleted ${successCount}/${totalToDelete}\r`);
    }
  }

  console.log(`\n\n=== Final Results ===`);
  console.log(`✅ Successfully deleted: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`\n✨ Deduplication complete!`);
}

const args = process.argv.slice(2);
const execute = args.includes('--execute');

deduplicateRecipes(!execute).catch(console.error);
