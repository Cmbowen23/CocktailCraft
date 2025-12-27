import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, AlertTriangle, Download, Camera } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Recipe } from "@/api/entities";
import { Ingredient } from "@/api/entities"; // Added Ingredient import
import IngredientDeduplicationContent from "./IngredientDeduplicationContent";
import { calculateIngredientCost, findMatchingIngredient, normalizeCase } from "../utils/costCalculations";

// Levenshtein distance function for typo detection
const levenshtein = (s1, s2) => {
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  const arr = [];
  for (let i = 0; i <= s2.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s1.length; j++) {
      arr[i][j] = i === 0 ? j : Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + (s1[j - 1] === s2[i - 1] ? 0 : 1)
      );
    }
  }
  return arr[s2.length][s1.length];
};

// Advanced fuzzy matching with confidence scores
const advancedFuzzyMatch = (newName, existingIngredients) => {
    if (!newName || !existingIngredients || existingIngredients.length === 0) return [];
    const searchName = newName.toLowerCase().trim();
    const searchTokens = new Set(searchName.split(/\s+/));

    const scores = existingIngredients.map(ing => {
        const targetName = ing.name.toLowerCase().trim();
        let score = 0;

        // 1. Exact match (highest score)
        if (searchName === targetName) {
            score = 100;
        } else {
            const targetTokens = new Set(targetName.split(/\s+/));
            
            // 2. Token-based similarity (Jaccard index)
            const intersection = new Set([...searchTokens].filter(x => targetTokens.has(x)));
            const union = new Set([...searchTokens, ...targetTokens]);
            const jaccardScore = union.size > 0 ? (intersection.size / union.size) * 100 : 0;
            score = jaccardScore;

            // 3. Containment bonus
            if (searchName.includes(targetName) || targetName.includes(searchName)) {
                score = Math.max(score, 75);
            }
            
            // 4. Levenshtein distance for minor typos, only boosts if there's some token overlap
            if (score > 10 && score < 80) {
                 const distance = levenshtein(searchName, targetName);
                 const maxLength = Math.max(searchName.length, targetName.length);
                 if (maxLength > 0) {
                     const levenshteinScore = ((maxLength - distance) / maxLength) * 100;
                     if (levenshteinScore > 75) {
                         score = Math.max(score, levenshteinScore);
                     }
                 }
            }
        }
        
        return { ingredient: ing, confidence: Math.round(score) };
    });

    // Return top 5 suggestions with reasonable confidence (raised threshold)
    return scores.filter(s => s.confidence > 50).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
};

export default function BulkRecipeImporter({ menuId, onComplete, onCancel, allIngredients = [], account, onIngredientsUpdated }) { // Added onIngredientsUpdated
  const [step, setStep] = useState('upload');
  const [importMethod, setImportMethod] = useState('text');
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRecipes, setParsedRecipes] = useState([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  
  const [newIngredients, setNewIngredients] = useState([]);
  const [ingredientMatches, setIngredientMatches] = useState({});

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  const generateRecipeTags = async (recipes) => {
    setProgress('Generating AI tags for recipes...');
    
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze these cocktail recipes and generate relevant tags for each one based on their ingredients, style, and characteristics.

For each recipe, generate 3-8 tags that would help categorize it. Tags should include:
- Bar type suitability (e.g., 'steakhouse', 'tiki_bar', 'dive_bar', 'speakeasy', 'hotel_bar', 'beach_bar')
- Drink style (e.g., 'margarita', 'martini', 'daiquiri', 'negroni', 'manhattan', 'old_fashioned')
- Characteristics (e.g., 'refreshing', 'spirit-forward', 'citrusy', 'herbal', 'spicy', 'smoky', 'bitter', 'sweet', 'dry')
- Occasion (e.g., 'brunch', 'after_dinner', 'summer', 'winter', 'party')
- Complexity (e.g., 'simple', 'complex', 'batched')

All tags should be lowercase with underscores instead of spaces.

Recipes:
${JSON.stringify(recipes.map(r => ({ 
  name: r.name, 
  ingredients: r.ingredients?.map(i => i.ingredient_name), 
  description: r.description,
  category: r.category,
  base_spirit: r.base_spirit 
})))}`,
        response_json_schema: {
          type: "object",
          properties: {
            recipe_tags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  recipe_name: { type: "string" },
                  tags: { 
                    type: "array", 
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        }
      });

      // Map tags back to recipes
      const recipesWithTags = recipes.map(recipe => {
        const tagData = response.recipe_tags?.find(rt => rt.recipe_name === recipe.name);
        return {
          ...recipe,
          tags: tagData?.tags || []
        };
      });

      return recipesWithTags;
    } catch (error) {
      console.error("Error generating tags:", error);
      // Return recipes without tags if AI fails
      return recipes.map(r => ({ ...r, tags: [] }));
    }
  };

  const handleParseText = async () => {
    if (!textInput.trim()) return;

    setIsProcessing(true);
    setError('');
    setProgress('Parsing menu text...');
    
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Parse this menu text and extract cocktail recipes with ingredients and measurements.

Text to parse:
${textInput}

Extract each recipe with:
- name: cocktail name
- description: brief description
- category: one of (classic, modern, tropical, sour, spirit_forward, dessert, low_abv, signature)
- base_spirit: primary spirit (gin, vodka, rum, whiskey, tequila, mezcal, brandy, liqueur, apertif, non_alcoholic, split_base, other)
- ingredients: array of {ingredient_name, prep_action, amount, unit, notes}.
  - ingredient_name: The core product name (e.g. "Lime", "Sugar", "Bourbon", "Raspberry Simple Syrup"). Do NOT include prep instructions or amounts here.
  - prep_action: Any preparation method (e.g. "Juice", "Peel", "Twist", "Wheel", "Wedge", "Slice", "Grated").
  - notes: Specific details like "no pith", "fine strained", "toasted", "green only".
  - amount: numeric value.
  - unit: unit of measure.
- instructions: array of step-by-step instructions
- garnish: garnish description
- glassware: recommended glass
- difficulty: easy, medium, or hard

Example: "30g fresh lime peel (no pith)" -> name: "Lime", prep: "Peel", amount: 30, unit: "g", notes: "no pith, fresh"
Example: "2 oz Lime Juice" -> name: "Lime", prep: "Juice", amount: 2, unit: "oz"

Return ALL valid recipes you can identify.`,
        response_json_schema: {
          type: "object",
          properties: {
            recipes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  base_spirit: { type: "string" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ingredient_name: { type: "string" },
                        prep_action: { type: "string" },
                        amount: { type: "number" },
                        unit: { type: "string" },
                        notes: { type: "string" }
                      }
                    }
                  },
                  instructions: { type: "array", items: { type: "string" } },
                  garnish: { type: "string" },
                  glassware: { type: "string" },
                  difficulty: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (response.recipes && response.recipes.length > 0) {
        const recipesWithTags = await generateRecipeTags(response.recipes);
        setParsedRecipes(recipesWithTags);
        analyzeIngredients(recipesWithTags);
      } else {
        setError('No recipes found in the provided text.');
      }
    } catch (error) {
      console.error("Error parsing menu:", error);
      setError('Failed to parse menu. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const handleParseFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError('');
    setProgress('Uploading file...');
    
    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setProgress('Extracting menu data...');
      
      const extractResponse = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: uploadResponse.file_url,
        json_schema: {
          type: "object",
          properties: {
            recipes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  base_spirit: { type: "string" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ingredient_name: { type: "string" },
                        prep_action: { type: "string" },
                        amount: { type: "number" },
                        unit: { type: "string" },
                        notes: { type: "string" }
                      }
                    }
                  },
                  instructions: { type: "array", items: { type: "string" } },
                  garnish: { type: "string" },
                  glassware: { type: "string" },
                  difficulty: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (extractResponse.status === 'success' && extractResponse.output.recipes) {
        const recipesWithTags = await generateRecipeTags(extractResponse.output.recipes);
        setParsedRecipes(recipesWithTags);
        analyzeIngredients(recipesWithTags);
      } else {
        setError('Failed to extract recipes from file.');
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setError('Failed to process file. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const handleParseImage = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError('');
    setProgress('Uploading menu image...');
    
    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setProgress('Reading menu from image...');
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this menu image and extract ALL cocktail recipes with their complete details.

For each recipe, extract:
- name: the exact cocktail name as shown
- description: any description or tasting notes provided
- category: classify as one of (classic, modern, tropical, sour, spirit_forward, dessert, low_abv, signature)
- base_spirit: identify the primary spirit (gin, vodka, rum, whiskey, tequila, mezcal, brandy, liqueur, apertif, non_alcoholic, split_base, other)
- ingredients: array of {ingredient_name, prep_action, amount, unit, notes}.
  - ingredient_name: The core product name (e.g. "Lime", "Sugar", "Bourbon"). Do NOT include prep instructions or amounts here.
  - prep_action: Any preparation method (e.g. "Juice", "Peel", "Twist").
  - notes: Specific details like "house-made", "fresh", "no pith", "fine strained".
- instructions: any preparation steps mentioned (shake, stir, build, muddle, etc.)
- garnish: garnish description if provided
- glassware: glass type if mentioned
- difficulty: estimate as easy, medium, or hard based on complexity

Example: "30g fresh lime peel (no pith)" -> name: "Lime", prep: "Peel", amount: 30, unit: "g", notes: "no pith, fresh"

Please extract ALL recipes visible in the image, maintaining accuracy.`,
        file_urls: [uploadResponse.file_url],
        response_json_schema: {
          type: "object",
          properties: {
            recipes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  base_spirit: { type: "string" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ingredient_name: { type: "string" },
                        prep_action: { type: "string" },
                        amount: { type: "number" },
                        unit: { type: "string" },
                        notes: { type: "string" }
                      }
                    }
                  },
                  instructions: { type: "array", items: { type: "string" } },
                  garnish: { type: "string" },
                  glassware: { type: "string" },
                  difficulty: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (response.recipes && response.recipes.length > 0) {
        const recipesWithTags = await generateRecipeTags(response.recipes);
        setParsedRecipes(recipesWithTags);
        analyzeIngredients(recipesWithTags);
      } else {
        setError('No recipes found in the image. Please make sure the image is clear and contains a menu.');
      }
    } catch (error) {
      console.error("Error parsing menu image:", error);
      setError('Failed to parse menu image. Please try again with a clearer image.');
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const analyzeIngredients = (recipes) => {
    setProgress('Analyzing ingredients...');
    
    const allRecipeIngredients = new Set();
    recipes.forEach(recipe => {
      if (recipe.ingredients) {
        recipe.ingredients.forEach(ing => {
          const trimmedName = (ing.ingredient_name || '').trim();
          // Filter out empty names and the literal '''
          if (trimmedName && trimmedName !== "'''") {
            // Apply title case normalization
            const normalizedName = normalizeCase(trimmedName);
            allRecipeIngredients.add(normalizedName);
          }
        });
      }
    });

    const uniqueIngredients = Array.from(allRecipeIngredients);
    const newIngs = [];
    const matches = {};

    uniqueIngredients.forEach(ingredientName => {
      const suggestions = advancedFuzzyMatch(ingredientName, allIngredients);
      
      // Only auto-match if confidence is 95% or higher
      const autoMatch = suggestions.find(s => s.confidence >= 95);
      
      if (autoMatch) {
        matches[ingredientName] = autoMatch.ingredient.name;
      } else {
        newIngs.push({
          name: ingredientName,
          suggestions: suggestions
        });
      }
    });

    setNewIngredients(newIngs);
    setIngredientMatches(matches);
    setStep(newIngs.length > 0 ? 'review' : 'confirm');
    setProgress('');
  };

  const handleIngredientResolution = async (resolutions) => {
    const updatedMatches = { ...ingredientMatches };
    const ingredientsToCreate = [];
    
    setProgress('Processing ingredient mappings...');
    
    Object.entries(resolutions).forEach(([originalName, resolution]) => {
      if (resolution.action === 'match') {
        updatedMatches[originalName] = resolution.matchedName;
      } else if (resolution.action === 'create') {
        updatedMatches[originalName] = originalName;
        
        // Prepare ingredient for creation
        ingredientsToCreate.push({
          name: originalName,
          category: 'other',
          ingredient_type: 'purchased',
          unit: 'oz',
          cost_per_unit: 0,
          purchase_price: 0,
          purchase_quantity: 1,
          purchase_unit: 'piece'
        });
      }
    });

    // Create new ingredients FIRST
    if (ingredientsToCreate.length > 0) {
      setProgress('Creating new ingredients in database...');
      try {
        // Create ingredients one by one to avoid race conditions
        for (const ingredient of ingredientsToCreate) {
          try {
            await Ingredient.create(ingredient);
            console.log(`Successfully created ingredient: ${ingredient.name}`);
          } catch (error) {
            console.error(`Failed to create ingredient ${ingredient.name}:`, error);
            setError(`Failed to create ingredient: ${ingredient.name}`);
          }
        }
        
        // Force refresh the ingredients list in the parent component
        setProgress('Refreshing ingredient database...');
        const refreshedIngredients = await Ingredient.list();
        
        if (Array.isArray(refreshedIngredients) && typeof onIngredientsUpdated === 'function') {
          onIngredientsUpdated(refreshedIngredients);
          console.log(`Refreshed ingredients list with ${refreshedIngredients.length} total ingredients`);
        }
        
      } catch (error) {
        console.error("Error in ingredient creation process:", error);
        setError('Failed to create some ingredients during mapping.');
      }
    }

    // Update matches and proceed
    setIngredientMatches(updatedMatches);
    setStep('confirm');
    setProgress('');
  };

  const handleSaveRecipes = async () => {
    setIsProcessing(true);
    setError('');
    setProgress('Saving recipes...');
    
    try {
      // Get all existing recipes to check for duplicates
      const allExistingRecipes = await Recipe.list();
      const existingRecipeNames = new Set(
        allExistingRecipes.map(recipe => recipe.name.toLowerCase())
      );

      // Before saving recipes, ensure we have the latest ingredients
      setProgress('Ensuring ingredient database is current...');
      const currentIngredients = await Ingredient.list();
      if (Array.isArray(currentIngredients) && typeof onIngredientsUpdated === 'function') {
        onIngredientsUpdated(currentIngredients);
      }

      const recipesToSave = parsedRecipes.map(recipe => {
        let recipeName = recipe.name;
        
        // Check if recipe name already exists
        if (existingRecipeNames.has(recipeName.toLowerCase())) {
          // Prepend account name if available
          if (account?.name) {
            recipeName = `${account.name} ${recipe.name}`;
          }
        }

        const ingredientsWithResolvedNames = recipe.ingredients?.filter(ing => {
            const trimmedName = (ing.ingredient_name || '').trim();
            return trimmedName && trimmedName !== "'''";
          }).map(ing => {
            const trimmedParsedName = (ing.ingredient_name || '').trim();
            // Apply title case normalization before resolving
            const normalizedParsedName = normalizeCase(trimmedParsedName);
            const resolvedName = ingredientMatches[normalizedParsedName] || normalizedParsedName;
            return {
              ...ing,
              ingredient_name: resolvedName,
            };
          }) || [];

        // Calculate cost using the updated ingredients
        let totalCost = 0;
        if (Array.isArray(ingredientsWithResolvedNames) && Array.isArray(currentIngredients)) {
            ingredientsWithResolvedNames.forEach(ing => {
                const matchedIngredient = findMatchingIngredient(ing.ingredient_name, currentIngredients);
                // Assume no prep_action from LLM parser for now
                const cost = calculateIngredientCost(matchedIngredient, ing.amount, ing.unit, null);
                totalCost += cost;
            });
        }

        return {
          ...recipe,
          name: recipeName, // Use the potentially modified recipeName
          menu_id: menuId,
          ingredients: ingredientsWithResolvedNames,
          tags: recipe.tags || [], // Include AI-generated tags
          cost_per_serving: totalCost,
          menu_price: Math.round(totalCost * 5)
        };
      });

      // Save recipes
      setProgress('Creating recipes...');
      for (const recipe of recipesToSave) {
        await Recipe.create(recipe);
      }

      console.log(`Successfully imported ${recipesToSave.length} recipes with ingredient mappings and AI tags`);
      onComplete();
    } catch (error) {
      console.error("Error saving recipes:", error);
      setError('Failed to save recipes. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const downloadTemplate = () => {
    const templateContent = `SUMMER COCKTAIL MENU

MARGARITA
Tequila 2 oz
Lime juice 1 oz
Triple sec 0.5 oz
Salt rim
Rocks glass
Shake with ice, strain over fresh ice

OLD FASHIONED
Bourbon 2 oz
Simple syrup 0.25 oz
Angostura bitters 2 dashes
Orange peel
Rocks glass
Stir with ice, strain over large cube`;
    
    const blob = new Blob([templateContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'menu_template.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (step === 'review') {
    return (
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900">Review Ingredient Matches</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <IngredientDeduplicationContent
            newIngredients={newIngredients}
            existingIngredients={allIngredients}
            onComplete={handleIngredientResolution}
            onCancel={() => setStep('upload')}
          />
        </CardContent>
      </Card>
    );
  }

  if (step === 'confirm') {
    return (
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900">Confirm Import</CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Ready to import {parsedRecipes.length} recipe{parsedRecipes.length !== 1 ? 's' : ''}
              </h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {parsedRecipes.map((recipe, index) => (
                  <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-gray-900">{recipe.name}</h4>
                    <p className="text-sm text-gray-700 mt-1">{recipe.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {recipe.category}
                      </span>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                        {recipe.base_spirit}
                      </span>
                      <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                        {recipe.ingredients?.length || 0} ingredients
                      </span>
                      {recipe.tags && recipe.tags.length > 0 && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {recipe.tags.length} AI tags
                        </span>
                      )}
                    </div>
                    {recipe.tags && recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {recipe.tags.slice(0, 5).map((tag, i) => (
                          <span key={i} className="text-xs bg-white text-gray-700 px-2 py-0.5 rounded border border-gray-300">
                            {tag}
                          </span>
                        ))}
                        {recipe.tags.length > 5 && (
                          <span className="text-xs text-gray-600 px-2 py-0.5">
                            +{recipe.tags.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back to Edit
              </Button>
              <Button 
                onClick={handleSaveRecipes}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import All Recipes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-gray-900">Bulk Import Recipes</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {progress && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="text-blue-700">{progress}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-4 mb-6">
            <Button
              variant={importMethod === 'text' ? 'default' : 'outline'}
              onClick={() => setImportMethod('text')}
              className={importMethod === 'text' ? 'bg-blue-600' : ''}
            >
              Text Input
            </Button>
            <Button
              variant={importMethod === 'file' ? 'default' : 'outline'}
              onClick={() => setImportMethod('file')}
              className={importMethod === 'file' ? 'bg-blue-600' : ''}
            >
              Upload File
            </Button>
            <Button
              variant={importMethod === 'image' ? 'default' : 'outline'}
              onClick={() => setImportMethod('image')}
              className={importMethod === 'image' ? 'bg-blue-600' : ''}
            >
              <Camera className="w-4 h-4 mr-2" />
              Menu Image
            </Button>
          </div>

          {importMethod === 'text' && (
            <div>
              <Label htmlFor="text">Menu Text</Label>
              <Textarea
                id="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste your menu text here... Include cocktail names, ingredients with measurements, and instructions."
                className="h-64"
              />
            </div>
          )}

          {importMethod === 'file' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="file">Upload File (PDF, TXT, or CSV)</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.txt,.csv"
                  className="mt-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                <span className="text-sm text-blue-600">Use this format for best results</span>
              </div>
            </div>
          )}

          {importMethod === 'image' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="menu-image">Upload Menu Image</Label>
                <p className="text-sm text-gray-600 mb-2">
                  Upload a photo of a menu, cocktail list, or recipe card. The AI will read and extract all recipes.
                </p>
                <Input
                  id="menu-image"
                  type="file"
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="mt-2"
                />
              </div>
              {selectedFile && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Selected:</strong> {selectedFile.name}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Tip: Make sure the image is clear and well-lit for best results.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={
                importMethod === 'text' ? handleParseText : 
                importMethod === 'image' ? handleParseImage : 
                handleParseFile
              }
              disabled={
                (!textInput.trim() && importMethod === 'text') || 
                (!selectedFile && (importMethod === 'file' || importMethod === 'image')) || 
                isProcessing
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {importMethod === 'image' ? <Camera className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Parse Menu
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}