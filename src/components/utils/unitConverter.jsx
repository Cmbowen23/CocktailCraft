import { findMatchingIngredient } from './costCalculations';

const ML_CONVERSIONS = {
    'ml': 1,
    'cl': 10,
    'l': 1000,
    'oz': 29.5735,
    'fl oz': 29.5735,
    'qt': 946.353,
    'cup': 236.588,
    'tsp': 4.92892,
    'tbsp': 14.7868,
    'dash': 0.616115,
    'barspoon': 2.5,
};

const G_CONVERSIONS = {
    'g': 1,
    'kg': 1000,
    'lb': 453.592,
};

const PIECE_UNITS = ['piece', 'slice', 'sprig', 'pinch', 'drop', 'bottle', 'can', 'each'];

export const convertAmount = (amount, fromUnit, toUnit, allIngredients, ingredientName) => {
    if (!amount || !fromUnit || !toUnit || fromUnit.toLowerCase() === toUnit.toLowerCase()) {
        return parseFloat(amount);
    }

    const fromUnitLower = fromUnit.toLowerCase();
    const toUnitLower = toUnit.toLowerCase();

    // Find ingredient for density and custom conversions
    const ingredient = ingredientName ? findMatchingIngredient(ingredientName, allIngredients) : null;
    const density = ingredient?.density_value || 1; // Default to water's density

    // Check for custom conversions first
    if (ingredient?.custom_conversions && Array.isArray(ingredient.custom_conversions)) {
        const custom = ingredient.custom_conversions.find(c => 
            c.from_unit && c.to_unit && 
            c.from_unit.toLowerCase() === fromUnitLower && 
            c.to_unit.toLowerCase() === toUnitLower
        );
        if (custom && custom.conversion_factor) {
            return amount * custom.conversion_factor;
        }
        const customReverse = ingredient.custom_conversions.find(c => 
            c.from_unit && c.to_unit &&
            c.from_unit.toLowerCase() === toUnitLower && 
            c.to_unit.toLowerCase() === fromUnitLower
        );
        if (customReverse && customReverse.conversion_factor) {
            return amount / customReverse.conversion_factor;
        }
    }

    // Standard conversions
    const fromType = G_CONVERSIONS[fromUnitLower] ? 'weight' : (ML_CONVERSIONS[fromUnitLower] ? 'volume' : (PIECE_UNITS.includes(fromUnitLower) ? 'piece' : null));
    const toType = G_CONVERSIONS[toUnitLower] ? 'weight' : (ML_CONVERSIONS[toUnitLower] ? 'volume' : (PIECE_UNITS.includes(toUnitLower) ? 'piece' : null));
    
    if (!fromType || !toType || (fromType === 'piece' || toType === 'piece')) {
        // Cannot convert from/to 'piece' without a custom conversion
        return parseFloat(amount);
    }

    let amountInMl;

    if (fromType === 'volume') {
        amountInMl = amount * ML_CONVERSIONS[fromUnitLower];
    } else { // fromType is 'weight'
        const amountInG = amount * G_CONVERSIONS[fromUnitLower];
        // Use density for weight to volume conversion
        if (!density || density <= 0) {
            console.warn(`Invalid density for ${ingredientName}: ${density}, using 1`);
            amountInMl = amountInG; // Fallback to 1:1 ratio
        } else {
            amountInMl = amountInG / density; // Convert to ml using density
        }
    }

    if (toType === 'volume') {
        return amountInMl / ML_CONVERSIONS[toUnitLower];
    } else { // toType is 'weight'
        const amountInG = amountInMl * (density || 1); // Convert back to grams
        return amountInG / G_CONVERSIONS[toUnitLower];
    }
};

export const parseContainerSize = (containerString) => {
    if (!containerString) return 0;
    const match = containerString.match(/(\d*\.?\d+)\s*(ml|l|oz|gallon|gal)/i);
    if (!match) return 0;
    
    const amount = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 'ml') return amount;
    if (unit === 'l') return amount * 1000;
    if (unit === 'oz') return amount * 29.5735;
    if (unit === 'gallon' || unit === 'gal') return amount * 3785.41;

    return 0;
};