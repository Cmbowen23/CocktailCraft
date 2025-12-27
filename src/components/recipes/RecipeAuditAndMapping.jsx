import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, Loader2, Check, PlusCircle, Sparkles } from "lucide-react";
import { cocktailCategories, ingredientCategories } from '../utils/categoryDefinitions';
import { Recipe } from "@/api/entities";
import { Ingredient } from "@/api/entities";
import IngredientMappingDropdown from "./IngredientMappingDropdown";
import { safeLower, safeTrim } from '../utils/stringSafe';

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
    const searchName = safeTrim(safeLower(newName));
    if (!searchName || !existingIngredients || existingIngredients.length === 0) return [];
    
    // Special handling for citrus juices - map to fruit + juice prep action
    const citrusJuiceMap = {
      'lemon juice': { base: 'lemon', prep: 'juice' },
      'lime juice': { base: 'lime', prep: 'juice' },
      'orange juice': { base: 'orange', prep: 'juice' },
      'grapefruit juice': { base: 'grapefruit', prep: 'juice' }
    };
    
    if (citrusJuiceMap[searchName]) {
      const { base, prep } = citrusJuiceMap[searchName];
      const citrusMatch = existingIngredients.find(ing => 
        safeLower(ing.name) === base && 
        ing.prep_actions && 
        ing.prep_actions.some(p => safeLower(p.name) === prep)
      );
      if (citrusMatch) {
        return [{
          ingredient: {
            ...citrusMatch,
            name: `${citrusMatch.name}, ${prep}`,
            id: `${citrusMatch.id}_${prep}`
          },
          confidence: 100
        }];
      }
    }
    
    // Ignore common small words for matching unless they are the only word
    const stopWords = new Set(['oz', 'ounce', 'ml', 'dash', 'splash', 'fresh', 'pure']);
    const searchTokens = searchName.split(/\s+/).filter(t => !stopWords.has(t) || searchName.split(/\s+/).length === 1);

    const candidates = [];

    // Helper to score a target string
    const calculateScore = (targetNameStr, category, spiritType, isAlias = false) => {
        const targetName = safeTrim(safeLower(targetNameStr));
        const targetTokens = targetName.split(/\s+/);
        
        // 1. Exact Match
        if (searchName === targetName) return 100;

        let score = 0;

        // 2. Token Matching (Jaccard-ish but weighted)
        let matchedTokens = 0;
        searchTokens.forEach(sToken => {
            // Check for exact token match
            if (targetTokens.includes(sToken)) {
                matchedTokens += 1;
            } 
            // Check for prefix match ONLY if token is long enough (avoid 'gin' matching 'ginger')
            else if (sToken.length > 3) {
                 if (targetTokens.some(t => t.startsWith(sToken) || sToken.startsWith(t))) {
                     matchedTokens += 0.8;
                 }
            }
        });

        if (matchedTokens > 0) {
            score = (matchedTokens / Math.max(searchTokens.length, targetTokens.length)) * 100;
        }

        // 3. Substring match with boundary check
        const escapedSearch = searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const boundaryRegex = new RegExp(`\\b${escapedSearch}\\b`);
        if (boundaryRegex.test(targetName)) {
            score = Math.max(score, 90);
        }
        
        // Reverse check: does target exist in search?
        if (targetName.length > 3 && new RegExp(`\\b${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(searchName)) {
             score = Math.max(score, 85);
        }

        // Boost for Spirit Types
        if (spiritType && searchName.includes(safeLower(spiritType))) {
            score += 10;
        }
        // Boost if the ingredient is known to be a spirit/liquor
        if (category === 'spirit' || category === 'liquor') {
            score += 5;
        }
        
        // Boost for aliases
        if (isAlias) {
            score += 15;
        }
        
        return Math.min(Math.round(score), 100);
    };

    existingIngredients.forEach(ing => {
        if (!ing || !ing.name || !ing.name.trim()) return; // Skip invalid ingredients
        
        // 1. Score Base Ingredient
        const baseScore = calculateScore(ing.name, ing.category, ing.spirit_type, false);
        if (baseScore > 0) candidates.push({ ingredient: ing, confidence: baseScore });

        // 2. Score Aliases
        if (ing.aliases && Array.isArray(ing.aliases)) {
            ing.aliases.forEach(alias => {
                if (!alias || !alias.trim()) return; // Skip empty aliases
                const aliasScore = calculateScore(alias, ing.category, ing.spirit_type, true);
                if (aliasScore > 0 && aliasScore > baseScore) {
                    candidates.push({ ingredient: ing, confidence: aliasScore });
                }
            });
        }

        // 3. Score Prep Actions (create virtual ingredients)
        if (ing.prep_actions && Array.isArray(ing.prep_actions)) {
            ing.prep_actions.forEach(prep => {
                if (!prep || !prep.name || !prep.name.trim()) return; // Skip invalid prep actions
                const prepFullName = `${ing.name}, ${prep.name}`;
                const prepScore = calculateScore(prepFullName, ing.category, ing.spirit_type);
                
                if (prepScore > 40) { // Only add relevant preps
                    candidates.push({
                        ingredient: {
                            ...ing,
                            name: prepFullName, // Display name with prep action
                            id: `${ing.id}_${prep.name}` // Virtual ID to ensure unique key
                        },
                        confidence: prepScore
                    });
                }
            });
        }
    });

    return candidates
        .filter(s => s.confidence > 60 && s.ingredient && s.ingredient.name && s.ingredient.name.trim())
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
};

export default function RecipeAuditAndMapping({ 
  parsedRecipes, 
  allIngredients, 
  onSaveComplete, 
  onCancel 
}) {
  const [recipes, setRecipes] = useState(parsedRecipes);
  const [isSaving, setIsSaving] = useState(false);
  const [currentIngredients, setCurrentIngredients] = useState(allIngredients);
  const [ingredientMappings, setIngredientMappings] = useState({}); // Store mappings: {`${rIndex}-${iIndex}`: mappedName}
  const [pendingCreations, setPendingCreations] = useState(new Set()); // Track ingredients to be created

  // Identify sub-recipes within the current import batch
  const newSubRecipes = useMemo(() => {
    return recipes.filter(r => ingredientCategories.includes(r.category));
  }, [recipes]);

  // Helper to check ingredient status
  const getIngredientStatus = (ingredientName, recipeIndex, ingIndex) => {
    const baseName = safeTrim(ingredientName.split(',')[0]);
    if (!baseName) return { status: 'unknown', label: 'Unknown', matchedIngredient: null };
    
    const mappingKey = `${recipeIndex}-${ingIndex}`;
    const mappedIngredient = ingredientMappings[mappingKey];
    
    // If explicitly mapped, return mapped status
    if (mappedIngredient) {
      return { status: 'ok', label: 'OK', color: 'bg-green-100 text-green-800', matchedIngredient: mappedIngredient };
    }
    
    const isPending = pendingCreations.has(safeLower(baseName));
    if (isPending) {
      return { status: 'ok', label: 'OK', color: 'bg-green-100 text-green-800', matchedIngredient: { name: baseName } };
    }
    
    // Check if ingredient naturally exists
    const lowerBaseName = safeLower(baseName);
    
    // Special handling for citrus juices
    const citrusJuiceMap = {
      'lemon juice': 'lemon',
      'lime juice': 'lime',
      'orange juice': 'orange',
      'grapefruit juice': 'grapefruit'
    };
    
    const citrusBase = citrusJuiceMap[lowerBaseName];
    if (citrusBase) {
      const citrusMatch = currentIngredients.find(i => 
        safeLower(i.name) === citrusBase && 
        i.prep_actions && 
        i.prep_actions.some(p => safeLower(p.name) === 'juice')
      );
      if (citrusMatch) {
        return { status: 'ok', label: 'OK', color: 'bg-green-100 text-green-800', matchedIngredient: citrusMatch };
      }
    }
    
    // Check in existing ingredients
    const match = currentIngredients.find(i => 
      safeLower(i.name) === lowerBaseName || 
      (i.aliases && Array.isArray(i.aliases) && i.aliases.some(alias => safeLower(alias) === lowerBaseName))
    );
    
    if (match) {
      return { status: 'ok', label: 'OK', color: 'bg-green-100 text-green-800', matchedIngredient: match };
    }
    
    // Check in new sub-recipes from this import
    const subRecipeMatch = newSubRecipes.find(r => safeLower(r.name) === lowerBaseName);
    if (subRecipeMatch) {
      return { status: 'ok', label: 'OK', color: 'bg-green-100 text-green-800', matchedIngredient: { name: subRecipeMatch.name } };
    }
    
    return { status: 'new', label: 'New Ingredient', color: 'bg-blue-100 text-blue-800', matchedIngredient: null };
  };

  const handleCategoryChange = (index, newCategory) => {
    const updated = [...recipes];
    updated[index].category = newCategory;
    setRecipes(updated);
  };

  const handleNameChange = (index, newName) => {
    const updated = [...recipes];
    updated[index].name = newName;
    setRecipes(updated);
  };

  const handleCreateIngredient = (recipeIndex, ingIndex, ingredientName) => {
    if (!ingredientName) return;
    
    const baseName = safeTrim(ingredientName.split(',')[0]);
    setPendingCreations(prev => new Set([...prev, safeLower(baseName)]));
  };

  const handleMapIngredient = (recipeIndex, ingIndex, selectedIngredient) => {
    const mappingKey = `${recipeIndex}-${ingIndex}`;
    setIngredientMappings(prev => ({
      ...prev,
      [mappingKey]: selectedIngredient
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // 1. Create all pending ingredients first
      const createdIngredients = [];
      for (const pendingName of pendingCreations) {
        try {
          const newIngredient = await Ingredient.create({
            name: pendingName,
            category: 'other',
            ingredient_type: 'purchased',
            unit: 'oz',
            cost_per_unit: 0,
            purchase_price: 0,
            purchase_quantity: 1,
            purchase_unit: 'piece'
          });
          createdIngredients.push(newIngredient);
        } catch (error) {
          console.error(`Error creating ingredient ${pendingName}:`, error);
        }
      }
      
      // Update current ingredients with newly created ones
      setCurrentIngredients(prev => [...prev, ...createdIngredients]);
      
      // Filter out invalid prep actions before saving
      const invalidPrepActions = ['pour', 'add', 'stir', 'shake', 'combine', 'mix'];
      
      // 2. Create all recipes
      for (const recipe of recipes) {
        // Clean ingredients and filter out empty ones
        const cleanedIngredients = recipe.ingredients
          .map((ing, ingIndex) => {
            // Use mapping if available, otherwise use original name
            const recipeIndex = recipes.indexOf(recipe);
            const mappingKey = `${recipeIndex}-${ingIndex}`;
            const mappedIngredient = ingredientMappings[mappingKey];
            
            let finalName = ing.ingredient_name;
            if (mappedIngredient) {
              // If it's a virtual prep action, reconstruct the name
              if (mappedIngredient._isVirtualPrepAction) {
                finalName = `${mappedIngredient._baseName}, ${mappedIngredient._prepAction}`;
              } else {
                finalName = mappedIngredient.name;
              }
            }
            
            const [baseName, prepAction] = finalName.split(',').map(s => safeTrim(s));
            // Remove invalid prep actions
            if (prepAction && invalidPrepActions.includes(safeLower(prepAction))) {
              return { ...ing, ingredient_name: baseName };
            }
            return { ...ing, ingredient_name: finalName };
          })
          .filter(ing => ing.ingredient_name && ing.ingredient_name.trim()); // Filter out empty ingredients
        
        // Create Recipe
        const recipeData = {
            name: recipe.name,
            description: recipe.description,
            category: recipe.category,
            base_spirit: recipe.base_spirit,
            ingredients: cleanedIngredients,
            instructions: recipe.instructions,
            garnish: recipe.garnish,
            glassware: recipe.glassware,
            yield_amount: recipe.yield_amount,
            yield_unit: recipe.yield_unit,
            menu_id: recipe.menu_id
        };

        const createdRecipe = await Recipe.create(recipeData);

        // Handle Sub-Recipe Linking
        if (ingredientCategories.includes(recipe.category)) {
            const match = [...currentIngredients, ...createdIngredients].find(i => safeLower(i.name) === safeLower(recipe.name));
            
            if (match) {
                await Ingredient.update(match.id, {
                    ingredient_type: "sub_recipe",
                    sub_recipe_id: createdRecipe.id,
                    category: recipe.category
                });
            } else {
                await Ingredient.create({
                    name: recipe.name,
                    ingredient_type: "sub_recipe",
                    sub_recipe_id: createdRecipe.id,
                    category: recipe.category,
                    unit: recipe.yield_unit || "ml",
                    cost_per_unit: 0,
                    description: recipe.description
                });
            }
        }
      }
      onSaveComplete();
    } catch (error) {
      console.error("Error saving recipes:", error);
      alert("Failed to save recipes: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveRecipe = (index) => {
      const updated = recipes.filter((_, i) => i !== index);
      setRecipes(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
            <h3 className="text-lg font-semibold">Review & Audit Recipes</h3>
            <p className="text-sm text-gray-600">Please review the parsed recipes. Check categories and ensure ingredients are mapped.</p>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSaveAll} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Saving...</> : <><Save className="w-4 h-4 mr-2"/> Save All Recipes</>}
            </Button>
        </div>
      </div>

      <div className="space-y-4">
        {recipes.map((recipe, rIndex) => (
            <Card key={rIndex} className="border border-gray-200 bg-white shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Recipe Name</label>
                                <Input 
                                    value={recipe.name} 
                                    onChange={(e) => handleNameChange(rIndex, e.target.value)}
                                    className="font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                <div className="flex items-center gap-2">
                                    <Select 
                                        value={recipe.category} 
                                        onValueChange={(val) => handleCategoryChange(rIndex, val)}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cocktails_header" disabled className="font-semibold text-gray-900 bg-gray-50">-- Cocktails --</SelectItem>
                                            {cocktailCategories.map(c => (
                                                <SelectItem key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                                            ))}
                                            <SelectItem value="subrecipes_header" disabled className="font-semibold text-gray-900 bg-gray-50">-- Sub-Recipes --</SelectItem>
                                            {ingredientCategories.map(c => (
                                                <SelectItem key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Badge variant="outline" className={cocktailCategories.includes(recipe.category) ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>
                                        {cocktailCategories.includes(recipe.category) ? "Cocktail" : "Sub-Recipe"}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveRecipe(rIndex)} className="text-red-500 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mt-2">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Ingredients</h4>
                        <div className="space-y-2">
                            {recipe.ingredients.map((ing, originalIndex) => {
                                const ingName = safeTrim(ing.ingredient_name);
                                if (!ingName) return null;
                                const [baseName] = ingName.split(',').map(s => safeTrim(s));
                                if (!baseName) return null;

                                const status = getIngredientStatus(ing.ingredient_name, rIndex, originalIndex);
                                const suggestions = advancedFuzzyMatch(ing.ingredient_name, currentIngredients);

                                return (
                                    <div key={`${recipe.id || rIndex}-${originalIndex}`} className="flex flex-col md:flex-row md:items-center text-sm p-4 bg-gray-50/50 rounded-lg border border-gray-100 gap-4 transition-all hover:bg-gray-50">
                                        {/* Amount & Name */}
                                        <div className="flex items-center gap-4 flex-[2] min-w-[250px]">
                                            <div className="font-bold text-gray-900 w-24 flex-shrink-0 text-right pr-4 border-r border-gray-200">
                                                {ing.amount} <span className="text-gray-500 font-normal">{ing.unit}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="font-medium text-gray-800 text-base">
                                                    {ing.ingredient_name}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions / Status */}
                                        <div className="flex items-center gap-3 flex-wrap md:justify-end flex-[3]">
                                            {status.status === 'ok' && (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1.5 py-1 px-3">
                                                    <Check className="w-3.5 h-3.5" />
                                                    Mapped
                                                </Badge>
                                            )}
                                            <IngredientMappingDropdown
                                                ingredientName={ing.ingredient_name}
                                                suggestions={suggestions}
                                                allIngredients={currentIngredients}
                                                newSubRecipes={newSubRecipes}
                                                onSelect={(selectedIngredient) => handleMapIngredient(rIndex, originalIndex, selectedIngredient)}
                                                onCreate={() => handleCreateIngredient(rIndex, originalIndex, ing.ingredient_name)}
                                                isCreating={false}
                                                currentMapping={status.matchedIngredient}
                                                isMapped={status.status === 'ok'}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>
        ))}
      </div>
    </div>
  );
}