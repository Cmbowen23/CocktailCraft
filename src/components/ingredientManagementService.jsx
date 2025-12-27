import { Ingredient } from "@/api/entities";

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
 * Calculates the cost_per_unit for the main ingredient correctly.
 */
export const saveIngredientWithPrepActions = async (ingredientData) => {
    console.log('saveIngredientWithPrepActions called with:', ingredientData);
    
    // 1. Extract and validate purchase data
    const purchasePrice = parseFloat(ingredientData.purchase_price) || 0;
    const purchaseQuantity = parseFloat(ingredientData.purchase_quantity) || 1;
    const purchaseUnit = ingredientData.purchase_unit || 'piece';
    
    console.log('Purchase data:', { purchasePrice, purchaseQuantity, purchaseUnit });
    
    if (purchasePrice <= 0 || purchaseQuantity <= 0) {
        console.warn('Invalid purchase price or quantity, setting cost_per_unit to 0');
        const finalData = {
            ...ingredientData,
            cost_per_unit: 0,
            unit: purchaseUnit,
            prep_actions: (ingredientData.prep_actions || []).filter(p => p.name && p.yield_amount && p.yield_unit)
        };
        
        if (ingredientData.id) {
            await Ingredient.update(ingredientData.id, finalData);
            return { ...ingredientData, ...finalData };
        } else {
            return await Ingredient.create(finalData);
        }
    }

    // 2. Calculate cost per unit
    let costPerUnit;
    let standardUnit;
    
    if (isLiquidUnit(purchaseUnit)) {
        // For liquid ingredients, standardize to cost per oz
        const totalOzInPackage = convertToOz(purchaseQuantity, purchaseUnit);
        costPerUnit = totalOzInPackage > 0 ? purchasePrice / totalOzInPackage : 0;
        standardUnit = 'oz';
        console.log(`Liquid calculation: ${purchasePrice} / ${totalOzInPackage} oz = ${costPerUnit} per oz`);
    } else {
        // For non-liquid ingredients, cost per purchase unit
        costPerUnit = purchasePrice / purchaseQuantity;
        standardUnit = purchaseUnit;
        console.log(`Non-liquid calculation: ${purchasePrice} / ${purchaseQuantity} ${purchaseUnit} = ${costPerUnit} per ${standardUnit}`);
    }

    // 3. Prepare final ingredient data
    const finalIngredientData = {
        ...ingredientData,
        cost_per_unit: parseFloat(costPerUnit.toFixed(4)),
        unit: standardUnit,
        purchase_price: purchasePrice,
        purchase_quantity: purchaseQuantity,
        purchase_unit: purchaseUnit,
        prep_actions: (ingredientData.prep_actions || []).filter(p => p.name && p.yield_amount && p.yield_unit)
    };

    console.log('Final ingredient data to save:', finalIngredientData);

    // 4. Save the ingredient
    let savedIngredient;
    try {
        if (ingredientData.id) {
            console.log('Updating existing ingredient with ID:', ingredientData.id);
            await Ingredient.update(ingredientData.id, finalIngredientData);
            savedIngredient = { ...finalIngredientData, id: ingredientData.id };
        } else {
            console.log('Creating new ingredient');
            savedIngredient = await Ingredient.create(finalIngredientData);
        }
        
        console.log('Successfully saved ingredient:', savedIngredient);
        return savedIngredient;
    } catch (error) {
        console.error('Error saving ingredient:', error);
        throw error;
    }
};