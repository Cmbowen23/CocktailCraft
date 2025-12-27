import { base44 } from "@/api/base44Client";
import { alcoholicCategories } from "@/components/utils/categoryDefinitions";

export const InventoryService = {
  addRecipesToInventory: async (recipes, accountId) => {
    if (!recipes || recipes.length === 0 || !accountId) return 0;

    try {
      const ingredientNames = new Set();
      const batchRecipeIds = new Set();

      // Check batch settings before exploding ingredients
      recipes.forEach(recipe => {
        const settings = recipe.batch_settings || {};
        const isBatchTracked = settings.inventory_bottle?.enabled || settings.track_batch_inventory;

        if (isBatchTracked) {
             batchRecipeIds.add(recipe.id);
        } else {
             recipe.ingredients?.forEach(ing => {
               if (ing.ingredient_name) ingredientNames.add(ing.ingredient_name);
             });
        }
      });

      if (ingredientNames.size === 0 && batchRecipeIds.size === 0) return 0;

      const allIngredients = await base44.entities.Ingredient.list();
      
      const relevantIngredients = allIngredients.filter(ing => 
        (ingredientNames.has(ing.name) || batchRecipeIds.has(ing.sub_recipe_id)) && 
        (
          ing.is_liquor_portfolio_item || 
          (ing.category && alcoholicCategories.includes(ing.category.toLowerCase())) ||
          batchRecipeIds.has(ing.sub_recipe_id)
        )
      );

      if (relevantIngredients.length === 0) return 0;
      const relevantIngredientIds = relevantIngredients.map(i => i.id);

      const allVariants = await base44.entities.ProductVariant.list(); 
      const relevantVariants = allVariants.filter(v => relevantIngredientIds.includes(v.ingredient_id));

      if (relevantVariants.length === 0) return 0;

      const existingInventory = await base44.entities.InventoryItem.filter({ account_id: accountId });
      const existingVariantIds = new Set(existingInventory.map(i => i.product_variant_id));

      const itemsToCreate = relevantVariants
        .filter(v => !existingVariantIds.has(v.id))
        .map(v => ({
          product_variant_id: v.id,
          ingredient_id: v.ingredient_id,
          account_id: accountId,
          current_stock: 0,
          reorder_point: 0,
          unit: 'bottle',
          location_id: null
        }));

      if (itemsToCreate.length > 0) {
        await Promise.all(itemsToCreate.map(item => base44.entities.InventoryItem.create(item)));
      }

      // Sync batch recipes with inventory_bottle enabled
      const { ensureInventoryItemForBatchRecipe } = await import('@/components/utils/batchInventoryService');
      for (const recipe of recipes) {
        const settings = recipe.batch_settings || {};
        if (settings.inventory_bottle?.enabled && settings.inventory_bottle?.size_ml) {
          console.log(`[MenuAddToInventory] Syncing batch inventory for recipe: ${recipe.name}`);
          try {
            await ensureInventoryItemForBatchRecipe({
              recipe,
              allIngredients,
              accountId
            });
            console.log(`[MenuAddToInventory] Successfully synced batch inventory for: ${recipe.name}`);
          } catch (err) {
            console.error(`[MenuAddToInventory] Failed to sync batch inventory for ${recipe.name}:`, err);
          }
        }
      }

      return itemsToCreate.length;

    } catch (error) {
      console.error("Error adding to inventory:", error);
      throw error;
    }
  },

  addMenuToInventory: async (menuId, accountId) => {
    if (!menuId || !accountId) return 0;
    try {
      const [menu] = await base44.entities.Menu.filter({ id: menuId });
      if (!menu) throw new Error("Menu not found");
      const recipeOrder = menu.customer_menu_settings?.recipe_order || [];
      const allRecipes = await base44.entities.Recipe.list();
      const menuRecipes = allRecipes.filter(r => 
           recipeOrder.includes(r.id) || r.menu_id === menuId
      );
      return await InventoryService.addRecipesToInventory(menuRecipes, accountId);
    } catch (error) {
      console.error("Error adding menu to inventory:", error);
      throw error;
    }
  }
};