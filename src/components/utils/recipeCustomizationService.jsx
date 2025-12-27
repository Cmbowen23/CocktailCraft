import { RecipeCustomization } from '@/api/entities';
import { User } from '@/api/entities';

/**
 * Checks if the current user is a buyer user (buyer_admin or buyer_staff)
 */
export const isBuyerUser = (user) => {
  return user && (user.user_type === 'buyer_admin' || user.user_type === 'buyer_staff');
};

/**
 * Checks if the current user is an internal user (admin or internal)
 */
export const isInternalUser = (user) => {
  return user && (user.user_type === 'admin' || user.user_type === 'internal');
};

/**
 * Loads a recipe with buyer customizations applied if applicable
 * @param {object} recipe - The original recipe object
 * @param {object} user - The current user object
 * @returns {object} The recipe with customizations applied (if any)
 */
export const loadRecipeWithCustomizations = async (recipe, user) => {
  if (!recipe || !user) return recipe;
  
  // Only apply customizations for buyer users
  if (!isBuyerUser(user) || !user.account_id) {
    return recipe;
  }

  try {
    // Look for a customization record for this recipe and buyer's account
    const customizations = await RecipeCustomization.filter({
      original_recipe_id: recipe.id,
      account_id: user.account_id
    });

    if (customizations && customizations.length > 0) {
      const customization = customizations[0];
      
      // Apply customizations to the recipe
      return {
        ...recipe,
        name: customization.custom_name || recipe.name,
        description: customization.custom_description || recipe.description,
        ingredients: customization.custom_ingredients || recipe.ingredients,
        instructions: customization.custom_instructions || recipe.instructions,
        garnish: customization.custom_garnish || recipe.garnish,
        glassware: customization.custom_glassware || recipe.glassware,
        difficulty: customization.custom_difficulty || recipe.difficulty,
        yield_amount: customization.custom_yield_amount || recipe.yield_amount,
        yield_unit: customization.custom_yield_unit || recipe.yield_unit,
        batch_settings: customization.custom_batch_settings || recipe.batch_settings,
        menu_price: customization.custom_menu_price || recipe.menu_price,
        _customization_id: customization.id, // Store the customization ID for updates
        _is_customized: true // Flag to indicate this recipe has customizations
      };
    }

    return recipe;
  } catch (error) {
    console.error('Error loading recipe customizations:', error);
    return recipe;
  }
};

/**
 * Loads multiple recipes with customizations applied
 * @param {array} recipes - Array of recipe objects
 * @param {object} user - The current user object
 * @returns {array} Array of recipes with customizations applied
 */
export const loadRecipesWithCustomizations = async (recipes, user) => {
  if (!recipes || !Array.isArray(recipes) || recipes.length === 0) return recipes;
  if (!user || !isBuyerUser(user)) return recipes;

  return Promise.all(
    recipes.map(recipe => loadRecipeWithCustomizations(recipe, user))
  );
};

/**
 * Saves recipe customizations for a buyer user
 * @param {object} recipe - The recipe object with modifications
 * @param {object} originalRecipe - The original recipe before modifications
 * @param {object} user - The current user object
 * @returns {object} The saved customization record
 */
export const saveRecipeCustomization = async (recipe, originalRecipe, user) => {
  if (!user || !isBuyerUser(user) || !user.account_id) {
    throw new Error('Only buyer users can save customizations');
  }

  if (!recipe || !originalRecipe) {
    throw new Error('Recipe and original recipe are required');
  }

  // Prepare customization data (only save fields that differ from original)
  const customizationData = {
    original_recipe_id: originalRecipe.id,
    account_id: user.account_id,
    last_modified_by: user.id
  };

  // Only save custom fields if they differ from the original
  if (recipe.name !== originalRecipe.name) {
    customizationData.custom_name = recipe.name;
  }
  if (recipe.description !== originalRecipe.description) {
    customizationData.custom_description = recipe.description;
  }
  if (JSON.stringify(recipe.ingredients) !== JSON.stringify(originalRecipe.ingredients)) {
    customizationData.custom_ingredients = recipe.ingredients;
  }
  if (JSON.stringify(recipe.instructions) !== JSON.stringify(originalRecipe.instructions)) {
    customizationData.custom_instructions = recipe.instructions;
  }
  if (recipe.garnish !== originalRecipe.garnish) {
    customizationData.custom_garnish = recipe.garnish;
  }
  if (recipe.glassware !== originalRecipe.glassware) {
    customizationData.custom_glassware = recipe.glassware;
  }
  if (recipe.difficulty !== originalRecipe.difficulty) {
    customizationData.custom_difficulty = recipe.difficulty;
  }
  if (recipe.yield_amount !== originalRecipe.yield_amount) {
    customizationData.custom_yield_amount = recipe.yield_amount;
  }
  if (recipe.yield_unit !== originalRecipe.yield_unit) {
    customizationData.custom_yield_unit = recipe.yield_unit;
  }
  if (JSON.stringify(recipe.batch_settings) !== JSON.stringify(originalRecipe.batch_settings)) {
    customizationData.custom_batch_settings = recipe.batch_settings;
  }
  if (recipe.menu_price !== originalRecipe.menu_price) {
    customizationData.custom_menu_price = recipe.menu_price;
  }

  try {
    // Check if a customization already exists
    if (recipe._customization_id) {
      // Update existing customization
      return await RecipeCustomization.update(recipe._customization_id, customizationData);
    } else {
      // Create new customization
      return await RecipeCustomization.create(customizationData);
    }
  } catch (error) {
    console.error('Error saving recipe customization:', error);
    throw error;
  }
};