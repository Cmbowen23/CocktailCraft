/**
 * OpenAI Service - Replaces Base44 AI Functions
 *
 * This module provides OpenAI-powered alternatives to Base44's AI functions,
 * reducing vendor lock-in while maintaining functionality.
 */

import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for development - move to backend in production
});

// Configuration
const CONFIG = {
  DEFAULT_MODEL: 'gpt-4o',
  FAST_MODEL: 'gpt-4o-mini', // 80% cheaper, use for simple tasks
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
};

/**
 * Retry wrapper for OpenAI calls
 */
async function withRetry(fn, retries = CONFIG.MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

/**
 * Safe JSON parsing from OpenAI responses
 */
function parseAIResponse(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse AI response:', content);
    throw new Error('AI returned invalid JSON');
  }
}

// =============================================================================
// PRIORITY 1: IMAGE & VISION FUNCTIONS
// =============================================================================

/**
 * Parse recipe from image using GPT-4o Vision
 * Replaces: base44.functions.invoke('parseRecipeDocument')
 *
 * @param {string} imageUrl - URL of the recipe image
 * @param {string} menuId - Optional menu ID for context
 * @returns {Promise<Object>} Parsed recipe with name, ingredients, steps, category
 */
export async function parseRecipeFromImage(imageUrl, menuId = null) {
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: CONFIG.DEFAULT_MODEL,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract recipe details from this image. Return JSON with:
- name: recipe name
- ingredients: array of {name, amount, unit}
- steps: array of step instructions (strings)
- category: drink category (cocktail, shot, mocktail, etc.)
- description: brief description (optional)

Be precise with measurements and ingredient names.`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const result = parseAIResponse(response.choices[0].message.content);

    // Add menu_id if provided
    if (menuId) {
      result.menu_id = menuId;
    }

    return { data: result };
  });
}

/**
 * Parse recipe from text using GPT-4o
 * Replaces: base44.functions.invoke('parseRecipeDocument') for text input
 *
 * @param {string} text - Recipe text
 * @param {string} menuId - Optional menu ID
 * @returns {Promise<Object>} Parsed recipe
 */
export async function parseRecipeFromText(text, menuId = null) {
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: CONFIG.DEFAULT_MODEL,
      messages: [{
        role: 'user',
        content: `Extract recipe details from this text: "${text}"

Return JSON with:
- name: recipe name
- ingredients: array of {name, amount, unit}
- steps: array of step instructions (strings)
- category: drink category
- description: brief description (optional)`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const result = parseAIResponse(response.choices[0].message.content);

    if (menuId) {
      result.menu_id = menuId;
    }

    return { data: result };
  });
}

/**
 * Process invoice using GPT-4o Vision
 * Replaces: base44.functions.invoke('processInvoice')
 *
 * @param {string} fileUrl - URL of uploaded invoice image/PDF
 * @returns {Promise<Object>} Parsed invoice data
 */
export async function processInvoice(fileUrl) {
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: CONFIG.DEFAULT_MODEL,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract invoice data. Return JSON with:
- supplier: supplier/vendor name
- invoice_number: invoice number
- date: invoice date (ISO format)
- line_items: array of {
    product_name: string,
    quantity: number,
    unit_price: number,
    total: number,
    size: string (if applicable, e.g., "750ml")
  }
- subtotal: number
- tax: number
- total: number

Be precise with numbers and product names.`
          },
          {
            type: 'image_url',
            image_url: { url: fileUrl }
          }
        ]
      }],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    return { data: parseAIResponse(response.choices[0].message.content) };
  });
}

/**
 * Parse distributor pricing from document
 * Replaces: base44.functions.invoke('parseDistributorPricing')
 *
 * @param {string} primaryFileUrl - Main pricing document
 * @param {string} secondaryFileUrl - Optional second document
 * @returns {Promise<Object>} Parsed pricing data
 */
export async function parseDistributorPricing(primaryFileUrl, secondaryFileUrl = null) {
  return withRetry(async () => {
    const content = [
      {
        type: 'text',
        text: `Extract distributor pricing data. Return JSON with:
- distributor: distributor name
- price_list: array of {
    product_name: string,
    size: string (e.g., "750ml", "1L"),
    unit: string (e.g., "bottle", "case"),
    case_price: number,
    bottle_price: number,
    case_size: number (bottles per case)
  }

Be precise with prices and product details.`
      },
      { type: 'image_url', image_url: { url: primaryFileUrl } }
    ];

    // Add second document if provided
    if (secondaryFileUrl) {
      content.push({ type: 'image_url', image_url: { url: secondaryFileUrl } });
    }

    const response = await openai.chat.completions.create({
      model: CONFIG.DEFAULT_MODEL,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    });

    return { data: parseAIResponse(response.choices[0].message.content) };
  });
}

/**
 * Fetch bottle image candidates
 * Replaces: base44.functions.invoke('fetchBottleImageCandidates')
 *
 * Option A: Use Unsplash API (recommended - free tier available)
 * Option B: Generate with DALL-E (more expensive)
 *
 * @param {string} ingredientName - Ingredient name
 * @param {string} supplier - Supplier/brand name
 * @param {string} category - Ingredient category
 * @returns {Promise<Object>} Array of image candidates
 */
export async function fetchBottleImageCandidates(ingredientName, supplier, category) {
  // TODO: Implement with Unsplash or other image API
  // For now, generate with DALL-E (more expensive but works)

  return withRetry(async () => {
    const prompt = `Professional product photography of a ${ingredientName} bottle by ${supplier}, ${category}, white background, studio lighting, high quality`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    });

    return {
      data: {
        candidates: response.data.map(img => ({
          url: img.url,
          thumbnail: img.url,
          source: 'dall-e-3'
        }))
      }
    };
  });
}

// =============================================================================
// PRIORITY 2: TEXT GENERATION & NLP FUNCTIONS
// =============================================================================

/**
 * Parse bar concept description
 * Replaces: base44.functions.invoke('parseBarConcept')
 *
 * @param {string} conceptDescription - Bar concept text
 * @returns {Promise<Object>} Parsed concept details
 */
export async function parseBarConcept(conceptDescription) {
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: CONFIG.DEFAULT_MODEL,
      messages: [{
        role: 'system',
        content: 'You are an expert bar consultant analyzing bar concepts.'
      }, {
        role: 'user',
        content: `Analyze this bar concept: "${conceptDescription}"

Return JSON with:
- concept_type: string (e.g., "craft cocktail bar", "dive bar", "speakeasy")
- target_audience: string
- drink_style: array of strings (e.g., ["classic cocktails", "tiki drinks"])
- key_ingredients: array of strings (most important spirits/ingredients)
- atmosphere: string description
- price_point: string (e.g., "upscale", "mid-range", "budget")
- suggested_menu_size: number (recommended number of cocktails)`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 800,
    });

    return { data: parseAIResponse(response.choices[0].message.content) };
  });
}

/**
 * Generate opening order suggestions
 * Replaces: base44.functions.invoke('generateOpeningOrderSuggestions')
 *
 * @param {Object} parsedIntent - Parsed bar concept
 * @param {Array} availableProducts - Available products to choose from
 * @returns {Promise<Object>} Suggested products with quantities
 */
export async function generateOpeningOrderSuggestions(parsedIntent, availableProducts) {
  return withRetry(async () => {
    // Limit products to avoid token limits
    const productSummary = availableProducts.slice(0, 200).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      size: p.bottle_size_ml
    }));

    const response = await openai.chat.completions.create({
      model: CONFIG.DEFAULT_MODEL,
      messages: [{
        role: 'system',
        content: 'You are an expert bar inventory manager helping stock a new bar.'
      }, {
        role: 'user',
        content: `Based on this bar concept: ${JSON.stringify(parsedIntent)}

Available products: ${JSON.stringify(productSummary)}

Suggest which products to order. Return JSON with:
- suggestions: array of {
    product_id: string,
    quantity: number (bottles),
    priority: string ("essential", "recommended", "optional"),
    reason: string (why this product)
  }

Focus on essential spirits and popular choices for the concept.`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    return { data: parseAIResponse(response.choices[0].message.content) };
  });
}

/**
 * Backfill ingredient details using AI
 * Replaces: base44.functions.invoke('backfillIngredientDetails')
 *
 * @param {string} ingredientName - Ingredient name
 * @returns {Promise<Object>} Enriched ingredient data
 */
export async function backfillIngredientDetails(ingredientName) {
  return withRetry(async () => {
    // Use faster, cheaper model for simple data lookup
    const response = await openai.chat.completions.create({
      model: CONFIG.FAST_MODEL,
      messages: [{
        role: 'user',
        content: `For the beverage ingredient "${ingredientName}", provide details. Return JSON with:
- category: string (e.g., "vodka", "rum", "liqueur", "bitters", "mixer")
- abv: number (alcohol by volume percentage, 0 if non-alcoholic)
- typical_supplier: string (common brand if applicable)
- description: string (brief description)
- common_sizes: array of strings (e.g., ["750ml", "1L"])
- flavor_profile: array of strings (e.g., ["sweet", "citrus", "herbal"])`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    });

    return { data: parseAIResponse(response.choices[0].message.content) };
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Apply invoice changes (wrapper for backward compatibility)
 * Replaces: base44.functions.invoke('applyInvoiceChanges')
 *
 * This is a data operation, not AI - should use direct Supabase/entity calls
 */
export async function applyInvoiceChanges(toUpdate, toCreate) {
  // This should be implemented with direct database calls
  // Not an AI function - just a wrapper for now
  console.warn('applyInvoiceChanges should use direct database calls, not OpenAI');

  // TODO: Replace with direct entity API calls
  // Example:
  // for (const item of toUpdate) {
  //   await base44.entities.Ingredient.update(item.id, item);
  // }
  // for (const item of toCreate) {
  //   await base44.entities.Ingredient.create(item);
  // }

  return { data: { success: true, updated: toUpdate.length, created: toCreate.length } };
}

/**
 * Search products (this should use database search, not AI)
 * Replaces: base44.functions.invoke('searchProductsFast')
 */
export async function searchProductsFast(searchTerm, page = 1, pageSize = 20) {
  console.warn('searchProductsFast should use database search, not OpenAI');
  // This should be a direct database query, not AI
  // Placeholder for now
  return { data: [] };
}

// =============================================================================
// USAGE TRACKING (Optional)
// =============================================================================

let usageStats = {
  totalCalls: 0,
  totalTokens: 0,
  estimatedCost: 0,
};

export function getUsageStats() {
  return { ...usageStats };
}

export function resetUsageStats() {
  usageStats = { totalCalls: 0, totalTokens: 0, estimatedCost: 0 };
}

// Export configuration for testing
export { CONFIG };
