import { base44 } from "@/api/base44Client";

export async function clearDebugBatchSettings() {
  const recipes = await base44.entities.Recipe.list();

  const debugRecipes = recipes.filter(
    (r) => r.batch_settings && r.batch_settings._debug_flag === "BATCH_TEST"
  );

  console.log("[BatchCleanup] Found debug recipes:", debugRecipes.length);

  for (const r of debugRecipes) {
    console.log("[BatchCleanup] Clearing batch_settings for", r.id, r.name);
    await base44.entities.Recipe.update(r.id, { batch_settings: null });
  }

  return debugRecipes.length;
}