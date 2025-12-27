import { Ingredient } from "@/api/entities";
import { Recipe } from "@/api/entities";
import { base44 } from "@/api/base44Client";
import { convertToMl } from "../utils/costCalculations";

/**
 * Converts a string to Title Case.
 */
const toTitleCase = (str) => {
    if (!str) return '';
    return str.replace(
        /\w\S*/g,
        function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
};

/**
 * Converts amount from one unit to ounces (for liquid units)
 */
const convertToOz = (amount, unit) => {
  if (!amount || !unit) return 0;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return 0;
  
  const unitLower = unit.toLowerCase().trim();
  switch (unitLower) {
    case 'oz':
    case 'fl oz': return numAmount;
    case 'ml': return numAmount / 29.5735;
    case 'cl': return numAmount * 10 / 29.5735;
    case 'l': return numAmount * 1000 / 29.5735;
    case 'qt': return numAmount * 32;
    case 'dash': return numAmount * 0.625 / 29.5735;
    case 'barspoon': return numAmount * 5 / 29.5735;
    case 'tsp': return numAmount * 5 / 29.5735;
    case 'tbsp': return numAmount * 15 / 29.5735;
    case 'cup': return numAmount * 236.588 / 29.5735;
    case 'g': return numAmount / 28.3495; // grams to oz
    default: return numAmount;
  }
};

/**
 * Checks if a unit is a liquid unit
 */
const isLiquidUnit = (unit) => {
  if (!unit || typeof unit !== 'string') return false;
  const liquidUnits = ['ml', 'cl', 'l', 'oz', 'fl oz', 'qt'];
  return liquidUnits.includes(unit.toLowerCase().trim());
};

/**
 * Saves a purchased ingredient with its prep actions embedded in the prep_actions array.
 * Calculates the cost_per_unit for the main ingredient correctly, considering case pricing.
 * Also applies title casing to the ingredient name and propagates name changes to recipes.
 */
export const saveIngredientWithPrepActions = async (formData) => {
    console.log('saveIngredientWithPrepActions called with:', formData);
    
    const { 
        name: rawName, 
        originalName,
        prep_actions: rawPrepActions,
        productVariants,
        ...restOfIngredientData 
    } = formData;
    
    const name = toTitleCase(rawName);
    const prep_actions = (rawPrepActions || []).filter(p => p.name && p.yield_amount && p.yield_unit);

    // Basic ingredient payload
    const ingredientPayload = {
        ...restOfIngredientData,
        name: name,
        prep_actions: prep_actions
    };

    // Clean up null values
    Object.keys(ingredientPayload).forEach(key => {
        if (ingredientPayload[key] === null || ingredientPayload[key] === '') {
            delete ingredientPayload[key];
        }
    });

    let savedIngredient;
    let ingredientId = formData.id;

    try {
        if (ingredientId) {
            await Ingredient.update(ingredientId, ingredientPayload);
            savedIngredient = { ...ingredientPayload, id: ingredientId };
            
            if (originalName && toTitleCase(originalName) !== name) {
                await updateRecipesWithNewIngredientName(toTitleCase(originalName), name);
            }
        } else {
            savedIngredient = await Ingredient.create(ingredientPayload);
            ingredientId = savedIngredient.id;
        }

        // Handle Product Variants
        let minCostPerUnit = Infinity;
        let primaryUnit = 'oz'; // Default for alcoholic/liquid
        let hasVariants = false;

        if (productVariants && Array.isArray(productVariants) && productVariants.length > 0) {
            hasVariants = true;
            // Get existing variants to detect deletions
            const existingVariants = await base44.entities.ProductVariant.filter({ ingredient_id: ingredientId });
            const existingVariantIds = new Set(existingVariants.map(v => v.id));
            const currentVariantIds = new Set(productVariants.filter(v => v.id).map(v => v.id));

            // Delete variants that are no longer present
            for (const existing of existingVariants) {
                if (!currentVariantIds.has(existing.id)) {
                    await base44.entities.ProductVariant.delete(existing.id);
                }
            }

            // Create/Update variants
            for (const variant of productVariants) {
                // Calculate size_ml for reliability
                const sizeMl = convertToMl(variant.purchase_quantity, variant.purchase_unit);
                
                const variantData = {
                    ingredient_id: ingredientId,
                    size_ml: sizeMl,
                    purchase_quantity: parseFloat(variant.purchase_quantity),
                    purchase_unit: variant.purchase_unit,
                    purchase_price: parseFloat(variant.purchase_price),
                    sku_number: variant.sku_number
                };

                if (variant.case_price && variant.case_price !== '') {
                    variantData.case_price = parseFloat(variant.case_price);
                } else {
                    variantData.case_price = null;
                }

                if (variant.bottles_per_case && variant.bottles_per_case !== '') {
                    variantData.bottles_per_case = parseFloat(variant.bottles_per_case);
                } else {
                    variantData.bottles_per_case = null;
                }

                if (variant.id && existingVariantIds.has(variant.id)) {
                    await base44.entities.ProductVariant.update(variant.id, variantData);
                } else {
                    await base44.entities.ProductVariant.create(variantData);
                }

                // Calculate Cost Per Unit (oz) for this variant to find lowest
                let effectivePrice = variantData.purchase_price;
                if (variantData.case_price && variantData.bottles_per_case) {
                    const caseUnitPrice = variantData.case_price / variantData.bottles_per_case;
                    if (caseUnitPrice > 0) effectivePrice = Math.min(effectivePrice, caseUnitPrice);
                }
                
                // We normalize cost to OZ for consistent comparison if it's liquid-ish
                // Or just keep it per unit if it's 'piece'
                let costPerOz = 0;
                
                // Heuristic: if unit is liquid-compatible, calculate per oz
                if (['ml', 'l', 'oz', 'fl oz', 'cl', 'qt', 'gal'].includes(variantData.purchase_unit.toLowerCase())) {
                    const totalOz = convertToMl(variantData.purchase_quantity, variantData.purchase_unit) / 29.5735;
                    if (totalOz > 0 && effectivePrice > 0) {
                         costPerOz = effectivePrice / totalOz;
                         if (costPerOz < minCostPerUnit) minCostPerUnit = costPerOz;
                         primaryUnit = 'oz';
                    }
                } else {
                    // Non-liquid (e.g. piece, kg, lb)
                    // If unit is weight, maybe convert to 'oz' (weight)?
                    // For simplicity, if not strictly liquid volume, we might calculate cost per purchase unit
                    // But we need a common denominator.
                    // Let's fallback to 'cost per purchase unit' if we can't convert to Oz easily
                    // But Ingredient entity needs a single unit.
                    // If mixed units, it's messy.
                    // Assuming consistent units for now or using the first one's unit.
                    
                    // If unit is 'g', 'kg', 'lb' -> convert to weight oz
                     if (['g', 'kg', 'lb'].includes(variantData.purchase_unit.toLowerCase())) {
                         // Convert to weight oz
                         let weightOz = 0;
                         if (variantData.purchase_unit === 'g') weightOz = variantData.purchase_quantity / 28.3495;
                         if (variantData.purchase_unit === 'kg') weightOz = (variantData.purchase_quantity * 1000) / 28.3495;
                         if (variantData.purchase_unit === 'lb') weightOz = variantData.purchase_quantity * 16;
                         
                         if (weightOz > 0 && effectivePrice > 0) {
                             costPerOz = effectivePrice / weightOz;
                             if (costPerOz < minCostPerUnit) minCostPerUnit = costPerOz;
                             primaryUnit = 'oz'; // weight oz
                         }
                     } else {
                         // Piece or other
                         const cost = effectivePrice / variantData.purchase_quantity;
                         if (cost < minCostPerUnit) {
                             minCostPerUnit = cost;
                             primaryUnit = variantData.purchase_unit;
                         }
                     }
                }
            }
        }

        // Update ingredient cost_per_unit if we found valid variants
        if (hasVariants && minCostPerUnit !== Infinity) {
            await Ingredient.update(ingredientId, {
                cost_per_unit: parseFloat(minCostPerUnit.toFixed(4)),
                unit: primaryUnit
            });
            savedIngredient.cost_per_unit = minCostPerUnit;
            savedIngredient.unit = primaryUnit;
        }

        console.log('Successfully saved ingredient and variants:', savedIngredient);
        return savedIngredient;
    } catch (error) {
        console.error('Error saving ingredient:', error);
        throw error;
    }
};

/**
 * Updates all recipes that use an ingredient when its name changes
 * @param {string} oldName - The old ingredient name (expected to be title-cased)
 * @param {string} newName - The new ingredient name (expected to be title-cased)
 */
export const updateRecipesWithNewIngredientName = async (oldName, newName) => {
    try {
        console.log(`Updating recipes: changing ingredient name from "${oldName}" to "${newName}"`);
        
        // Get all recipes
        const allRecipes = await Recipe.list();
        
        if (!Array.isArray(allRecipes) || allRecipes.length === 0) {
            console.log('No recipes found to update');
            return;
        }

        // Normalize names for comparison (case-insensitive, trimmed)
        const normalizeIngredientName = (name) => {
            return name ? name.toLowerCase().trim() : '';
        };

        const normalizedOldName = normalizeIngredientName(oldName);
        const normalizedNewName = normalizeIngredientName(newName);

        // Only proceed if names are actually different after normalization
        if (normalizedOldName === normalizedNewName) {
            console.log(`Ingredient name "${oldName}" is effectively the same as "${newName}" after normalization. No recipe updates needed.`);
            return;
        }

        let updatedRecipeCount = 0;

        // Process each recipe
        for (const recipe of allRecipes) {
            if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
                continue;
            }

            let recipeNeedsUpdate = false;
            const updatedIngredients = recipe.ingredients.map(ingredient => {
                const currentIngredientName = normalizeIngredientName(ingredient.ingredient_name);
                
                // Find matching ingredient using normalized comparison
                if (currentIngredientName === normalizedOldName) {
                    recipeNeedsUpdate = true;
                    return { 
                        ...ingredient, 
                        ingredient_name: newName // Use the exact new name (which is title-cased)
                    };
                }
                return ingredient;
            });

            // Only update the recipe if we actually found and changed an ingredient
            if (recipeNeedsUpdate) {
                await Recipe.update(recipe.id, { ingredients: updatedIngredients });
                updatedRecipeCount++;
                console.log(`Updated recipe "${recipe.name}": Changed ingredient "${oldName}" to "${newName}"`);
            }
        }

        console.log(`Successfully updated ${updatedRecipeCount} recipes with new ingredient name`);
        
    } catch (error) {
        console.error(`Error updating recipes with new ingredient name:`, error);
        // Don't throw the error - this is a nice-to-have feature, not critical
        // The ingredient name change should still succeed even if recipe updates fail
    }
};