import { convertWithCustomConversions } from './costCalculations';

// ============================================================================
// CONSTANTS - Configuration values for the batch scaling algorithm
// ============================================================================

// Scoring weights and thresholds
const SCORING = {
  // Score bonus for ingredients that land on whole numbers (e.g., 10, 15)
  WHOLE_NUMBER_BONUS: 10,

  // Score bonus for ingredients that land on half numbers (e.g., 10.5, 15.5)
  HALF_NUMBER_BONUS: 5,

  // Penalty multiplier for deviation from clean numbers
  DEVIATION_PENALTY_MULTIPLIER: 100,

  // Bonus multiplier for filling the container closer to max capacity
  CONTAINER_FILL_BONUS: 20,

  // Maximum acceptable deviation as a percentage of the scaled amount
  // If deviation is > 8%, the scale factor is considered invalid
  MAX_DEVIATION_PERCENT: 0.08,

  // Tolerance for checking if a number is effectively a whole number
  WHOLE_NUMBER_TOLERANCE: 0.01,

  // Tolerance for checking if a number is effectively a half number (x.5)
  HALF_NUMBER_TOLERANCE: 0.01,

  // Minimum scale factor threshold - won't consider scales below 50% of max
  MIN_SCALE_THRESHOLD: 0.5,
};

// Step size when searching for candidate scale factors
const CANDIDATE_SEARCH_STEP = 0.5;

// Small unit types that are excluded from scoring
const SMALL_UNIT_TYPES = ['dash', 'drop', 'spray', 'pinch'];

// ============================================================================
// HELPER FUNCTIONS - Utilities for finding matching ingredients
// ============================================================================

/**
 * Finds a matching ingredient by name from the full ingredients list
 * @param {string} name - The ingredient name to search for
 * @param {Array} allIngredients - The complete list of ingredients
 * @returns {Object|null} The matched ingredient or null
 */
const findMatchingIngredient = (name, allIngredients) => {
  if (!name || !allIngredients) return null;
  return allIngredients.find(ing => ing.name.toLowerCase() === name.toLowerCase());
};

/**
 * Checks if a unit type is considered "small" (like dash, drop, etc.)
 * @param {string} unit - The unit to check
 * @returns {boolean} True if the unit is a small type
 */
const isSmallUnit = (unit) => {
  if (!unit) return false;
  return SMALL_UNIT_TYPES.includes(unit.toLowerCase());
};

// ============================================================================
// INGREDIENT PREPARATION
// ============================================================================

/**
 * Prepares batch ingredient data for the scaling algorithm
 * Filters and transforms ingredients into a format suitable for calculation
 *
 * @param {Map} originalBatchAmountsMl - Map of ingredient names to their original ML amounts
 * @param {Object} ingredientOverrides - Object mapping ingredient names to 'batch' or 'service'
 * @param {Object} batchIngredientUnits - Object mapping ingredient names to their target units
 * @param {Array} allIngredients - Complete list of available ingredients
 * @returns {Array} Array of batch ingredient objects with metadata
 */
const prepareBatchIngredients = (
  originalBatchAmountsMl,
  ingredientOverrides,
  batchIngredientUnits,
  allIngredients
) => {
  return Array.from(originalBatchAmountsMl.entries())
    .filter(([name]) => ingredientOverrides[name] === 'batch')
    .map(([name, originalMl]) => ({
      name,
      originalMl,
      targetUnit: batchIngredientUnits[name] || 'ml',
      matchedIngredient: findMatchingIngredient(name, allIngredients),
      isSmall: isSmallUnit(batchIngredientUnits[name])
    }))
    .filter(ingredient => ingredient.originalMl > 0);
};

// ============================================================================
// SCALE CALCULATION
// ============================================================================

/**
 * Calculates the maximum possible scale factor based on container volume
 *
 * @param {Array} batchIngredients - Prepared batch ingredients
 * @param {number} containerVolumeMl - Total container volume in ML
 * @returns {number} Maximum scale factor (>= 1)
 */
const calculateMaxScale = (batchIngredients, containerVolumeMl) => {
  const singleBatchTotalMl = batchIngredients.reduce(
    (sum, ingredient) => sum + ingredient.originalMl,
    0
  );

  const maxScale = containerVolumeMl / singleBatchTotalMl;
  return Math.max(1, maxScale);
};

/**
 * Identifies the base ingredient (largest by volume)
 * The base ingredient is used as the primary reference for generating candidates
 *
 * @param {Array} batchIngredients - Prepared batch ingredients
 * @returns {Object} The base ingredient object
 */
const findBaseIngredient = (batchIngredients) => {
  return batchIngredients.reduce((prev, current) =>
    prev.originalMl > current.originalMl ? prev : current
  );
};

// ============================================================================
// CANDIDATE GENERATION
// ============================================================================

/**
 * Generates a set of candidate scale factors to evaluate
 *
 * Strategy: Start with the base ingredient and step down in increments,
 * generating scale factors that would result in whole or half numbers
 *
 * @param {Object} baseIngredient - The largest ingredient by volume
 * @param {number} maxScale - Maximum allowed scale factor
 * @returns {Set} Set of candidate scale factors to evaluate
 */
const generateCandidateScales = (baseIngredient, maxScale) => {
  const candidateScales = new Set([maxScale]);

  // Convert base ingredient to its target unit
  const baseAmountTargetUnit = convertWithCustomConversions(
    baseIngredient.originalMl,
    'ml',
    baseIngredient.targetUnit,
    baseIngredient.matchedIngredient
  );

  const maxBaseAmount = baseAmountTargetUnit * maxScale;

  // Step down from max amount in 0.5 increments
  for (let amount = Math.floor(maxBaseAmount); amount > 0; amount -= CANDIDATE_SEARCH_STEP) {
    if (amount <= 0) break;

    const scaleFactor = amount / baseAmountTargetUnit;
    candidateScales.add(scaleFactor);

    // Stop if we've gone below the minimum threshold
    if (amount / maxBaseAmount < SCORING.MIN_SCALE_THRESHOLD) {
      break;
    }
  }

  return candidateScales;
};

// ============================================================================
// SCORING SYSTEM
// ============================================================================

/**
 * Checks if a number is effectively a whole number within tolerance
 * @param {number} value - The value to check
 * @returns {boolean} True if the value is a whole number
 */
const isWholeNumber = (value) => {
  return Math.abs(value - Math.round(value)) < SCORING.WHOLE_NUMBER_TOLERANCE;
};

/**
 * Checks if a number is effectively a half number (x.5) within tolerance
 * @param {number} value - The value to check
 * @returns {boolean} True if the value is a half number
 */
const isHalfNumber = (value) => {
  return Math.abs(value % 1 - 0.5) < SCORING.HALF_NUMBER_TOLERANCE;
};

/**
 * Calculates the deviation of a scaled amount from the nearest quarter
 * @param {number} scaledAmount - The scaled ingredient amount
 * @returns {number} The absolute deviation from nearest quarter
 */
const calculateDeviation = (scaledAmount) => {
  const nearestQuarter = Math.round(scaledAmount * 4) / 4;
  return Math.abs(scaledAmount - nearestQuarter);
};

/**
 * Scores an individual ingredient based on how "clean" the scaled amount is
 *
 * Scoring criteria:
 * - Whole numbers get the highest bonus
 * - Half numbers get a medium bonus
 * - Deviation from clean numbers incurs a penalty
 *
 * @param {Object} ingredient - The ingredient to score
 * @param {number} scaleFactor - The scale factor being evaluated
 * @returns {Object} { score: number, isValid: boolean }
 */
const scoreIngredient = (ingredient, scaleFactor) => {
  // Skip scoring for small units (dash, drop, etc.)
  if (ingredient.isSmall) {
    return { score: 0, isValid: true };
  }

  const scaledMl = ingredient.originalMl * scaleFactor;
  const scaledAmount = convertWithCustomConversions(
    scaledMl,
    'ml',
    ingredient.targetUnit,
    ingredient.matchedIngredient
  );

  const deviation = calculateDeviation(scaledAmount);
  const deviationPercent = scaledAmount > 0 ? deviation / scaledAmount : 0;

  // Invalidate if deviation is too large
  if (scaledAmount > 0.5 && deviationPercent > SCORING.MAX_DEVIATION_PERCENT) {
    return { score: 0, isValid: false };
  }

  let score = 0;

  // Bonus for whole numbers
  if (isWholeNumber(scaledAmount)) {
    score += SCORING.WHOLE_NUMBER_BONUS;
  }
  // Bonus for half numbers
  else if (isHalfNumber(scaledAmount)) {
    score += SCORING.HALF_NUMBER_BONUS;
  }

  // Penalty for deviation
  score -= deviationPercent * SCORING.DEVIATION_PENALTY_MULTIPLIER;

  return { score, isValid: true };
};

/**
 * Scores a scale factor based on how well all ingredients scale
 *
 * @param {Array} batchIngredients - All batch ingredients
 * @param {number} scaleFactor - The scale factor to score
 * @param {number} maxScale - Maximum possible scale factor
 * @returns {Object} { score: number, isValid: boolean }
 */
const scoreScaleFactor = (batchIngredients, scaleFactor, maxScale) => {
  let totalScore = 0;

  // Score each ingredient
  for (const ingredient of batchIngredients) {
    const { score, isValid } = scoreIngredient(ingredient, scaleFactor);

    if (!isValid) {
      return { score: -Infinity, isValid: false };
    }

    totalScore += score;
  }

  // Bonus for filling the container closer to maximum capacity
  const fillPercent = scaleFactor / maxScale;
  totalScore += fillPercent * SCORING.CONTAINER_FILL_BONUS;

  return { score: totalScore, isValid: true };
};

// ============================================================================
// MAIN ALGORITHM
// ============================================================================

/**
 * Finds the optimal scale factor for batching a recipe
 *
 * This algorithm prioritizes scale factors that result in "clean" numbers
 * (whole numbers or half numbers) for as many ingredients as possible,
 * while maximizing container utilization.
 *
 * Algorithm steps:
 * 1. Prepare batch ingredients (filter to only batched items)
 * 2. Calculate maximum possible scale based on container volume
 * 3. Identify the base (largest) ingredient
 * 4. Generate candidate scale factors based on the base ingredient
 * 5. Score each candidate based on how clean the resulting amounts are
 * 6. Return the scale factor with the best score
 *
 * @param {Map} originalBatchAmountsMl - Map of ingredient names to ML amounts per serving
 * @param {Object} ingredientOverrides - Which ingredients are batched vs served
 * @param {Object} batchIngredientUnits - Target units for each ingredient
 * @param {Array} allIngredients - Complete ingredient database
 * @param {number} containerVolumeMl - Total container capacity in ML
 * @returns {number} The optimal scale factor (>= 1)
 */
export const findOptimalScaleFactor = (
  originalBatchAmountsMl,
  ingredientOverrides,
  batchIngredientUnits,
  allIngredients,
  containerVolumeMl
) => {
  // Step 1: Prepare batch ingredients
  const batchIngredients = prepareBatchIngredients(
    originalBatchAmountsMl,
    ingredientOverrides,
    batchIngredientUnits,
    allIngredients
  );

  // Early return if no ingredients to batch
  if (batchIngredients.length === 0) {
    return 1;
  }

  // Step 2: Calculate maximum scale
  const maxScale = calculateMaxScale(batchIngredients, containerVolumeMl);

  // If container is too small for even one batch, return 1
  if (maxScale < 1) {
    return 1;
  }

  // Step 3: Find the base ingredient
  const baseIngredient = findBaseIngredient(batchIngredients);

  // Step 4: Generate candidate scale factors
  const candidateScales = generateCandidateScales(baseIngredient, maxScale);

  // Step 5: Score all candidates and find the best one
  let bestScale = 1;
  let bestScore = -Infinity;

  candidateScales.forEach(scaleFactor => {
    const { score, isValid } = scoreScaleFactor(batchIngredients, scaleFactor, maxScale);

    if (isValid && score > bestScore) {
      bestScore = score;
      bestScale = scaleFactor;
    }
  });

  return bestScale;
};
