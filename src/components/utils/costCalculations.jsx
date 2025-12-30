import moment from "moment";
import { isSubRecipe } from "./categoryDefinitions";
import { safeLower, safeTrim, safeString, safeIncludes } from "./stringSafe";

/* ============================================================
   CONSTANTS
============================================================ */

const exemptIngredients = [
  "water",
  "filtered water",
  "tap water",
  "distilled water",
  "spring water",
  "sparkling water",
  "soda",
  "soda water",
  "club soda",
  "ice",
  "coconut water",
  "top",
];

const invalidPrepActions = ['pour', 'add', 'stir', 'shake', 'combine', 'mix', 'prepare', 'measure'];

// Helper function to safely parse prep_actions
const getPrepActionsArray = (prepActions) => {
  if (!prepActions) return [];
  if (Array.isArray(prepActions)) return prepActions;
  if (typeof prepActions === 'string') {
    try {
      const parsed = JSON.parse(prepActions);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

const FRUITS_THAT_JUICE = [
  "lemon",
  "lime",
  "orange",
  "grapefruit",
  "limes",
  "lemons",
  "oranges",
  "grapefruits",
];

const LIQUID_UNITS = [
  "ml",
  "cl",
  "l",
  "oz",
  "fl oz",
  "fl. oz",
  "dash",
  "barspoon",
  "tsp",
  "tbsp",
  "cup",
  "qt",
  "pt",
  "gal",
  "top",
];

export const batchingRules = {
  spirit: {},
  liqueur: {},
  syrup: {},
  bitters: {},
  juice: {},
  fresh: {},
  mixer: {},
  garnish: {},
  other: {},
};

const toMlFactors = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  cl: 10,
  centiliter: 10,
  centiliters: 10,
  l: 1000,
  liter: 1000,
  liters: 1000,

  oz: 29.5735,
  "fl oz": 29.5735,
  "fl. oz": 29.5735,
  "fluid ounce": 29.5735,
  "fluid ounces": 29.5735,

  cup: 236.588,
  cups: 236.588,
  pt: 473.176,
  pint: 473.176,
  pints: 473.176,
  qt: 946.353,
  quart: 946.353,
  quarts: 946.353,
  gal: 3785.41,
  gallon: 3785.41,
  gallons: 3785.41,

  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,

  dash: 0.616115,
  dashes: 0.616115,

  barspoon: 5,
  top: 0,
};

const toGramFactors = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
};

/* ============================================================
   BASIC HELPERS / NORMALIZATION
============================================================ */

export const formatCurrency = (amount) => {
  return (parseFloat(amount) || 0).toFixed(2);
};

export const normalizeForMatch = (text) => {
  if (!text) return "";
  return safeLower(text).replace(/[^a-z0-9]/g, "");
};

export const normalizeCase = (name) => {
  const nameStr = safeString(name);
  if (!nameStr) return nameStr;

  const lowercaseWords = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "if",
    "in",
    "nor",
    "of",
    "on",
    "or",
    "so",
    "the",
    "to",
    "up",
    "yet",
    "with",
  ]);

  return safeLower(nameStr)
    .split(" ")
    .map((word, index) => {
      if (index === 0 || !lowercaseWords.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
};

export const isLiquidUnit = (unit) => {
  const unitStr = safeTrim(safeLower(unit));
  if (!unitStr) return false;
  return LIQUID_UNITS.includes(unitStr);
};

export const convertToMl = (amount, unit, ingredientName = null, allIngredients = []) => {
  const a = parseFloat(amount);
  if (!Number.isFinite(a) || a < 0) return null;
  const u = safeTrim(safeLower(unit));

  let matchedIngredient = null;
  if (ingredientName && Array.isArray(allIngredients) && allIngredients.length > 0) {
    matchedIngredient = findMatchingIngredient(ingredientName, allIngredients);
  }

  if (matchedIngredient?.custom_conversions && Array.isArray(matchedIngredient.custom_conversions)) {
    for (const conv of matchedIngredient.custom_conversions) {
      if (
        safeTrim(safeLower(conv.from_unit)) === u &&
        safeTrim(safeLower(conv.to_unit)) === 'ml'
      ) {
        const factor = parseFloat(conv.conversion_factor);
        if (!isNaN(factor) && factor > 0) {
          return a * factor;
        }
        if (parseFloat(conv.from_amount) > 0 && parseFloat(conv.to_amount) > 0) {
          return a * (parseFloat(conv.to_amount) / parseFloat(conv.from_amount));
        }
      }
    }
  }

  if (toGramFactors[u] && matchedIngredient?.density_value && matchedIngredient?.density_unit) {
    const densityValue = parseFloat(matchedIngredient.density_value);
    const densityUnit = safeTrim(safeLower(matchedIngredient.density_unit));

    if (!isNaN(densityValue) && densityValue > 0 && densityUnit === 'g/ml') {
      const grams = a * toGramFactors[u];
      return grams / densityValue;
    }
  }

  const factor = toMlFactors[u];
  if (!factor) return null;
  return a * factor;
};

export const convertToGrams = (amount, unit) => {
  const a = parseFloat(amount);
  if (!Number.isFinite(a)) return null;
  const u = safeTrim(safeLower(unit));
  const factor = toGramFactors[u];
  if (!factor) return null;
  return a * factor;
};

export const convertBetweenUnits = (amount, fromUnit, toUnit) => {
  const a = parseFloat(amount);
  if (!Number.isFinite(a)) return null;
  const from = safeTrim(safeLower(fromUnit));
  const to = safeTrim(safeLower(toUnit));

  if (from === to) return a;

  if (toMlFactors[from] && toMlFactors[to]) {
    const ml = a * toMlFactors[from];
    return ml / toMlFactors[to];
  }

  if (toGramFactors[from] && toGramFactors[to]) {
    const g = a * toGramFactors[from];
    return g / toGramFactors[to];
  }

  return null;
};

export const convertWithCustomConversions = (amount, fromUnit, toUnit, customConversions = null) => {
  if (customConversions && customConversions[fromUnit] && customConversions[fromUnit][toUnit]) {
    return parseFloat(amount) * customConversions[fromUnit][toUnit];
  }
  return convertBetweenUnits(amount, fromUnit, toUnit);
};

/* ============================================================
   INGREDIENT LOOKUP - ID-FIRST APPROACH
============================================================ */

export const findMatchingIngredient = (ingredientName, allIngredients = [], ingredientId = null) => {
  // PRIORITY 1: Match strictly by ID if provided (deterministic lookup)
  if (ingredientId && Array.isArray(allIngredients)) {
    const matchById = allIngredients.find(ing => ing.id === ingredientId);
    if (matchById) return matchById;
    console.warn('[CostCalculation] Ingredient ID not found:', { ingredientId, ingredientName });
    return null;
  }

  // Fallback for when no ID is provided (old data, manual input)
  const searchName = safeTrim(safeLower(ingredientName));
  if (!searchName) return null;
  if (!Array.isArray(allIngredients) || allIngredients.length === 0) return null;

  const normalizedSearchName = normalizeForMatch(ingredientName);

  // PRIORITY 2: Exact match by name
  const exactMatch = allIngredients.find(
    (ing) => ing.name && safeTrim(safeLower(ing.name)) === searchName
  );
  if (exactMatch) return exactMatch;

  // PRIORITY 3: Normalized match by name
  if (normalizedSearchName) {
    const normalizedMatch = allIngredients.find(
      (ing) => ing.name && normalizeForMatch(ing.name) === normalizedSearchName
    );
    if (normalizedMatch) return normalizedMatch;
  }

  // PRIORITY 4: Match by alias
  const aliasMatch = allIngredients.find(
    (ing) =>
      ing.aliases &&
      Array.isArray(ing.aliases) &&
      ing.aliases.some((alias) => {
        const normalizedAlias = safeTrim(safeLower(alias));
        return (
          normalizedAlias === searchName ||
          normalizeForMatch(alias) === normalizedSearchName
        );
      })
  );
  if (aliasMatch) return aliasMatch;

  return null;
};

/* ============================================================
   JUICE STRING PARSER - Simplified for backward compatibility only
============================================================ */

export const mapAndSplitJuice = (fullIngredientString, allIngredients = []) => {
  const cleanInput = safeTrim(fullIngredientString);
  if (!cleanInput) {
    return { ingredient_name: "", prep_action: "" };
  }

  // Prioritize " - " separator for explicit definition
  if (cleanInput.includes(" - ")) {
    const parts = cleanInput.split(" - ").map((p) => safeTrim(p));
    if (parts.length >= 2) {
      return { ingredient_name: parts[0], prep_action: parts[1] };
    }
  }

  // Fallback to comma-separated for common vernacular
  if (cleanInput.includes(",")) {
    const parts = cleanInput.split(",").map((p) => safeTrim(p));
    if (parts.length >= 2) {
      const ingredient_name = parts[0];
      const prep_action = parts[1];
      if (invalidPrepActions.includes(safeLower(prep_action))) {
        return { ingredient_name: cleanInput, prep_action: "" };
      }
      return { ingredient_name, prep_action };
    }
  }

  return { ingredient_name: cleanInput, prep_action: "" };
};

/* ============================================================
   VARIANTS + PURCHASE PRICING HELPERS
============================================================ */

const parseBottleSize = (sizeStr) => {
  if (!sizeStr) return null;
  const str = safeString(sizeStr).toLowerCase().replace(/\s+/g, '');
  
  const match = str.match(/^([\d.]+)(ml|l|oz|floz)?$/);
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'ml';
  
  if (isNaN(value) || value <= 0) return null;
  
  if (unit === 'l') return value * 1000;
  if (unit === 'oz' || unit === 'floz') return value * 29.5735;
  return value;
};

const getBottleSizeMl = (ingredient) => {
  if (!ingredient) return null;
  
  const sizeFields = [
    'size_ml', 'bottle_size_ml', 'volume_ml', 'bottleSize', 'unit_size_ml', 'size'
  ];
  
  for (const field of sizeFields) {
    if (ingredient[field]) {
      const parsed = parseBottleSize(ingredient[field]);
      if (parsed) return parsed;
    }
  }
  
  return null;
};

export const calculateVariantCostPerOz = (variant) => {
  if (!variant) return 0;

  const pp = parseFloat(variant.purchase_price || 0);
  const pq = parseFloat(variant.purchase_quantity || 0);
  const pUnit = safeLower(variant.purchase_unit || variant.unit || "oz");

  if (pp > 0 && pq > 0) {
    let qtyOz = null;
    if (toMlFactors[pUnit]) {
      const ml = pq * toMlFactors[pUnit];
      qtyOz = ml / toMlFactors["oz"];
    } else if (pUnit === "oz") {
      qtyOz = pq;
    }
    if (qtyOz && qtyOz > 0) return pp / qtyOz;
  }

  const cp = parseFloat(variant.case_price || 0);
  const bpc = parseFloat(variant.bottles_per_case || 0);
  const bsz = parseFloat(variant.bottle_size || 0);
  const bUnit = safeLower(variant.bottle_unit || "ml");

  if (cp > 0 && bpc > 0 && bsz > 0) {
    const perBottle = cp / bpc;
    let bottleOz = null;

    if (toMlFactors[bUnit]) {
      const ml = bsz * toMlFactors[bUnit];
      bottleOz = ml / toMlFactors["oz"];
    } else if (bUnit === "oz") {
      bottleOz = bsz;
    }

    if (bottleOz && bottleOz > 0) return perBottle / bottleOz;
  }

  return 0;
};

/* ============================================================
   INGREDIENT COST - ID-BASED APPROACH
============================================================ */

export const calculateIngredientCost = (
  ingLine,
  allIngredients,
  variantsLookup = null,
  ozInterpretation = "auto",
  allRecipes = []
) => {
  if (!ingLine) return { cost: 0, status: "not_found" };

  // CRITICAL: Always use ingredient_id for primary lookup
  let match = null;
  if (ingLine.ingredient_id) {
    match = findMatchingIngredient(null, allIngredients, ingLine.ingredient_id);
  } else {
    // Fallback for old data: parse name and match
    const baseNameFromText = safeString(ingLine.ingredient_name).split(' - ')[0].split(',')[0].trim();
    match = findMatchingIngredient(baseNameFromText, allIngredients);
  }

  if (!match) {
    return { cost: 0, status: "not_found" };
  }

  const normalizedMatchName = safeTrim(safeLower(match.name));

  // Exempt ingredients - use whole-word matching to avoid false positives (e.g., "spiced" shouldn't match "ice")
  const isExempt = exemptIngredients.some((ex) => {
    const regex = new RegExp(`\\b${ex}\\b`, 'i');
    return regex.test(normalizedMatchName);
  });
  if (isExempt) return { cost: 0, status: "has_cost" };

  // Handle sub-recipe ingredients
  if (match.ingredient_type === "sub_recipe" && match.sub_recipe_id && Array.isArray(allRecipes) && allRecipes.length > 0) {
    const subRecipe = allRecipes.find(r => r.id === match.sub_recipe_id);
    if (subRecipe && (subRecipe.yield_total_amount || subRecipe.yield_amount) && (subRecipe.yield_total_unit || subRecipe.yield_unit)) {
      const yieldAmount = subRecipe.yield_total_amount || subRecipe.yield_amount;
      const yieldUnit = subRecipe.yield_total_unit || subRecipe.yield_unit;
      
      const subRecipeTotalCost = calculateRecipeCost(subRecipe, allIngredients, "total", false, variantsLookup, ozInterpretation, allRecipes).totalCost;
      const subRecipeYieldMl = convertToMl(yieldAmount, yieldUnit);
      
      if (subRecipeTotalCost > 0 && subRecipeYieldMl > 0) {
        const costPerMl = subRecipeTotalCost / subRecipeYieldMl;
        const requestedAmountMl = convertToMl(ingLine.amount, ingLine.unit);
        if (requestedAmountMl !== null) {
          return { cost: costPerMl * requestedAmountMl, status: "has_cost" };
        }
      }
    }
    return { cost: 0, status: "no_cost" };
  }

  // CRITICAL: Handle prep action costing based on prep_action_id
  let resolvedPrepAction = null;
  if (ingLine.prep_action_id) {
    resolvedPrepAction = getPrepActionsArray(match.prep_actions).find(p => p.id === ingLine.prep_action_id);
    if (!resolvedPrepAction) {
      return { cost: 0, status: "invalid_prep_action" };
    }
  }

  if (resolvedPrepAction) {
    if (resolvedPrepAction.yield_amount && resolvedPrepAction.yield_unit) {
      const requestedAmount = parseFloat(ingLine.amount || 0);
      const requestedUnit = safeLower(ingLine.unit || "oz");
      
      const requestedInYieldUnit = convertBetweenUnits(requestedAmount, requestedUnit, resolvedPrepAction.yield_unit);
      
      if (requestedInYieldUnit !== null && requestedInYieldUnit >= 0 && resolvedPrepAction.yield_amount > 0) {
        const rawUnitsNeeded = requestedInYieldUnit / resolvedPrepAction.yield_amount;
        const rawCost = parseFloat(match.cost_per_unit || 0);
        
        if (rawCost > 0) {
          return { cost: rawCost * rawUnitsNeeded, status: "has_cost" };
        }
      }
    }
    return { cost: 0, status: "no_cost" };
  }

  // No prep action - use base ingredient cost
  const amt = parseFloat(ingLine.amount || 0);
  const unit = safeLower(ingLine.unit || "oz");

  let amtOz = null;
  if (toMlFactors[unit]) {
    const ml = amt * toMlFactors[unit];
    amtOz = ml / toMlFactors["oz"];
  } else if (unit === "oz") {
    amtOz = amt;
  } else {
    amtOz = null;
  }

  const cpu = parseFloat(match.cost_per_unit || 0);
  const cpuUnit = safeLower(match.cost_unit || match.unit || "oz");

  if (cpu > 0) {
    let amountInCostUnit = null;
    
    if (cpuUnit === unit) {
      amountInCostUnit = amt;
    } else {
      amountInCostUnit = convertBetweenUnits(amt, unit, cpuUnit);
    }
    
    if (amountInCostUnit !== null && amountInCostUnit > 0) {
      return { cost: cpu * amountInCostUnit, status: "has_cost" };
    }
  }

  // Variants lookup fallback
  if (match.ingredient_type === "purchased" && match.id && variantsLookup) {
    const variants =
      variantsLookup[match.id] || (variantsLookup.get && variantsLookup.get(match.id));

    if (Array.isArray(variants) && variants.length) {
      const best = Math.min(...variants.map((v) => calculateVariantCostPerOz(v)).filter(c => c > 0));

      if (best > 0 && amtOz !== null) {
        return { cost: best * amtOz, status: "has_cost" };
      }
    }
  }

  return { cost: 0, status: "no_cost" };
};

/* ============================================================
   CLARIFICATION LOGIC
============================================================ */

export const isClarifyingAgent = (ingName = "") => {
  const n = safeLower(ingName);
  if (!n) return false;
  return (
    safeIncludes(n, "milk") ||
    safeIncludes(n, "agar") ||
    safeIncludes(n, "casein") ||
    safeIncludes(n, "gelatin") ||
    safeIncludes(n, "bentonite") ||
    safeIncludes(n, "isinglass") ||
    safeIncludes(n, "filter") ||
    safeIncludes(n, "clarifier")
  );
};

const getYieldMl = (recipe) => {
  const ya = parseFloat(recipe?.yield_total_amount || recipe?.yield_amount || 0);
  const yu = recipe?.yield_total_unit || recipe?.yield_unit || "ml";
  if (!ya || ya <= 0) return null;
  const ml = convertToMl(ya, yu);
  return ml || null;
};

const getServingMl = (recipe) => {
  const ss = parseFloat(recipe?.serving_size || 0);
  const su = recipe?.serving_unit || "oz";
  if (!ss || ss <= 0) return null;
  const ml = convertToMl(ss, su);
  return ml || null;
};

/* ============================================================
   RECIPE COST (MAIN)
============================================================ */

export const calculateRecipeCost = (
  recipe,
  allIngredients,
  mode = "total",
  isBatch = false,
  variantsLookup = null,
  ozInterpretation = "auto",
  allRecipes = []
) => {
  if (!recipe) return { totalCost: 0, ingredientsWithCost: [], totalYield: 0 };

  const raw = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const isCocktail = !!recipe.is_cocktail;

  const ingredientsWithCostTotal = raw.map((ing) => {
    // Check if this ingredient references a sub-recipe by name
    let matchedIngredientForSubRecipeCheck = null;
    if (ing.ingredient_id) {
      matchedIngredientForSubRecipeCheck = findMatchingIngredient(null, allIngredients, ing.ingredient_id);
    } else {
      const { ingredient_name: baseNameFromText } = mapAndSplitJuice(ing?.ingredient_name || "", allIngredients);
      matchedIngredientForSubRecipeCheck = findMatchingIngredient(baseNameFromText, allIngredients);
    }
    const parsedName = matchedIngredientForSubRecipeCheck?.name || ing?.ingredient_name;
    
    const maybeSub = allRecipes?.find(
      (r) => safeTrim(safeLower(r?.name)) === safeTrim(safeLower(parsedName))
    );

    if (maybeSub && Array.isArray(maybeSub.ingredients)) {
      const subRes = calculateRecipeCost(
        maybeSub,
        allIngredients,
        "total",
        !!maybeSub.is_batched,
        variantsLookup,
        ozInterpretation,
        allRecipes
      );

      const subYieldMl = getYieldMl(maybeSub);
      const useMl = convertToMl(ing.amount, ing.unit);

      if (subYieldMl && useMl) {
        const costPerMl = subRes.totalCost / subYieldMl;
        const cost = costPerMl * useMl;
        return {
          ...ing,
          cost,
          isSubRecipeLine: true,
          source_sub_recipe_id: maybeSub.id,
        };
      }
    }

    const ingredientForCosting = {
      ...ing,
      ingredient_id: ing.ingredient_id,
      prep_action_id: ing.prep_action_id,
      amount: parseFloat(ing.amount) || 0,
      unit: ing.unit,
      ingredient_name: ing.ingredient_name,
    };
    const { cost } = calculateIngredientCost(ingredientForCosting, allIngredients, variantsLookup, ozInterpretation, allRecipes);
    return { ...ing, cost };
  });

  const totalCostFull = ingredientsWithCostTotal.reduce(
    (sum, ing) => sum + (parseFloat(ing.cost) || 0),
    0
  );

  const yieldMl = getYieldMl(recipe);
  const servingMl = getServingMl(recipe);

  const totalYield = parseFloat(recipe?.yield_total_amount || recipe?.yield_amount || 0) || 0;

  if (mode === "single_spec" && isCocktail) {
    if (yieldMl && servingMl && yieldMl > 0) {
      const scale = servingMl / yieldMl;

      const allScaledIngredients = ingredientsWithCostTotal.map((ing) => {
        const amt = parseFloat(ing.amount || 0);
        const cost = parseFloat(ing.cost || 0);

        return {
          ...ing,
          amount: Number.isFinite(amt) ? amt * scale : ing.amount,
          cost: Number.isFinite(cost) ? cost * scale : ing.cost,
        };
      });

      const totalCostSingle = totalCostFull * scale;

      const filterClarifiers =
        recipe.category === "clarification" || safeIncludes(safeString(recipe.category), "clarif");

      const displayIngredients = filterClarifiers
        ? allScaledIngredients.filter((ing) => !isClarifyingAgent(safeString(ing?.ingredient_name || ing?.name)))
        : allScaledIngredients;

      return {
        totalCost: totalCostSingle,
        ingredientsWithCost: displayIngredients,
        totalYield,
      };
    }

    return {
      totalCost: totalCostFull,
      ingredientsWithCost: ingredientsWithCostTotal,
      totalYield,
    };
  }

  return {
    totalCost: totalCostFull,
    ingredientsWithCost: ingredientsWithCostTotal,
    totalYield,
  };
};

/* ============================================================
   UI HELPERS
============================================================ */

export const formatIngredientAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0";
  return parseFloat(num.toFixed(2)).toString();
};

export const getIngredientInfo = (ingredientLine, allIngredients, variantsLookup = null, allRecipes = []) => {
  const { ingredient_name, ingredient_id, prep_action_id } = ingredientLine || {};
  const nameToCheck = safeTrim(safeString(ingredient_name));
  
  if (!nameToCheck && !ingredient_id) {
    return { costStatus: null, displayValue: '', displayUnit: null };
  }

  let displayValue = nameToCheck;
  let displayUnit = null;

  // CRITICAL: Prioritize ID-based lookup
  let match = null;
  if (ingredient_id) {
    match = findMatchingIngredient(null, allIngredients, ingredient_id);
  } else {
    const baseNameFromText = ingredient_name.split(',')[0].split(' - ')[0].trim();
    match = findMatchingIngredient(baseNameFromText, allIngredients);
  }

  if (!match) {
    return { costStatus: "not_found", displayValue: displayValue, displayUnit: null };
  }

  // Reconstruct display value with comma separator
  if (prep_action_id && match.prep_actions) {
    const matchedPrep = getPrepActionsArray(match.prep_actions).find(p => p.id === prep_action_id);
    if (matchedPrep) {
      displayValue = `${match.name}, ${matchedPrep.name}`;
      displayUnit = matchedPrep.yield_unit || match.unit || "oz";
    } else {
      displayValue = match.name;
      displayUnit = match.unit || "oz";
    }
  } else {
    displayValue = match.name;
    displayUnit = match.unit || "oz";
  }

  const normalizedMatchName = safeTrim(safeLower(match.name));
  // Exempt ingredients - use whole-word matching to avoid false positives (e.g., "spiced" shouldn't match "ice")
  const isExempt = exemptIngredients.some((exempt) => {
    const regex = new RegExp(`\\b${safeLower(exempt)}\\b`, 'i');
    return regex.test(normalizedMatchName);
  });

  if (isExempt) {
    return { costStatus: "has_cost", displayValue: displayValue, displayUnit: displayUnit };
  }

  if (match.ingredient_type === 'sub_recipe' && match.sub_recipe_id && Array.isArray(allRecipes) && allRecipes.length > 0) {
    const subRecipe = allRecipes.find(r => r.id === match.sub_recipe_id);
    if (subRecipe && (subRecipe.yield_total_amount || subRecipe.yield_amount) && (subRecipe.yield_total_unit || subRecipe.yield_unit)) {
      return { costStatus: "has_cost", displayValue: displayValue, displayUnit: displayUnit };
    }
  }

  let resolvedPrepAction = null;
  if (prep_action_id) {
    resolvedPrepAction = getPrepActionsArray(match.prep_actions).find(p => p.id === prep_action_id);
    if (!resolvedPrepAction) {
      return { costStatus: "no_cost", displayValue: displayValue, displayUnit: displayUnit };
    }
    if (resolvedPrepAction.yield_unit) {
      displayUnit = resolvedPrepAction.yield_unit;
    }
  }

  let hasCost = (parseFloat(match.cost_per_unit) || 0) > 0;

  if (resolvedPrepAction?.yield_amount && parseFloat(resolvedPrepAction.yield_amount) > 0) {
    if ((parseFloat(match.cost_per_unit) || 0) > 0) {
      hasCost = true;
    }
  }

  if (!hasCost && match.ingredient_type === "purchased" && match.id && variantsLookup) {
    const variants =
      variantsLookup[match.id] || (variantsLookup.get && variantsLookup.get(match.id));
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const hasAnyPricedVariant = variants.some((variant) => {
        const pp = parseFloat(variant.purchase_price || 0);
        const pq = parseFloat(variant.purchase_quantity || 0);
        const cp = parseFloat(variant.case_price || 0);
        const bpc = parseFloat(variant.bottles_per_case || 0);
        return (pp > 0 && pq > 0) || (cp > 0 && bpc > 0);
      });
      if (hasAnyPricedVariant) hasCost = true;
    }
  }

  const costStatus = hasCost ? "has_cost" : "no_cost";
  return { costStatus, displayValue: displayValue, displayUnit: displayUnit };
};