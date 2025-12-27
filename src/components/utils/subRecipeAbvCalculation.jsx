import { convertToMl, findMatchingIngredient } from "./costCalculations";
import { isAlcoholicIngredient } from './categoryDefinitions';

/**
 * Calculates the ABV for a sub-recipe based on its ingredients
 * @param {Object} recipe - The sub-recipe object
 * @param {Array|Map} allIngredients - Array of all available ingredients or a Map for faster lookup
 * @returns {number} - The calculated ABV as a percentage (e.g., 25 for 25%)
 */
export const calculateSubRecipeABV = (recipe, allIngredients) => {
    if (!recipe || !recipe.ingredients || !Array.isArray(recipe.ingredients)) {
        return 0;
    }

    // OPTIMIZATION: Create a Map if an array is passed to ensure O(1) lookups
    // This handles both the legacy array case and the optimized Map case
    const ingredientsMap = (allIngredients instanceof Map)
        ? allIngredients
        : (Array.isArray(allIngredients)
            ? new Map(allIngredients.map(i => [i.name.toLowerCase().trim(), i]))
            : new Map());

    let totalAlcoholMl = 0;
    let totalVolumeMl = 0;

    // Robust check for "wash" category, ignoring case and whitespace
    const isWashRecipe = recipe.category && recipe.category.trim().toLowerCase() === 'wash';

    recipe.ingredients.forEach(recipeIngredient => {
        if (!recipeIngredient || typeof recipeIngredient !== 'object') return;

        let ingredientName = recipeIngredient.ingredient_name || '';
        let prepAction = recipeIngredient.prep_action || '';
        
        // Handle comma-separated ingredient names with prep actions
        if (ingredientName && ingredientName.includes(',') && !prepAction) {
            const parts = ingredientName.split(',');
            ingredientName = (parts[0] || '').trim();
            prepAction = parts.length > 1 ? parts.slice(1).join(',').trim() : '';
        }

        // Use the optimized findMatchingIngredient (which supports Map)
        const matchedIngredient = findMatchingIngredient(ingredientName, ingredientsMap);
        const amount = parseFloat(recipeIngredient.amount) || 0;
        
        if (amount > 0) {
            // Pass the map to convertToMl to avoid O(N) search inside the converter
            const volumeInMl = convertToMl(amount, recipeIngredient.unit, ingredientName, ingredientsMap);
            
            if (volumeInMl > 0) {
                // For 'wash' recipes, only add volume of alcoholic ingredients to totalVolumeMl
                // For other recipes, add all volumes
                if (isWashRecipe) {
                    if (matchedIngredient && isAlcoholicIngredient(matchedIngredient)) {
                        totalVolumeMl += volumeInMl;
                    }
                } else {
                    totalVolumeMl += volumeInMl;
                }
                
                // Alcohol calculation remains the same for both types (sum all alcohol)
                if (matchedIngredient && parseFloat(matchedIngredient.abv) > 0) {
                    totalAlcoholMl += volumeInMl * (parseFloat(matchedIngredient.abv) / 100);
                }
            }
        }
    });

    // Calculate ABV as a percentage and round to 1 decimal place
    const abvPercentage = totalVolumeMl > 0 ? (totalAlcoholMl / totalVolumeMl) * 100 : 0;
    return Math.round(abvPercentage * 10) / 10;
};