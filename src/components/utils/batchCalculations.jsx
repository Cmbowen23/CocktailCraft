import { convertToMl, calculateRecipeCost } from "./costCalculations";

/**
 * Calculates batch cost, volume, and servings for display purposes.
 * Returns totals for the ENTIRE batch (all containers), plus per-container details if applicable.
 */
export function calculateBatchCostAndYield({ recipe, allIngredients }) {
    if (!recipe || !recipe.batch_settings) return null;

    const settings = recipe.batch_settings;
    const overrides = settings.ingredient_overrides || {};
    const scaleFactor = settings.scale_factor || 1;
    const containerCount = settings.container_count || 1;
    
    // Filter ingredients included in batch
    const hasOverrides = Object.keys(overrides).length > 0;
    
    const batchIngredients = (recipe.ingredients || []).filter(ing => {
        if (hasOverrides) {
            return overrides[ing.ingredient_name] === 'batch';
        }
        return true; // Default to all if no overrides
    });

    if (batchIngredients.length === 0) return null;

    // 1. Calculate Cost of Batch Ingredients (at 1x scale)
    const dummyRecipe = { ...recipe, ingredients: batchIngredients };
    const costResult = calculateRecipeCost(dummyRecipe, allIngredients);
    const costAtSingleScale = costResult.totalCost;

    // 2. Calculate Volume of Batch Ingredients (at 1x scale)
    let volumeMlAtSingleScale = 0;
    batchIngredients.forEach(ing => {
        volumeMlAtSingleScale += convertToMl(ing.amount, ing.unit, ing.ingredient_name, allIngredients);
    });

    // 3. Apply Scale Factor
    let totalBatchCost = costAtSingleScale * scaleFactor;
    let totalBatchVolumeMl = volumeMlAtSingleScale * scaleFactor;

    // 4. Add Dilution
    if (settings.include_dilution) {
        const dilutionPct = settings.dilution_percentage || 0;
        totalBatchVolumeMl = totalBatchVolumeMl * (1 + (dilutionPct / 100));
    }

    // 5. Add Clarification
    if (settings.clarification?.enabled) {
        const ratio = settings.clarification.agent_ratio_percentage || 0;
        // Approximate volume addition from agent
        const agentMl = (volumeMlAtSingleScale * scaleFactor) * (ratio / 100);
        totalBatchVolumeMl += agentMl;

        // Add Cost of Agent
        const agentName = settings.clarification.agent_ingredient_name || 
            (settings.clarification.technique === 'milk_wash' ? 'Whole Milk' : 'Clarification Agent');
        
        // Simple manual cost lookup
        // We need to convert agentMl to ingredient unit
        // Just use calculateRecipeCost for the agent to handle unit conversions properly
        const agentRecipe = { 
            ingredients: [{ ingredient_name: agentName, amount: agentMl, unit: 'ml' }] 
        };
        const agentCostRes = calculateRecipeCost(agentRecipe, allIngredients);
        totalBatchCost += agentCostRes.totalCost;
    }

    // Calculate Servings
    // Single serving volume (diluted if applicable, to match batch state? No, yield is usually pre-dilution for cocktails unless specified)
    // Actually, scaleFactor IS the number of servings if the batch is just a scaled version of the single drink.
    // If scaleFactor is 10, we have 10 servings.
    const servings = scaleFactor;

    return {
        totalVolumeMl: totalBatchVolumeMl,
        totalCost: totalBatchCost,
        servings: servings,
        containerType: settings.container_type || "Custom",
        containerCount: containerCount,
        costPerContainer: totalBatchCost / (containerCount || 1),
        volumePerContainer: totalBatchVolumeMl / (containerCount || 1)
    };
}

// Alias for backward compatibility if needed, and to fix the import error
export const calculateBatchMetrics = calculateBatchCostAndYield;