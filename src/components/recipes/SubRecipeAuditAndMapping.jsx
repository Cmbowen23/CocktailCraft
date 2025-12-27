import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, Loader2, Check, PlusCircle, Sparkles } from "lucide-react";
import { ingredientCategories } from '../utils/categoryDefinitions';
import { Ingredient } from "@/api/entities";
import IngredientMappingDropdown from "./IngredientMappingDropdown";
import { mapAndSplitJuice } from '../utils/costCalculations';
import { safeLower, safeTrim, safeString, safeIncludes } from '../utils/stringSafe';

// Advanced fuzzy matching with confidence scores - ENHANCED FOR PREP ACTIONS
const advancedFuzzyMatch = (newName, existingIngredients) => {
    const searchName = safeTrim(safeLower(newName));
    if (!searchName || !existingIngredients || existingIngredients.length === 0) return [];
    
    // Diagnostic for hot path
    if (typeof newName !== "string" && newName != null) {
        console.warn("Non-string newName in advancedFuzzyMatch:", newName);
    }
    
    // Check if searchName includes common juice indicators (special case for "lemon juice" -> "lemon, juice")
    const juiceIndicators = ['juice', 'juiced'];
    const hasJuiceIndicator = juiceIndicators.some(indicator => safeIncludes(searchName, indicator));
    
    const stopWords = new Set(['oz', 'ounce', 'ml', 'dash', 'splash', 'fresh', 'pure']);
    const searchTokens = searchName.split(/\s+/).filter(t => !stopWords.has(t) || searchName.split(/\s+/).length === 1);

    const candidates = [];

    const calculateScore = (targetNameStr, category, spiritType, isPrepAction = false) => {
        const targetName = safeTrim(safeLower(targetNameStr));
        const targetTokens = targetName.split(/\s+/);
        
        if (searchName === targetName) return 100;

        let score = 0;
        let matchedTokens = 0;
        searchTokens.forEach(sToken => {
            const sTokenStr = safeString(sToken);
            if (targetTokens.includes(sTokenStr)) {
                matchedTokens += 1;
            } else if (sTokenStr.length > 3) {
                 if (targetTokens.some(t => safeString(t).startsWith(sTokenStr) || sTokenStr.startsWith(safeString(t)))) {
                     matchedTokens += 0.8;
                 }
            }
        });

        if (matchedTokens > 0) {
            score = (matchedTokens / Math.max(searchTokens.length, targetTokens.length)) * 100;
        }

        const escapedSearch = searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const boundaryRegex = new RegExp(`\\b${escapedSearch}\\b`);
        if (boundaryRegex.test(targetName)) {
            score = Math.max(score, 90);
        }
        
        if (targetName.length > 3 && new RegExp(`\\b${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(searchName)) {
             score = Math.max(score, 85);
        }

        if (spiritType && safeIncludes(searchName, safeLower(spiritType))) {
            score += 10;
        }
        if (category === 'spirit' || category === 'liquor') {
            score += 5;
        }
        
        // Boost score if this is a juice prep action and search includes juice
        if (isPrepAction && hasJuiceIndicator) {
            score += 20;
        }
        
        return Math.min(Math.round(score), 100);
    };

    existingIngredients.forEach(ing => {
        const baseScore = calculateScore(ing.name, ing.category, ing.spirit_type);
        candidates.push({ ingredient: ing, confidence: baseScore });

        if (ing.prep_actions && Array.isArray(ing.prep_actions)) {
            ing.prep_actions.forEach(prep => {
                const prepFullName = `${ing.name}, ${prep.name}`;
                const prepScore = calculateScore(prepFullName, ing.category, ing.spirit_type, true);
                
                if (prepScore > 40) {
                    candidates.push({
                        ingredient: {
                            ...ing,
                            name: prepFullName,
                            id: `${ing.id}_${prep.name}`,
                            _isVirtualPrepAction: true,
                            _baseName: ing.name,
                            _prepAction: prep.name
                        },
                        confidence: prepScore
                    });
                }
            });
        }
    });

    return candidates.filter(s => s.confidence > 60).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
};

export default function SubRecipeAuditAndMapping({ 
  parsedRecipes, 
  allIngredients, 
  onSaveComplete, 
  onCancel 
}) {
  const [recipes, setRecipes] = useState(parsedRecipes);
  const [isSaving, setIsSaving] = useState(false);
  const [currentIngredients, setCurrentIngredients] = useState(allIngredients);
  const [creatingIngredients, setCreatingIngredients] = useState({});
  const [ingredientMappings, setIngredientMappings] = useState({});

  const getIngredientStatus = (ingredientName) => {
      const nameStr = safeString(ingredientName);
      if (!nameStr) return { status: 'unknown', label: 'Unknown' };

      // Use mapAndSplitJuice to intelligently parse the ingredient name
      const { ingredient_name: baseName, prep_action: prepAction } = mapAndSplitJuice(nameStr);

      if (!baseName) return { status: 'unknown', label: 'Unknown' };

      // Check if this matches a sub-recipe being created in this batch
      const isNewSubRecipe = recipes.some(r => safeLower(r.name) === safeLower(baseName));
      if (isNewSubRecipe) {
        return { status: 'ok', label: 'OK', color: 'bg-green-100 text-green-800' };
      }

      // Look for exact base ingredient match in database
      const match = currentIngredients.find(i => i.name && safeLower(i.name) === safeLower(baseName));

      if (!match) return { status: 'new', label: 'New Ingredient', color: 'bg-blue-100 text-blue-800' };

      // Base ingredient exists - consider it mapped regardless of prep action existence
      // The prep action is just usage metadata, not a blocker for mapping
      if (!match.cost_per_unit || match.cost_per_unit === 0) return { status: 'missing_cost', label: 'Missing Cost', color: 'bg-yellow-100 text-yellow-800' };
      return { status: 'ok', label: 'OK', color: 'bg-green-100 text-green-800' };
    };

  const handleCategoryChange = (index, newCategory) => {
    const updated = [...recipes];
    updated[index].category = newCategory;
    
    // Auto-detect milk clarification if milk is in ingredients
    if (newCategory === 'clarification' && !updated[index].clarificationMethod) {
      const hasMilk = updated[index].ingredients.some(ing => 
        safeIncludes(safeLower(ing.ingredient_name), 'milk')
      );
      if (hasMilk) {
        updated[index].clarificationMethod = 'milk_wash';
      }
    }
    
    setRecipes(updated);
  };

  const handleNameChange = (index, newName) => {
    const updated = [...recipes];
    updated[index].name = newName;
    setRecipes(updated);
  };

  const handleCreateIngredient = async (ingredientName) => {
    const nameStr = safeString(ingredientName);
    if (!nameStr) return;
    
    // Parse to get the base name without prep actions
    const { ingredient_name: baseName } = mapAndSplitJuice(nameStr);
    
    if (!baseName) return;
    
    setCreatingIngredients(prev => ({ ...prev, [ingredientName]: true }));
    try {
        const newIngredient = await Ingredient.create({
            name: baseName,
            category: 'other',
            ingredient_type: 'purchased',
            unit: 'oz',
            cost_per_unit: 0,
            purchase_price: 0,
            purchase_quantity: 1,
            purchase_unit: 'piece'
        });
        
        // Refresh the ingredients list
        const updatedIngredients = await Ingredient.list();
        setCurrentIngredients(updatedIngredients);
        
        // Auto-map the ingredient that was just created
        const recipesWithThisIngredient = recipes.map((recipe, rIndex) => {
            const updatedIngredients = recipe.ingredients.map((ing, iIndex) => {
                const ingNameStr = safeString(ing.ingredient_name);
                if (!ingNameStr) return ing;

                const { ingredient_name: ingBaseName } = mapAndSplitJuice(ingNameStr);
                if (ingBaseName && safeLower(ingBaseName) === safeLower(baseName)) {
                    const { prep_action } = mapAndSplitJuice(ingNameStr);
                    return { 
                        ...ing, 
                        ingredient_name: newIngredient.name, 
                        prep_action: prep_action || '',
                        preppedIngredientId: String(newIngredient.id)
                    };
                }
                return ing;
            });
            return { ...recipe, ingredients: updatedIngredients };
        });
        setRecipes(recipesWithThisIngredient);
    } catch (error) {
        console.error("Error creating ingredient:", error);
    } finally {
        setCreatingIngredients(prev => ({ ...prev, [ingredientName]: false }));
    }
  };

  const handleMapIngredient = async (recipeIndex, ingIndex, selectedIngredient) => {
    if (!selectedIngredient) return;
    
    let newIngredientName, newPrepAction, baseIngredientId;
    
    // If it's a virtual prep action, use the metadata
    if (selectedIngredient._isVirtualPrepAction) {
      newIngredientName = selectedIngredient._baseName;
      newPrepAction = selectedIngredient._prepAction;
      // Extract the real ingredient ID from the virtual ID
      baseIngredientId = String(selectedIngredient.id).split('_')[0];
    } else {
      const selectedName = safeString(selectedIngredient.name);
      if (!selectedName) return;
      
      // Otherwise parse the name using mapAndSplitJuice
      const { ingredient_name, prep_action } = mapAndSplitJuice(selectedName);
      newIngredientName = ingredient_name;
      newPrepAction = prep_action || '';
      baseIngredientId = String(selectedIngredient.id);
    }
    
    // Immutably update the nested state with preppedIngredientId
    const updatedRecipes = recipes.map((recipe, rIdx) => {
      if (rIdx !== recipeIndex) return recipe;
      
      return {
        ...recipe,
        ingredients: recipe.ingredients.map((ing, iIdx) => {
          if (iIdx !== ingIndex) return ing;
          return {
            ...ing,
            ingredient_name: newIngredientName,
            prep_action: newPrepAction,
            preppedIngredientId: baseIngredientId
          };
        })
      };
    });
    
    // Auto-detect milk clarification if mapping to milk
    if (updatedRecipes[recipeIndex].category === 'clarification' && 
        safeIncludes(safeLower(newIngredientName), 'milk') && 
        !updatedRecipes[recipeIndex].clarificationMethod) {
      updatedRecipes[recipeIndex] = {
        ...updatedRecipes[recipeIndex],
        clarificationMethod: 'milk_wash'
      };
    }
    
    setRecipes(updatedRecipes);
  };

  const handleSaveRecipe = async () => {
    if (!recipes || recipes.length === 0) return;
    
    setIsSaving(true);
    try {
      onSaveComplete(recipes);
    } catch (error) {
      console.error("Error in audit complete:", error);
      alert("Failed to process recipe: " + error.message);
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
            <h3 className="text-lg font-semibold">Review Sub-Recipe</h3>
            <p className="text-sm text-gray-600">The AI detected the category and parsed ingredients. Review and map before saving.</p>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>Back to Text</Button>
            <Button onClick={handleSaveRecipe} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Saving...</> : <><Save className="w-4 h-4 mr-2"/> Save Sub-Recipe</>}
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
                                <label className="block text-xs font-medium text-gray-500 mb-1">Sub-Recipe Name</label>
                                <Input 
                                    value={recipe.name} 
                                    onChange={(e) => handleNameChange(rIndex, e.target.value)}
                                    className="font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Category (AI Detected)</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <Select 
                                            value={recipe.category} 
                                            onValueChange={(val) => handleCategoryChange(rIndex, val)}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ingredientCategories.map(c => (
                                                    <SelectItem key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />
                                            Sub-Recipe
                                        </Badge>
                                    </div>
                                    {recipe.category === 'clarification' && (
                                        <Select 
                                            value={recipe.clarificationMethod || 'none'} 
                                            onValueChange={(val) => {
                                                const updated = [...recipes];
                                                updated[rIndex].clarificationMethod = val;
                                                setRecipes(updated);
                                            }}
                                        >
                                            <SelectTrigger className="bg-blue-50 border-blue-200">
                                                <SelectValue placeholder="Select technique" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="agar">Agar Clarification</SelectItem>
                                                <SelectItem value="milk_wash">Milk Wash</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mt-2">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Ingredients</h4>
                        <div className="space-y-2">
                            {recipe.ingredients.map((ing, originalIndex) => {
                                const nameStr = safeString(ing.ingredient_name);
                                if (!nameStr || !safeTrim(nameStr)) return null;

                                // Display name combines ingredient_name and prep_action if present
                                const prepStr = safeString(ing.prep_action);
                                const prepTrimmed = safeTrim(prepStr);
                                const displayName = prepTrimmed ? `${nameStr}, ${prepTrimmed}` : nameStr;

                                const status = getIngredientStatus(displayName);
                                const suggestions = advancedFuzzyMatch(displayName, currentIngredients);

                                const mappedIngredient = currentIngredients.find(i =>
                                    i.name && safeTrim(safeLower(i.name)) === safeTrim(safeLower(nameStr))
                                );

                                const currentMapping = mappedIngredient && prepTrimmed ? {
                                    name: displayName,
                                    id: `${mappedIngredient.id}_${prepTrimmed}`,
                                    _isVirtualPrepAction: true,
                                    _baseName: mappedIngredient.name,
                                    _prepAction: prepTrimmed
                                } : (mappedIngredient || null);

                                const isMapped = !!currentMapping;

                                return (
                                    <div
                                        key={`${recipe.id || rIndex}-${originalIndex}`}
                                        className="flex flex-col md:flex-row md:items-center text-sm p-4 bg-gray-50/50 rounded-lg border border-gray-100 gap-4 transition-all hover:bg-gray-50"
                                    >
                                        <div className="flex items-center gap-4 flex-[2] min-w-[250px]">
                                            <div className="font-bold text-gray-900 w-24 flex-shrink-0 text-right pr-4 border-r border-gray-200">
                                                {ing.amount} <span className="text-gray-500 font-normal">{ing.unit}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="font-medium text-gray-800 text-base">
                                                    {displayName}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 flex-wrap md:justify-end flex-[3]">
                                            {isMapped && (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1.5 py-1 px-3">
                                                    <Check className="w-3.5 h-3.5" />
                                                    Mapped
                                                </Badge>
                                            )}

                                            <IngredientMappingDropdown
                                                ingredientName={displayName}
                                                suggestions={suggestions}
                                                allIngredients={currentIngredients}
                                                newSubRecipes={[]}
                                                onSelect={(selectedIngredient) => handleMapIngredient(rIndex, originalIndex, selectedIngredient)}
                                                onCreate={() => handleCreateIngredient(displayName)}
                                                isCreating={creatingIngredients[displayName]}
                                                currentMapping={currentMapping}
                                                isMapped={!!currentMapping}
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