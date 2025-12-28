import React, { useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Save, X, AlertTriangle, ExternalLink, ArrowUp, ArrowDown, SortDesc, Upload, RefreshCw, Image as ImageIcon, Loader2, Search, Wand2, FlaskConical, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import UnitAutocomplete from "@/components/ui/unit-autocomplete";
import { formatCurrency, calculateIngredientCost, findMatchingIngredient, convertWithCustomConversions, mapAndSplitJuice, convertToMl } from "../utils/costCalculations";
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cocktailCategories, ingredientCategories, difficulties, spiritStyles } from '../utils/categoryDefinitions';
import { Recipe } from "@/api/entities";
import { base44 } from "@/api/base44Client";

const exemptIngredients = [
  'water', 'filtered water', 'tap water', 'distilled water', 'spring water',
  'sparkling water', 'soda water', 'club soda', 'ice'
];

const IngredientMappingSearch = ({ currentName, allIngredients, onMap, onCreate }) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  
  const filtered = React.useMemo(() => {
    if (!searchTerm) return [];
    const typedInput = searchTerm.trim().toLowerCase();
    const normalizedTypedInput = typedInput.replace(/[^a-z0-9]/g, '');

    const newFilteredSuggestions = [];

    allIngredients.forEach(ing => {
      const ingredientNameLower = ing.name.toLowerCase();
      const normalizedIngredientName = ingredientNameLower.replace(/[^a-z0-9]/g, '');

      const ingredientMatches = normalizedIngredientName.includes(normalizedTypedInput) || ingredientNameLower.includes(typedInput);

      const isExactMatch = normalizedIngredientName === normalizedTypedInput || ingredientNameLower === typedInput;
      const startsWithMatch = normalizedIngredientName.startsWith(normalizedTypedInput) || ingredientNameLower.startsWith(typedInput);
      const isNonAlcoholic = !ing.abv || ing.abv === 0;
      
      let baseScore = (isExactMatch ? 1000 : 0) + (startsWithMatch ? 100 : 0) + (isNonAlcoholic ? 10 : 0);

      if (ingredientMatches) {
        newFilteredSuggestions.push({
          type: 'ingredient',
          display_name: ing.name,
          ingredient_id: ing.id,
          base_ingredient_obj: ing,
          score: baseScore
        });
      }

      if (ingredientMatches && ing.prep_actions && Array.isArray(ing.prep_actions)) {
        ing.prep_actions.forEach(prep => {
          if (prep.name && prep.id) {
            const prepDisplayName = `${ing.name}, ${pep.name}`;
            const prepNameLower = prep.name.toLowerCase();
            const prepMatchesInput = prepNameLower.includes(typedInput);
            const prepScore = baseScore + (prepMatchesInput ? 50 : 0) + 5;
            
            newFilteredSuggestions.push({
              type: 'prep_action',
              display_name: prepDisplayName,
              ingredient_id: ing.id,
              prep_action_id: prep.id,
              base_ingredient_obj: ing,
              prep_action_obj: prep,
              score: prepScore
            });
          }
        });
      }
    });

    newFilteredSuggestions.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.type === 'ingredient' && b.type === 'prep_action') return -1;
      if (a.type === 'prep_action' && b.type === 'ingredient') return 1;
      return a.display_name.localeCompare(b.display_name);
    });

    const uniqueSuggestions = Array.from(new Map(newFilteredSuggestions.map(item => [item.ingredient_id + (item.prep_action_id || ''), item])).values());
    return uniqueSuggestions.slice(0, 50);
  }, [searchTerm, allIngredients]);

  const displayBaseName = currentName.split(',')[0].split(' - ')[0].trim();

  return (
    <div className="p-3 w-72">
        <div className="mb-3">
            <h4 className="font-medium text-sm mb-1">Map "{displayBaseName}"</h4>
            <p className="text-xs text-gray-500 mb-2">
                Ingredient not found. Search to map it or create a new one.
            </p>
            <div className="relative">
                <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
                <Input 
                    placeholder="Search existing ingredient..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-8 text-xs pl-7"
                    autoFocus
                />
            </div>
        </div>
        {filtered.length > 0 ? (
            <div className="space-y-1 mb-3 max-h-60 overflow-y-auto">
                {filtered.map((suggestion) => (
                    <Button
                        key={suggestion.ingredient_id + (suggestion.prep_action_id || '')}
                        variant="ghost"
                        className={`w-full justify-start h-auto py-1.5 px-2 text-left font-normal hover:bg-blue-50 ${suggestion.type === 'prep_action' ? 'pl-4' : ''}`}
                        onClick={() => onMap(suggestion)}
                    >
                        <div className="flex flex-col items-start overflow-hidden">
                            <span className="text-xs font-medium truncate w-full text-gray-900">
                              {suggestion.type === 'prep_action' && '- '}{suggestion.display_name}
                            </span>
                            <span className="text-[10px] text-gray-500 truncate w-full">
                                {suggestion.base_ingredient_obj.category} {suggestion.base_ingredient_obj.cost_per_unit ? `• $${formatCurrency(suggestion.base_ingredient_obj.cost_per_unit)}/${suggestion.base_ingredient_obj.unit}` : ''}
                            </span>
                        </div>
                    </Button>
                ))}
            </div>
        ) : searchTerm ? (
             <div className="mb-3 text-xs text-center text-gray-400">No matches found</div>
        ) : null}
        <div className="pt-2 border-t space-y-2">
            <Button 
                variant="secondary" 
                className="w-full h-7 text-xs bg-gray-100 hover:bg-gray-200 text-gray-900" 
                onClick={onCreate}
            >
                <Plus className="mr-2 h-3 w-3" /> Create New Ingredient
            </Button>
            <Button 
              type="button"
              variant="secondary" 
              className="w-full h-7 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-900" 
              onClick={() => {
                  const returnUrl = window.location.pathname + window.location.search;
                  window.location.href = createPageUrl(`CreateSubRecipe?name=${encodeURIComponent(displayBaseName)}&returnTo=${encodeURIComponent(returnUrl)}`);
              }}
            >
              <FlaskConical className="mr-2 h-3 w-3" /> Create Sub-Recipe
            </Button>
        </div>
        </div>
        );
        };

const RecipeForm = forwardRef(({ recipe, onSubmit, onCancel, allIngredients = [], allRecipes = [], isSubRecipe = false, onAddIngredientCost, onNavigateToSubRecipe, onRecipeChange, currentUser, onGenerateRecipe, isGeneratingRecipe, clarificationMethod: parentClarificationMethod, setClarificationMethod: setParentClarificationMethod, calculateTotalVolumeMl, showAdvancedTools, onToggleAdvancedTools, activeCalculator, calculatorSubType, calculatorInput, setCalculatorInput, setCalculatorSubType, variableConfig, setVariableConfig, cordialAction, setCordialAction, cordialTargetAbv, setCordialTargetAbv, useRecipeSpirit, setUseRecipeSpirit, selectedSpiritId, setSelectedSpiritId, manualSpiritAbv, setManualSpiritAbv, recipeSpirits, handleApplyCalculator, cordialArchitect }, ref) => {
              const [availableCategories, setAvailableCategories] = React.useState([]);
              const [isAddingCustomCategory, setIsAddingCustomCategory] = React.useState(false);

        const [currentRecipe, setCurrentRecipe] = React.useState(() => {
          const effectiveIsSubRecipe = isSubRecipe || (recipe?.category && ingredientCategories.includes(recipe.category));

          if (recipe) {
            const cleanedIngredients = (recipe.ingredients || []).map(ing => {
              const { ingredient_name: baseNameFromText, prep_action: prepActionNameFromText } = mapAndSplitJuice(ing.ingredient_name || "", allIngredients);

              const matchedIng = findMatchingIngredient(baseNameFromText, allIngredients, ing.ingredient_id);
              
              let displayName = ing.ingredient_name || "";
              let ingredientId = ing.ingredient_id || null;
              let prepActionId = ing.prep_action_id || null;

              if (!ingredientId && baseNameFromText) {
                if (matchedIng) {
                  ingredientId = matchedIng.id;
                  if (prepActionNameFromText && matchedIng.prep_actions) {
                    const matchedPrep = matchedIng.prep_actions.find(p => p.name === prepActionNameFromText);
                    if (matchedPrep) {
                      prepActionId = matchedPrep.id;
                      displayName = `${matchedIng.name}, ${matchedPrep.name}`;
                    } else {
                      displayName = matchedIng.name;
                      prepActionId = null;
                    }
                  } else {
                    displayName = matchedIng.name;
                    prepActionId = null;
                  }
                } else {
                  ingredientId = null;
                  prepActionId = null;
                }
              } else if (ingredientId && matchedIng) {
                if (prepActionId && matchedIng.prep_actions) {
                  const matchedPrep = matchedIng.prep_actions.find(p => p.id === prepActionId);
                  if (matchedPrep) {
                    displayName = `${matchedIng.name}, ${matchedPrep.name}`;
                  } else {
                    prepActionId = null;
                    displayName = matchedIng.name;
                  }
                } else {
                  displayName = matchedIng.name;
                  prepActionId = null;
                }
              }


              return { 
                ...ing,
                ingredient_name: displayName,
                amount: ing.amount !== undefined && ing.amount !== null ? String(ing.amount) : "",
                ingredient_id: ingredientId,
                prep_action_id: prepActionId,
              };
            });
            return { 
              ...recipe, 
              ingredients: cleanedIngredients.length > 0 ? cleanedIngredients : [{ ingredient_name: "", amount: "", unit: "ml", notes: "", ingredient_id: null, prep_action_id: null }],
              instructions: recipe.instructions && recipe.instructions.length > 0 ? recipe.instructions : [""]
            };
          }
          return {
            name: "", description: "", category: effectiveIsSubRecipe ? "syrup" : "classic", base_spirit: "", 
            ingredients: [{ ingredient_name: "", amount: "", unit: "ml", notes: "", ingredient_id: null, prep_action_id: null }], 
            instructions: [""], garnish: "", glassware: "", difficulty: "medium", image_url: "", 
            yield_amount: effectiveIsSubRecipe ? 0 : undefined, yield_unit: effectiveIsSubRecipe ? "ml" : undefined
          };
        });

  const [ingredientSuggestions, setIngredientSuggestions] = React.useState({});
  const [showSuggestions, setShowSuggestions] = React.useState({});
  const [justSelected, setJustSelected] = React.useState({});
  const [autoCalculateYield, setAutoCalculateYield] = React.useState(false);
  const [previousYieldUnit, setPreviousYieldUnit] = React.useState(currentRecipe.yield_unit || 'ml');
  const [variantsLookup, setVariantsLookup] = React.useState({});
  const [isGeneratingImage, setIsGeneratingImage] = React.useState(false);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);

  const [localClarificationMethod, setLocalClarificationMethod] = React.useState(parentClarificationMethod || "none");

  const actualIsSubRecipe = ingredientCategories.includes(currentRecipe.category);

  React.useEffect(() => {
    const loadCategories = async () => {
      try {
        const customCategories = await base44.entities.RecipeCategory.list();
        const customCategoryNames = customCategories.map(c => c.name);
        const allCategories = [...new Set([...cocktailCategories, ...customCategoryNames])];
        setAvailableCategories(allCategories);
      } catch (error) {
        console.error("Failed to load categories:", error);
        setAvailableCategories(cocktailCategories);
      }
    };
    loadCategories();
  }, []);

  React.useEffect(() => {
    if (parentClarificationMethod !== undefined) {
      setLocalClarificationMethod(parentClarificationMethod);
    }
  }, [parentClarificationMethod]);
  
  React.useEffect(() => {
    if (currentRecipe.category !== 'clarification' && localClarificationMethod !== 'none') {
      setLocalClarificationMethod('none');
      if (setParentClarificationMethod) setParentClarificationMethod('none');
    }
  }, [currentRecipe.category, localClarificationMethod, setParentClarificationMethod]);

  React.useEffect(() => {
    const fetchVariants = async () => {
      if (!allIngredients || allIngredients.length === 0) return;

      try {
        const { base44 } = await import("@/api/base44Client");
        const allVariants = await base44.entities.ProductVariant.list("-created_at", 5000);
        
        const lookup = {};
        (allVariants || []).forEach(variant => {
          if (variant.ingredient_id) {
            if (!lookup[variant.ingredient_id]) {
              lookup[variant.ingredient_id] = [];
            }
            lookup[variant.ingredient_id].push(variant);
          }
        });
        
        setVariantsLookup(lookup);
      } catch (error) {
        console.error('Error fetching product variants:', error);
      }
    };

    fetchVariants();
  }, [allIngredients]);

  const recipeJson = React.useMemo(() => recipe ? JSON.stringify(recipe) : null, [recipe]);
  React.useEffect(() => {
    if (recipe) {
      const cleanedIngredients = (recipe.ingredients || []).map(ing => {
        const { ingredient_name: baseNameFromText, prep_action: prepActionNameFromText } = mapAndSplitJuice(ing.ingredient_name || "", allIngredients);
        const matchedIng = findMatchingIngredient(baseNameFromText, allIngredients, ing.ingredient_id);
        
        let displayName = ing.ingredient_name || "";
        let ingredientId = ing.ingredient_id || null;
        let prepActionId = ing.prep_action_id || null;

        if (!ingredientId && baseNameFromText) {
          if (matchedIng) {
            ingredientId = matchedIng.id;
            if (prepActionNameFromText && matchedIng.prep_actions) {
              const matchedPrep = matchedIng.prep_actions.find(p => p.name === prepActionNameFromText);
              if (matchedPrep) {
                prepActionId = matchedPrep.id;
                displayName = `${matchedIng.name}, ${matchedPrep.name}`;
              } else {
                displayName = matchedIng.name;
                prepActionId = null;
              }
            } else {
              displayName = matchedIng.name;
              prepActionId = null;
            }
          }
        } else if (ingredientId && matchedIng) {
          if (prepActionId && matchedIng.prep_actions) {
            const matchedPrep = matchedIng.prep_actions.find(p => p.id === prepActionId);
            if (matchedPrep) {
              displayName = `${matchedIng.name}, ${matchedPrep.name}`;
            } else {
              prepActionId = null;
              displayName = matchedIng.name;
            }
          } else {
            displayName = matchedIng.name;
            prepActionId = null;
          }
        }
        
        return {
          ...ing,
          ingredient_name: displayName,
          amount: ing.amount !== undefined && ing.amount !== null ? String(ing.amount) : "",
          ingredient_id: ingredientId,
          prep_action_id: prepActionId,
        };
      });

      const newRecipeState = {
        ...recipe,
        ingredients: cleanedIngredients.length > 0 ? cleanedIngredients : [{ ingredient_name: "", amount: "", unit: "ml", notes: "", ingredient_id: null, prep_action_id: null }],
        instructions: recipe.instructions && recipe.instructions.length > 0 ? recipe.instructions : [""]
      };
      setCurrentRecipe(newRecipeState);
      setPreviousYieldUnit(newRecipeState.yield_unit || 'ml');
    }
  }, [recipeJson, allIngredients]);

  React.useEffect(() => {
    if (currentRecipe?.ingredients && allIngredients.length > 0) {
      let needsUpdate = false;
      const updatedIngredients = currentRecipe.ingredients.map(ing => {
        if (!ing.ingredient_id && ing.ingredient_name) {
          const { ingredient_name: baseNameFromText, prep_action: prepActionNameFromText } = mapAndSplitJuice(ing.ingredient_name, allIngredients);
          const matchedIng = findMatchingIngredient(baseNameFromText, allIngredients);
          
          if (matchedIng) {
            needsUpdate = true;
            const updatedIng = { ...ing, ingredient_id: matchedIng.id };

            if (prepActionNameFromText && matchedIng.prep_actions) {
              const matchedPrep = matchedIng.prep_actions.find(p => p.name === prepActionNameFromText);
              if (matchedPrep) {
                updatedIng.prep_action_id = matchedPrep.id;
                updatedIng.ingredient_name = `${matchedIng.name}, ${matchedPrep.name}`;
              } else {
                updatedIng.prep_action_id = null;
                updatedIng.ingredient_name = matchedIng.name;
              }
            } else {
              updatedIng.prep_action_id = null;
              updatedIng.ingredient_name = matchedIng.name;
            }
            return updatedIng;
          }
        }
        return ing;
      });

      if (needsUpdate) {
        const updatedRecipe = { ...currentRecipe, ingredients: updatedIngredients };
        setCurrentRecipe(updatedRecipe);
        if (onRecipeChange) onRecipeChange(updatedRecipe);
      }
    }
  }, [allIngredients.length]);

  const handleClarificationMethodChange = (value) => {
    setLocalClarificationMethod(value);
    if (setParentClarificationMethod) setParentClarificationMethod(value);
  };

  const handleAddClarificationAgent = () => {
      if (!calculateTotalVolumeMl) {
          toast.error("Clarification feature not available in this context.");
          return;
      }

      const totalVolume = calculateTotalVolumeMl();
      if (totalVolume <= 0) {
          toast.error("Please add ingredients with volume first.");
          return;
      }

      let agent = null;
      let instructions = [];
      
      if (localClarificationMethod === 'agar') {
          agent = { name: 'Agar Agar', ratio: 0.002, unit: 'g', displayPerc: '0.2%' };
          instructions = [
              'Combine all ingredients except agar in a pot',
              'Bring to a simmer and add agar, whisking constantly',
              'Simmer for 2 minutes until agar is fully dissolved',
              'Pour into container and refrigerate for 4-6 hours until set',
              'Strain through cheesecloth or coffee filter to clarify'
          ];
      }
      if (localClarificationMethod === 'milk_wash') {
          agent = { name: 'Whole Milk', ratio: 0.25, unit: 'ml', displayPerc: '25%' };
          instructions = [
              'Combine all ingredients except milk in a container',
              'Add whole milk and stir gently to combine',
              'Let sit at room temperature for 30 minutes',
              'Refrigerate for 24 hours until milk solids separate and float',
              'Strain through cheesecloth or coffee filter multiple times until clear'
          ];
      }
      
      if (!agent) return;

      const amount = totalVolume * agent.ratio;
      
      const newIngredient = {
          ingredient_name: agent.name,
          amount: parseFloat(amount.toFixed(2)),
          unit: agent.unit,
          notes: `Clarification Agent (${agent.displayPerc} of ${totalVolume.toFixed(0)}ml batch)`,
          ingredient_role: 'processing_agent',
          ingredient_id: null,
          prep_action_id: null
      };

      const updatedRecipe = {
          ...currentRecipe,
          ingredients: [...currentRecipe.ingredients, newIngredient],
          instructions: instructions.length > 0 ? instructions : currentRecipe.instructions
      };
      
      setCurrentRecipe(updatedRecipe);
      if (onRecipeChange) onRecipeChange(updatedRecipe);
      
      const newMethod = "none";
      setLocalClarificationMethod(newMethod);
      if (setParentClarificationMethod) setParentClarificationMethod(newMethod);
  };

  const handleGenerateRecipeClick = () => {
      if (onGenerateRecipe) onGenerateRecipe();
  };

  React.useEffect(() => {
    if (autoCalculateYield && actualIsSubRecipe) {
        let totalYieldMl = 0;
        currentRecipe.ingredients.forEach(ing => {
            let matchedIngredient = null;
            if (ing.ingredient_id) {
              matchedIngredient = findMatchingIngredient(null, allIngredients, ing.ingredient_id);
            } else {
              const { ingredient_name: baseNameFromText } = mapAndSplitJuice(ing.ingredient_name, allIngredients);
              matchedIngredient = findMatchingIngredient(baseNameFromText, allIngredients);
            }

            if (ing.amount && ing.unit && matchedIngredient) {
                let volumeMl = convertWithCustomConversions(parseFloat(ing.amount), ing.unit, 'ml', matchedIngredient);
                
                if (matchedIngredient.name.toLowerCase().trim() === 'white sugar') {
                    volumeMl /= 2;
                }
                
                if (!isNaN(volumeMl) && volumeMl !== null) {
                    totalYieldMl += volumeMl;
                }
            }
        });

        const newYieldAmount = parseFloat(totalYieldMl.toFixed(2));
        if (currentRecipe.yield_amount !== newYieldAmount || currentRecipe.yield_unit !== 'ml') {
             setCurrentRecipe(prev => ({
                ...prev,
                yield_amount: newYieldAmount,
                yield_unit: 'ml'
            }));
        }
    }
  }, [autoCalculateYield, currentRecipe.ingredients, allIngredients, actualIsSubRecipe, currentRecipe.yield_amount, currentRecipe.yield_unit]);


  useImperativeHandle(ref, () => ({
    submit: async (isDraft) => {
      const recipeToSubmit = buildRecipePayload();
      
      try {
        if (recipe?.id) {
            await Recipe.update(recipe.id, recipeToSubmit);
        }
      } catch(e) {
        console.error("Failed to save draft:", e)
      }
    }
  }));

  const buildRecipePayload = () => {
    let totalCost = 0;
    
    const parsedIngredients = currentRecipe.ingredients.map(ing => {
      const ingredientForCosting = {
        ...ing,
        ingredient_id: ing.ingredient_id,
        prep_action_id: ing.prep_action_id,
        amount: parseFloat(ing.amount) || 0,
      };

      const { cost } = calculateIngredientCost(ingredientForCosting, allIngredients, variantsLookup, "auto", allRecipes); 
      totalCost += cost;
      
      return {
        ingredient_name: ing.ingredient_name,
        amount: parseFloat(ing.amount) || 0,
        unit: ing.unit,
        notes: ing.notes,
        ingredient_id: ing.ingredient_id,
        prep_action_id: ing.prep_action_id || undefined,
      };
    });

    const recipeToSubmit = {
      ...currentRecipe,
      ingredients: parsedIngredients,
      cost_per_serving: totalCost,
      menu_price: !actualIsSubRecipe ? Math.round(totalCost * 5) : null,
      serving_size: currentRecipe.is_cocktail ? currentRecipe.serving_size : undefined,
      serving_unit: currentRecipe.is_cocktail ? currentRecipe.serving_unit : undefined
    };

    if (!actualIsSubRecipe && !recipeToSubmit.category) {
      recipeToSubmit.category = "classic";
    }

    return recipeToSubmit;
  }

  const handleInputChange = (field, value) => {
    const updatedRecipe = { ...currentRecipe, [field]: value };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
  };

  const handleYieldUnitChange = (newUnit) => {
    if (!autoCalculateYield && currentRecipe.yield_amount && previousYieldUnit !== newUnit) {
      const currentAmount = parseFloat(currentRecipe.yield_amount) || 0;
      
      if (currentAmount > 0) {
        const convertedAmount = convertWithCustomConversions(currentAmount, previousYieldUnit, newUnit, null);
        
        const updatedRecipe = {
          ...currentRecipe,
          yield_amount: parseFloat(convertedAmount.toFixed(3)),
          yield_unit: newUnit
        };
        
        setCurrentRecipe(updatedRecipe);
        setPreviousYieldUnit(newUnit);
        
        if (onRecipeChange) {
          onRecipeChange(updatedRecipe);
        }
      } else {
        handleInputChange('yield_unit', newUnit);
        setPreviousYieldUnit(newUnit);
      }
    } else {
      handleInputChange('yield_unit', newUnit);
      setPreviousYieldUnit(newUnit);
    }
  };

  const handleIngredientChange = (index, field, value) => {
    if (field === 'unit' && value === 'top') {
      const newIngredients = [...currentRecipe.ingredients];
      newIngredients[index] = { ...newIngredients[index], unit: value, amount: '1' };
      const updatedRecipe = { ...currentRecipe, ingredients: newIngredients };
      setCurrentRecipe(updatedRecipe);
      if (onRecipeChange) onRecipeChange(updatedRecipe);
      return;
    }
    
    if (field === 'ingredient_name' && index === 0) {
      const ingredientRegex = /^([\d\s\/\.]+)\s+(\S+)\s+(.+)$/;
      const singleLineMatch = value.match(ingredientRegex);
      
      if (singleLineMatch && !value.includes('\n')) {
        const [, amountStr, unit, ingredientName] = singleLineMatch;
        try {
          const cleanAmount = amountStr.trim().replace(/\s+/g, '+').replace(/(\d)\/(\d)/g, '($1/$2)');
          const amount = eval(cleanAmount);
          
          const updatedRecipe = { 
            ...currentRecipe, 
            ingredients: [{
              ingredient_name: ingredientName.trim(),
              amount: amount.toString(),
              unit: unit.trim(),
              notes: "",
              ingredient_id: null,
              prep_action_id: null,
            }]
          };
          setCurrentRecipe(updatedRecipe);
          if (onRecipeChange) onRecipeChange(updatedRecipe);
          return;
        } catch (e) {
          console.warn("Failed to parse single line:", e);
        }
      }
      
      const lines = value.split(/\r?\n/).filter(l => l.trim());
      
      if (lines.length > 1) {
        const parsedIngredients = [];

        lines.forEach(line => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return;
          
          const match = trimmedLine.match(ingredientRegex);
          if (match) {
            const [, amountStr, unit, ingredientName] = match;
            try {
              const cleanAmount = amountStr.trim().replace(/\s+/g, '+').replace(/(\d)\/(\d)/g, '($1/$2)');
              const amount = eval(cleanAmount);
              parsedIngredients.push({
                ingredient_name: ingredientName.trim(),
                amount: amount.toString(),
                unit: unit.trim(),
                notes: "",
                ingredient_id: null,
                prep_action_id: null,
              });
            } catch (e) {
              console.warn("Failed to parse amount from:", amountStr, e);
            }
          }
        });

        if (parsedIngredients.length > 0) {
          const updatedRecipe = { ...currentRecipe, ingredients: parsedIngredients };
          setCurrentRecipe(updatedRecipe);
          if (onRecipeChange) onRecipeChange(updatedRecipe);
          return;
        }
      }
    }

    const newIngredients = [...currentRecipe.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    
    if (field === 'ingredient_name') {
      newIngredients[index].ingredient_id = null;
      newIngredients[index].prep_action_id = null;
      
      // Check if ingredient name contains a comma and show warning
      if (value && value.includes(',') && !value.includes(' - ')) {
        const parts = value.split(',');
        if (parts.length === 2) {
          toast.info(`Tip: Commas typically indicate prep actions. Consider using "${parts[0].trim()} - ${parts[1].trim()}" or "${parts[1].trim()} ${parts[0].trim()}" for clarity.`, {
            duration: 5000,
          });
        } else if (parts.length > 2) {
          toast.warning(`Multiple commas detected. For ingredient names, consider simpler phrasing (e.g., "Persian Lime" instead of "Lime, Persian").`, {
            duration: 5000,
          });
        }
      }
    }
    
    const updatedRecipe = { ...currentRecipe, ingredients: newIngredients };
    setCurrentRecipe(updatedRecipe);

    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }

    if (field === 'ingredient_name' && value.trim()) {
        const typedInput = value.trim().toLowerCase();
        const normalizedTypedInput = typedInput.replace(/[^a-z0-9]/g, '');

        const newFilteredSuggestions = [];

        allIngredients.forEach(ing => {
          const ingredientNameLower = ing.name.toLowerCase();
          const normalizedIngredientName = ingredientNameLower.replace(/[^a-z0-9]/g, '');

          const ingredientMatches = normalizedIngredientName.includes(normalizedTypedInput) || ingredientNameLower.includes(typedInput);
          
          const isExactMatch = normalizedIngredientName === normalizedTypedInput || ingredientNameLower === typedInput;
          const startsWithMatch = normalizedIngredientName.startsWith(normalizedTypedInput) || ingredientNameLower.startsWith(typedInput);
          const isNonAlcoholic = !ing.abv || ing.abv === 0;
          
          let baseScore = (isExactMatch ? 1000 : 0) + (startsWithMatch ? 100 : 0) + (isNonAlcoholic ? 10 : 0);

          if (ingredientMatches) {
            newFilteredSuggestions.push({
              type: 'ingredient',
              display_name: ing.name,
              ingredient_id: ing.id,
              base_ingredient_obj: ing,
              score: baseScore
            });
          }

          if (ingredientMatches && ing.prep_actions && Array.isArray(ing.prep_actions)) {
            ing.prep_actions.forEach(prep => {
              if (prep.name && prep.id) {
                const combinedName = `${ing.name}, ${prep.name}`;
                const prepNameLower = prep.name.toLowerCase();
                const prepMatchesInput = prepNameLower.includes(typedInput);
                const prepScore = baseScore + (prepMatchesInput ? 50 : 0) + 5;
                
                newFilteredSuggestions.push({
                  type: 'prep_action',
                  display_name: combinedName,
                  ingredient_id: ing.id,
                  prep_action_id: prep.id,
                  base_ingredient_obj: ing,
                  prep_action_obj: prep,
                  score: prepScore
                });
              }
            });
          }
        });
      
      newFilteredSuggestions.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.type === 'ingredient' && b.type === 'prep_action') return -1;
        if (a.type === 'prep_action' && b.type === 'ingredient') return 1;
        return a.display_name.localeCompare(b.display_name);
      });
      
      const uniqueSuggestions = Array.from(new Map(newFilteredSuggestions.map(item => [item.ingredient_id + (item.prep_action_id || ''), item])).values());

      setIngredientSuggestions(prev => ({
        ...prev,
        [index]: uniqueSuggestions.slice(0, 50)
      }));
      setShowSuggestions(prev => ({
        ...prev,
        [index]: uniqueSuggestions.length > 0
      }));
    } else if (field === 'ingredient_name') {
      setShowSuggestions(prev => ({
        ...prev,
        [index]: false
      }));
    }
  };

  const handleIngredientSelect = (index, suggestion) => {
    const newIngredients = [...currentRecipe.ingredients];
    
    let defaultUnit = suggestion.base_ingredient_obj.unit || 'ml';
    if (suggestion.type === 'prep_action' && suggestion.prep_action_obj?.yield_unit) {
      defaultUnit = suggestion.prep_action_obj.yield_unit;
    }
    
    newIngredients[index] = { 
      ...newIngredients[index], 
      ingredient_name: suggestion.display_name,
      ingredient_id: suggestion.ingredient_id,
      prep_action_id: suggestion.prep_action_id || null,
      unit: defaultUnit
    };
    const updatedRecipe = { ...currentRecipe, ingredients: newIngredients };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
    
    setJustSelected(prev => ({ ...prev, [index]: true }));
    
    setShowSuggestions(prev => ({
      ...prev,
      [index]: false
    }));
    
    setTimeout(() => {
      setJustSelected(prev => ({ ...prev, [index]: false }));
    }, 100);
  };

  const handleIngredientBlur = (index) => {
    setTimeout(() => {
      setShowSuggestions(prev => ({
        ...prev,
        [index]: false
      }));
    }, 200);

    if (justSelected[index]) {
      setJustSelected(prev => ({ ...prev, [index]: false }));
      return;
    }

    const ingredient = currentRecipe.ingredients[index];

    if (!ingredient.ingredient_id && ingredient.ingredient_name) {
      const { ingredient_name: baseNameFromText, prep_action: prepActionNameFromText } = mapAndSplitJuice(ingredient.ingredient_name, allIngredients);
      const matchedIng = findMatchingIngredient(baseNameFromText, allIngredients);
      
      if (matchedIng) {
        const newIngredients = [...currentRecipe.ingredients];
        const updatedIng = { ...newIngredients[index], ingredient_id: matchedIng.id };
        let defaultUnit = ingredient.unit || matchedIng.unit || 'ml';

        if (prepActionNameFromText && matchedIng.prep_actions) {
          const matchedPrep = matchedIng.prep_actions.find(p => p.name === prepActionNameFromText);
          if (matchedPrep) {
            updatedIng.prep_action_id = matchedPrep.id;
            defaultUnit = matchedPrep.yield_unit || defaultUnit;
            updatedIng.ingredient_name = `${matchedIng.name}, ${matchedPrep.name}`;
          } else {
            updatedIng.prep_action_id = null;
            updatedIng.ingredient_name = matchedIng.name;
          }
        } else {
          updatedIng.prep_action_id = null;
          updatedIng.ingredient_name = matchedIng.name;
        }

        if (!ingredient.unit || ingredient.unit === 'ml') {
          updatedIng.unit = defaultUnit;
        }

        newIngredients[index] = updatedIng;
        const updatedRecipe = { ...currentRecipe, ingredients: newIngredients };
        setCurrentRecipe(updatedRecipe);
        
        if (onRecipeChange) {
          onRecipeChange(updatedRecipe);
        }
      }
    }
  };

  const addIngredient = () => {
    const updatedRecipe = {
      ...currentRecipe,
      ingredients: [...currentRecipe.ingredients, { ingredient_name: "", amount: "", unit: "ml", notes: "", ingredient_id: null, prep_action_id: null }]
    };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
  };

  const removeIngredient = (index) => {
    const updatedRecipe = {
      ...currentRecipe,
      ingredients: currentRecipe.ingredients.filter((_, i) => i !== index)
    };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
  };

  const moveIngredient = (index, direction) => {
    if (index < 0 || index >= currentRecipe.ingredients.length) return;
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === currentRecipe.ingredients.length - 1)) {
      return;
    }
    const newIngredients = [...currentRecipe.ingredients];
    const [movedItem] = newIngredients.splice(index, 1);
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    newIngredients.splice(newIndex, 0, movedItem);
    const updatedRecipe = { ...currentRecipe, ingredients: newIngredients };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
  };

  const handleSortByCost = () => {
    const ingredientsWithCosts = currentRecipe.ingredients.map(ing => {
        const ingredientForCosting = { 
          ...ing, 
          ingredient_id: ing.ingredient_id,
          prep_action_id: ing.prep_action_id,
          amount: parseFloat(ing.amount) || 0 
        };
        const { cost } = calculateIngredientCost(ingredientForCosting, allIngredients, variantsLookup, "auto", allRecipes);
        return { ...ing, _calculatedCost: cost };
    });
    const sortedIngredients = [...ingredientsWithCosts].sort((a, b) => {
        const costA = a._calculatedCost ?? -Infinity;
        const costB = b._calculatedCost ?? -Infinity;
        return costB - costA;
    });
    const finalSortedIngredients = sortedIngredients.map(({ _calculatedCost, ...rest }) => rest);
    const updatedRecipe = { ...currentRecipe, ingredients: finalSortedIngredients };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
  };

  const handleToggleUnits = () => {
    const ozCount = currentRecipe.ingredients.filter(ing => ing.unit === 'oz').length;
    const mlCount = currentRecipe.ingredients.filter(ing => ing.unit === 'ml').length;
    const targetUnit = ozCount > mlCount ? 'ml' : 'oz';
    
    const convertedIngredients = currentRecipe.ingredients.map(ing => {
        let matchedIngredient = null;
        if (ing.ingredient_id) {
          matchedIngredient = findMatchingIngredient(null, allIngredients, ing.ingredient_id);
        } else {
          const { ingredient_name: baseNameFromText } = mapAndSplitJuice(ing.ingredient_name, allIngredients);
          matchedIngredient = findMatchingIngredient(baseNameFromText, allIngredients);
        }
        
        if (ing.unit === targetUnit || !matchedIngredient) return ing;
        
        const convertedAmount = convertWithCustomConversions(
            parseFloat(ing.amount) || 0, 
            ing.unit, 
            targetUnit, 
            matchedIngredient
        );
        
        if (convertedAmount && !isNaN(convertedAmount)) {
            return {
                ...ing,
                amount: parseFloat(convertedAmount.toFixed(3)),
                unit: targetUnit
            };
        }
        
        return ing;
    });
    
    const updatedRecipe = { ...currentRecipe, ingredients: convertedIngredients };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
        onRecipeChange(updatedRecipe);
    }
    
    toast.success(`Converted to ${targetUnit}`);
  };

  const handleRoundToHalf = () => {
    const roundedIngredients = currentRecipe.ingredients.map(ing => {
        return {
            ...ing,
            amount: (Math.round(parseFloat(ing.amount) * 2) / 2).toString()
        };
    });
    
    const updatedRecipe = { ...currentRecipe, ingredients: roundedIngredients };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
        onRecipeChange(updatedRecipe);
    }
    
    toast.success("Amounts rounded to nearest 0.5");
  };

  const handleInstructionChange = (index, value) => {
    const newInstructions = [...currentRecipe.instructions];
    newInstructions[index] = value;
    const updatedRecipe = { ...currentRecipe, instructions: newInstructions };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
  };

  const addInstruction = () => {
    const updatedRecipe = {
      ...currentRecipe,
      instructions: [...currentRecipe.instructions, ""]
    };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
  };

  const removeInstruction = (index) => {
    const updatedRecipe = {
      ...currentRecipe,
      instructions: currentRecipe.instructions.filter((_, i) => i !== index)
    };
    setCurrentRecipe(updatedRecipe);
    
    if (onRecipeChange) {
      onRecipeChange(updatedRecipe);
    }
  };

  const handleSubmit = (e, options = {}) => {
    e?.preventDefault();
    const recipeToSubmit = buildRecipePayload();
    onSubmit(recipeToSubmit, options);
  };

  const getIngredientCostStatus = (ingredientName) => {
    if (!ingredientName || !ingredientName.trim()) return null;
    
    const ingredient = currentRecipe.ingredients.find(ing => ing.ingredient_name === ingredientName);
    let match = null;
    if (ingredient?.ingredient_id) {
      match = findMatchingIngredient(null, allIngredients, ingredient.ingredient_id);
    } else {
      const { ingredient_name: baseNameFromText } = mapAndSplitJuice(ingredientName, allIngredients);
      match = findMatchingIngredient(baseNameFromText, allIngredients);
    }

    if (!match) return 'not_found';

    const normalizedMatchName = match.name.toLowerCase().trim();
    const isExempt = exemptIngredients.some(exempt =>
      normalizedMatchName.includes(exempt.toLowerCase()) || exempt.toLowerCase().includes(normalizedMatchName)
    );
    if (isExempt) return 'has_cost';

    if (ingredient?.prep_action_id) {
      const prepActionExists = match.prep_actions?.some(p => p.id === ingredient.prep_action_id);
      if (!prepActionExists) {
        return 'no_cost';
      }
    }
    
    if (match.ingredient_type === 'sub_recipe' && match.sub_recipe_id) {
      return 'has_cost';
    }
    
    let hasCost = (parseFloat(match.cost_per_unit) || 0) > 0;

    if (!hasCost && match.ingredient_type === 'sub_recipe' && match.cost_per_unit !== undefined && match.cost_per_unit !== null) {
      hasCost = (parseFloat(match.cost_per_unit) || 0) > 0;
    }

    if (!hasCost && match.ingredient_type === 'purchased' && match.id && variantsLookup && variantsLookup[match.id]) {
         const variants = variantsLookup[match.id];
         if (variants && variants.some(v => 
             (parseFloat(v.purchase_price) > 0 && parseFloat(v.purchase_quantity) > 0) ||
             (parseFloat(v.case_price) > 0 && parseFloat(v.bottles_per_case) > 0)
         )) {
             hasCost = true;
         }
    }

    return hasCost ? 'has_cost' : 'no_cost';
  };

  const handleAddIngredientCost = (ingredientName) => {
    if (onAddIngredientCost && typeof onAddIngredientCost === 'function') {
      const ingredient = currentRecipe.ingredients.find(ing => ing.ingredient_name === ingredientName);
      let baseIngredientNameForCost = ingredientName;
      let baseIngredientIdForCost = null;

      if (ingredient?.ingredient_id) {
        const matchedIng = findMatchingIngredient(null, allIngredients, ingredient.ingredient_id);
        if (matchedIng) {
          baseIngredientNameForCost = matchedIng.name;
          baseIngredientIdForCost = matchedIng.id;
        }
      } else {
        const { ingredient_name: parsedBaseName } = mapAndSplitJuice(ingredientName, allIngredients);
        baseIngredientNameForCost = parsedBaseName;
      }

      onAddIngredientCost(baseIngredientNameForCost, recipe?.id || null, ingredientName, baseIngredientIdForCost);
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      const bottleNames = [];
      const actionShots = [
        'bartender hands holding the glass', 'ice being poured into the glass', 'liquid being poured from a jigger',
        'drink being poured from a shaker', 'spirit being poured from the bottle', 'garnish being added with tweezers',
        'flames being torched over the cocktail', 'spray of citrus oils over the drink', 'hand reaching for the glass',
        'cocktail shaker in motion with condensation', 'stirring with a bar spoon in slow motion', 'smoke cascading around the glass',
        'cocktail on a tray being carried', 'two glasses clinking together in a toast', 'condensation dripping down the glass',
        'overhead shot with ingredients scattered around', 'close-up of bubbles rising in the drink', 'dramatic side lighting with shadows',
        '','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','',''
      ];
      const randomAction = actionShots[Math.floor(Math.random() * actionShots.length)];

      let prompt = currentRecipe.custom_image_prompt || 
                   `A stunning, professional cocktail photograph of a '${currentRecipe.name}' with a sophisticated background.`;

      if (currentRecipe.description) prompt += ` It features: ${currentRecipe.description}.`;
      if (currentRecipe.base_spirit) prompt += ` Base spirit: ${currentRecipe.base_spirit}.`;
      if (currentRecipe.garnish) prompt += ` Garnished with: ${currentRecipe.garnish}.`;
      if (currentRecipe.glassware) prompt += ` Served in a ${currentRecipe.glassware}.`;
      if (randomAction) prompt += ` Dynamic action: ${randomAction}.`;
      if (currentRecipe.venue_style) {
        const venueDescriptions = {
          'sports bar': 'American sports bar with flat screen TVs showing games, beer taps, and worn wood bar top. No tiki elements, no tropical decor, no torches.',
          'tiki bar': 'Polynesian tiki bar with carved tiki masks, bamboo, tropical plants, thatched roof, tiki torches',
          'dive bar': 'gritty dive bar with dim lighting and worn furniture',
          'nightclub': 'modern nightclub with dramatic neon lighting and sleek surfaces',
          'speakeasy': '1920s prohibition-era speakeasy with vintage leather and dark wood',
          'rooftop bar': 'elegant rooftop bar with city skyline in background',
          'upscale cocktail bar': 'sophisticated cocktail lounge with marble and brass accents',
          'hotel lobby bar': 'luxurious five-star hotel lobby bar with elegant decor'
        };
        const venueDesc = venueDescriptions[currentRecipe.venue_style] || currentRecipe.venue_style;
        prompt += ` Setting: ${venueDesc}.`;
      }
      if (currentRecipe.tags && currentRecipe.tags.length > 0) prompt += ` Character/Mood: ${currentRecipe.tags.join(', ')}.`;
      if (bottleNames.length > 0) {
        prompt += ` IMPORTANT: Feature the ${bottleNames.join(' and ')} bottle${bottleNames.length > 1 ? 's' : ''} prominently in the background or on the bar.`;
      }
      prompt += ` Style: ${currentRecipe.category}.`;
      prompt += ` Photorealistic, high detail, studio lighting, landscape orientation.`;

      const referenceImages = [];

      try {
        const user = await base44.auth.me();
        const userSettings = await base44.entities.AppSetting.filter({ user_id: user.id });
        if (userSettings && userSettings.length > 0 && userSettings[0].glassware_reference_images) {
          userSettings[0].glassware_reference_images.forEach(ref => {
            if (ref.url) referenceImages.push(ref.url);
          });
        }
      } catch (e) {
        console.warn("Could not load glassware references:", e);
      }

      const bottleIngredients = currentRecipe.ingredients?.filter(
        ing => ing.use_bottle_image_as_reference && ing.ingredient_id
      ) || [];

      for (const bottleIngredient of bottleIngredients) {
        const matchedIng = findMatchingIngredient(null, allIngredients, bottleIngredient.ingredient_id);

        if (matchedIng && matchedIng.bottle_image_url && matchedIng.bottle_image_url.trim()) {
          console.log(`✓ Adding bottle image for ${matchedIng.name}:`, matchedIng.bottle_image_url);
          referenceImages.push(matchedIng.bottle_image_url);
          bottleNames.push(matchedIng.name);
        } else if (matchedIng) {
          console.warn(`⚠ Ingredient "${matchedIng.name}" (ID: ${matchedIng.id}) matched but has no bottle_image_url`);
        } else {
          console.warn(`⚠ No ingredient match found for ID: "${bottleIngredient.ingredient_id}"`);
        }
      }

      console.log(`Total reference images for generation: ${referenceImages.length}`, referenceImages);

      const response = await base44.integrations.Core.GenerateImage({ 
        prompt,
        existing_image_urls: referenceImages.length > 0 ? referenceImages : undefined
      });

      if (response.url) {
        const updatedRecipe = {
          ...currentRecipe,
          image_url: response.url,
          image_generation_prompt: prompt
        };
        setCurrentRecipe(updatedRecipe);
        if (onRecipeChange) {
          onRecipeChange(updatedRecipe);
        }
        toast.success("Image generated successfully!");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Error generating image. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      if (response.file_url) {
        handleInputChange('image_url', response.file_url);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAddAliasAndSelect = async (index, suggestion, e) => {
    e.stopPropagation();
    const currentInputText = currentRecipe.ingredients[index].ingredient_name;

    if (!currentInputText) return;

    try {
      const ingredient = suggestion.base_ingredient_obj;
      const currentAliases = ingredient.aliases || [];

      if (!currentAliases.some(a => a.toLowerCase() === currentInputText.toLowerCase()) && 
          ingredient.name.toLowerCase() !== currentInputText.toLowerCase()) {

          const updatedAliases = [...currentAliases, currentInputText];
          await base44.entities.Ingredient.update(ingredient.id, { aliases: updatedAliases });
          
          if (ingredient.aliases) {
             ingredient.aliases.push(currentInputText);
          } else {
             ingredient.aliases = [currentInputText];
          }

          toast.success(`Added "${currentInputText}" as alias for ${ingredient.name}`);
      }

      handleIngredientSelect(index, suggestion);

      setJustSelected(prev => ({ ...prev, [index]: true }));

      setShowSuggestions(prev => ({
        ...prev,
        [index]: false
      }));
    } catch (error) {
      console.error("Failed to add alias:", error);
      toast.error("Failed to add alias");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div className="grid md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              {actualIsSubRecipe ? 'Sub-Recipe Name' : 'Recipe Name'}
            </label>
            <Input id="name" value={currentRecipe.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder={actualIsSubRecipe ? "e.g., Raspberry Simple Syrup" : "e.g., Classic Martini"} required />
          </div>
        {!actualIsSubRecipe && (
          <>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              {isAddingCustomCategory || (currentRecipe.category && !availableCategories.includes(currentRecipe.category)) ? (
                <div className="flex gap-2">
                  <Input 
                    value={currentRecipe.category} 
                    onChange={(e) => handleInputChange('category', e.target.value)} 
                    placeholder="Enter custom category name"
                    className="flex-1"
                    autoFocus
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={async () => {
                      if (currentRecipe.category && currentRecipe.category.trim()) {
                        try {
                          await base44.entities.RecipeCategory.create({ name: currentRecipe.category.trim() });
                          setAvailableCategories(prev => [...new Set([...prev, currentRecipe.category.trim()])]);
                          toast.success("Custom category saved!");
                        } catch (error) {
                          console.error("Failed to save category:", error);
                          toast.error("Failed to save category");
                        }
                      }
                      setIsAddingCustomCategory(false);
                    }}
                    className="px-3"
                    disabled={!currentRecipe.category || !currentRecipe.category.trim()}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      handleInputChange('category', 'classic');
                      setIsAddingCustomCategory(false);
                    }}
                    className="px-3"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Select 
                  value={currentRecipe.category || 'classic'} 
                  onValueChange={(value) => {
                    if (value === '__custom__') {
                      setIsAddingCustomCategory(true);
                      handleInputChange('category', '');
                    } else {
                      handleInputChange('category', value);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">+ Add Custom Category</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label htmlFor="base_spirit" className="block text-sm font-medium text-gray-700 mb-1">Base Spirit</label>
              <Select value={currentRecipe.base_spirit} onValueChange={(value) => handleInputChange('base_spirit', value)}>
                <SelectTrigger><SelectValue placeholder="Select base spirit" /></SelectTrigger>
                <SelectContent>
                  {spiritStyles.map(spirit => (
                    <SelectItem key={spirit} value={spirit}>{spirit.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {actualIsSubRecipe && (
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            {isAddingCustomCategory || (currentRecipe.category && !ingredientCategories.includes(currentRecipe.category) && !cocktailCategories.includes(currentRecipe.category)) ? (
              <div className="flex gap-2">
                <Input 
                  value={currentRecipe.category} 
                  onChange={(e) => handleInputChange('category', e.target.value)} 
                  placeholder="Enter custom category name"
                  className="flex-1"
                  autoFocus
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={async () => {
                    if (currentRecipe.category && currentRecipe.category.trim()) {
                      try {
                        await base44.entities.RecipeCategory.create({ name: currentRecipe.category.trim() });
                        setAvailableCategories(prev => [...new Set([...prev, currentRecipe.category.trim()])]);
                        toast.success("Custom category saved!");
                      } catch (error) {
                        console.error("Failed to save category:", error);
                        toast.error("Failed to save category");
                      }
                    }
                    setIsAddingCustomCategory(false);
                  }}
                  className="px-3"
                  disabled={!currentRecipe.category || !currentRecipe.category.trim()}
                >
                  <Save className="w-4 h-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    handleInputChange('category', 'syrup');
                    setIsAddingCustomCategory(false);
                  }}
                  className="px-3"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Select 
                value={currentRecipe.category} 
                onValueChange={(value) => {
                  if (value === '__custom__') {
                    setIsAddingCustomCategory(true);
                    handleInputChange('category', '');
                  } else {
                    handleInputChange('category', value);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {ingredientCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Add Custom Category</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        {currentRecipe.category?.toLowerCase() === 'clarification' && actualIsSubRecipe && (
          <div>
            <label htmlFor="clarification_method" className="block text-sm font-medium text-gray-700 mb-1">Technique</label>
            <Select value={localClarificationMethod} onValueChange={handleClarificationMethodChange}>
                <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="Select clarification method" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="agar">Agar Clarification</SelectItem>
                    <SelectItem value="milk_wash">Milk Wash</SelectItem>
                </SelectContent>
            </Select>
          </div>
        )}

        {!actualIsSubRecipe && (
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <Select value={currentRecipe.difficulty} onValueChange={(value) => handleInputChange('difficulty', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {difficulties.map(diff => (
                  <SelectItem key={diff} value={diff}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <AnimatePresence>
        {localClarificationMethod !== 'none' && currentRecipe.category?.toLowerCase() === 'clarification' && actualIsSubRecipe && (
          <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
          >
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-4">
                      <FlaskConical className="w-6 h-6 text-blue-600 mt-1" />
                      <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 mb-1">
                              {localClarificationMethod === 'agar' ? 'Agar Clarification Calculator' : 'Milk Wash Calculator'}
                          </h4>
                          {(() => {
                              const totalVolume = calculateTotalVolumeMl ? calculateTotalVolumeMl() : 0;
                              const agentName = localClarificationMethod === 'agar' ? 'agar' : 'milk';
                              const existingAgent = currentRecipe.ingredients?.find(ing => 
                                  ing.ingredient_name.toLowerCase().includes(agentName)
                              );
                              const existingAgentAmount = existingAgent 
                                  ? convertToMl(parseFloat(existingAgent.amount), existingAgent.unit, existingAgent.ingredient_name, allIngredients)
                                  : 0;
                              
                              const ozCount = currentRecipe.ingredients.filter(ing => ing.unit === 'oz').length;
                              const mlCount = currentRecipe.ingredients.filter(ing => ing.unit === 'ml').length;
                              const useOz = ozCount > mlCount;
                              
                              const displayVolume = useOz ? (totalVolume / 29.5735).toFixed(1) : totalVolume.toFixed(0);
                              const displayVolumeUnit = useOz ? 'oz' : 'ml';
                              
                              const recommendedAmountMl = localClarificationMethod === 'agar' 
                                  ? totalVolume * 0.002 
                                  : totalVolume * 0.25;
                              const recommendedAmount = useOz && localClarificationMethod !== 'agar' 
                                  ? (recommendedAmountMl / 29.5735).toFixed(1) 
                                  : recommendedAmountMl.toFixed(localClarificationMethod === 'agar' ? 1 : 0);
                              const recommendedUnit = localClarificationMethod === 'agar' ? 'g' : displayVolumeUnit;

                              return (
                                  <>
                                      <p className="text-sm text-blue-700 mb-3">
                                          Current Batch Volume: <span className="font-bold">{displayVolume} {displayVolumeUnit}</span>
                                          <br/>
                                          {localClarificationMethod === 'agar' 
                                              ? `Recommended: ${recommendedAmount}g Agar-Agar (0.2% by weight)` 
                                              : `Recommended: ${recommendedAmount}${recommendedUnit} Whole Milk (25% by volume)`}
                                          {existingAgent && (
                                              <>
                                                  <br/>
                                                  <span className="text-green-700 font-medium">
                                                      ✓ {agentName.charAt(0).toUpperCase() + agentName.slice(1)} already in recipe: {existingAgent.amount} {existingAgent.unit}
                                                  </span>
                                              </>
                                          )}
                                      </p>
                                      {!existingAgent && (
                                          <Button 
                                              type="button"
                                              size="sm" 
                                              onClick={handleAddClarificationAgent}
                                              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                          >
                                              <Plus className="w-4 h-4 mr-2" />
                                              Add {localClarificationMethod === 'agar' ? 'Agar' : 'Milk'} to Ingredients
                                          </Button>
                                      )}
                                  </>
                              );
                          })()}
                      </div>
                  </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <Textarea id="description" value={currentRecipe.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder={actualIsSubRecipe ? "Describe this ingredient and its flavor profile..." : "Describe the cocktail..."} className="h-24" />
      </div>

      {cordialArchitect && (
        <div className="my-6">
          {cordialArchitect}
        </div>
      )}

      {actualIsSubRecipe && onToggleAdvancedTools && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleAdvancedTools}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            {showAdvancedTools ? "Hide Advanced Tools" : "Show Advanced Tools"}
          </Button>
        </div>
      )}

      {actualIsSubRecipe && showAdvancedTools && activeCalculator && handleApplyCalculator && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-4">
                <FlaskConical className="w-6 h-6 text-blue-600 mt-1" />
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-blue-900 capitalize text-lg">{activeCalculator.replace('_', ' ')} Calculator</h4>
                      {['agar', 'milk_wash', 'fat_wash', 'dilution', 'cordial'].includes(activeCalculator) && calculateTotalVolumeMl && (
                        <p className="text-sm text-blue-700">
                          Current Volume: <span className="font-bold">{calculateTotalVolumeMl().toFixed(0)} ml</span>
                          {activeCalculator === 'cordial' && currentRecipe.abv > 0 && <span> @ <span className="font-bold">{currentRecipe.abv.toFixed(1)}% ABV</span></span>}
                        </p>
                      )}
                    </div>
                    {onToggleAdvancedTools && (
                      <Button variant="ghost" size="icon" onClick={onToggleAdvancedTools} className="h-6 w-6 text-blue-400 hover:text-blue-700 hover:bg-blue-100">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Configurable Variables */}
                  {['agar', 'milk_wash', 'fat_wash', 'dilution', 'saline'].includes(activeCalculator) && variableConfig && setVariableConfig && (
                    <div className="mb-4 flex items-center gap-3 text-sm text-blue-800 bg-blue-100/50 p-2 rounded w-fit">
                      <Settings2 className="w-4 h-4" />
                      <span>
                        {activeCalculator === 'agar' && "Agar Concentration:"}
                        {activeCalculator === 'milk_wash' && "Milk Ratio:"}
                        {activeCalculator === 'fat_wash' && "Fat Ratio:"}
                        {activeCalculator === 'dilution' && "Dilution Percentage:"}
                        {activeCalculator === 'saline' && "Saline Concentration:"}
                      </span>
                      <Input 
                        type="number" 
                        className="w-16 h-7 bg-white text-center border-blue-300"
                        value={
                          activeCalculator === 'agar' ? variableConfig.agarPerc :
                          activeCalculator === 'milk_wash' ? variableConfig.milkPerc :
                          activeCalculator === 'fat_wash' ? variableConfig.fatPerc :
                          activeCalculator === 'dilution' ? variableConfig.dilutionPerc :
                          variableConfig.salinePerc
                        }
                        onChange={(e) => setVariableConfig(prev => ({
                          ...prev,
                          [activeCalculator === 'agar' ? 'agarPerc' : 
                           activeCalculator === 'milk_wash' ? 'milkPerc' :
                           activeCalculator === 'fat_wash' ? 'fatPerc' :
                           activeCalculator === 'dilution' ? 'dilutionPerc' :
                           'salinePerc']: e.target.value
                        }))}
                      />
                      <span>%</span>
                    </div>
                  )}

                  {/* Calculation UI based on activeCalculator */}
                  {['agar', 'milk_wash', 'fat_wash'].includes(activeCalculator) && (
                    <Button size="sm" onClick={handleApplyCalculator} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />Add Calculated Ingredients
                    </Button>
                  )}

                  {activeCalculator === 'cordial' && setCordialAction && setCordialTargetAbv && (
                    <div className="space-y-4">
                      <div className="flex gap-6">
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs text-blue-800 font-semibold">Goal</Label>
                          <RadioGroup value={cordialAction} onValueChange={setCordialAction} className="flex gap-2">
                            <div className="flex items-center space-x-2 border border-blue-200 rounded px-3 py-1 bg-white">
                              <RadioGroupItem value="fortify_base" id="r1" />
                              <Label htmlFor="r1" className="text-sm font-normal text-blue-800 cursor-pointer">Fortify Base</Label>
                            </div>
                            <div className="flex items-center space-x-2 border border-blue-200 rounded px-3 py-1 bg-white">
                              <RadioGroupItem value="dilute_spirit" id="r2" />
                              <Label htmlFor="r2" className="text-sm font-normal text-blue-800 cursor-pointer">Dilute Spirit</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        {cordialAction === 'fortify_base' && setUseRecipeSpirit && recipeSpirits && (
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs text-blue-800 font-semibold">Spirit Source</Label>
                            <div className="flex items-center gap-2">
                              <Switch id="use-recipe-spirit" checked={useRecipeSpirit} onCheckedChange={setUseRecipeSpirit} disabled={recipeSpirits.length === 0} />
                              <Label htmlFor="use-recipe-spirit" className="text-sm font-normal text-blue-800 cursor-pointer">
                                {useRecipeSpirit ? "Use Recipe Ingredient" : "Manual ABV"}
                              </Label>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white/50 p-3 rounded-md border border-blue-100">
                        <div>
                          <Label className="text-xs text-blue-800 mb-1 block">Target ABV (%)</Label>
                          <Input type="number" value={cordialTargetAbv} onChange={(e) => setCordialTargetAbv(e.target.value)} className="h-9 bg-white border-blue-300" placeholder="e.g. 20" />
                        </div>
                        {cordialAction === 'fortify_base' && (
                          <div>
                            <Label className="text-xs text-blue-800 mb-1 block">Spirit Strength</Label>
                            {useRecipeSpirit && recipeSpirits ? (
                              <Select value={selectedSpiritId} onValueChange={setSelectedSpiritId}>
                                <SelectTrigger className="h-9 bg-white border-blue-300"><SelectValue placeholder="Select..." /></SelectTrigger>
                                <SelectContent>
                                  {recipeSpirits.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.abv}%)</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="relative">
                                <Input type="number" value={manualSpiritAbv} onChange={(e) => setManualSpiritAbv(e.target.value)} className="h-9 bg-white border-blue-300 pr-8" placeholder="e.g. 40" />
                                <span className="absolute right-3 top-2.5 text-xs text-gray-400">%</span>
                              </div>
                            )}
                          </div>
                        )}
                        {cordialAction === 'dilute_spirit' && calculatorInput !== undefined && setCalculatorInput && (
                          <div className="md:col-span-2">
                            <Label className="text-xs text-blue-800 mb-1 block">Mixer Name</Label>
                            <Input type="text" value={calculatorInput} onChange={(e) => setCalculatorInput(e.target.value)} className="h-9 bg-white border-blue-300" placeholder="e.g. Simple Syrup" />
                          </div>
                        )}
                        <div className={cordialAction === 'fortify_base' ? "md:col-span-2" : "md:col-span-1"}>
                          <Button size="sm" onClick={handleApplyCalculator} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9">
                            <Plus className="w-4 h-4 mr-2" />Add Calculated Ingredients
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {['super_juice', 'syrup', 'acid_adjust', 'saline', 'dilution'].includes(activeCalculator) && (
                    <>
                      <div className="flex gap-3 mb-3">
                        {activeCalculator === 'super_juice' && calculatorSubType !== undefined && setCalculatorSubType && (
                          <Select value={calculatorSubType} onValueChange={setCalculatorSubType}>
                            <SelectTrigger className="w-48 h-9 bg-white border-blue-300"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="lime">Lime</SelectItem><SelectItem value="lemon">Lemon</SelectItem></SelectContent>
                          </Select>
                        )}
                        {activeCalculator === 'syrup' && calculatorSubType !== undefined && setCalculatorSubType && (
                          <Select value={calculatorSubType} onValueChange={setCalculatorSubType}>
                            <SelectTrigger className="w-48 h-9 bg-white border-blue-300"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="simple">Simple (1:1)</SelectItem><SelectItem value="rich">Rich (2:1)</SelectItem></SelectContent>
                          </Select>
                        )}
                        {activeCalculator === 'acid_adjust' && calculatorSubType !== undefined && setCalculatorSubType && (
                          <Select value={calculatorSubType} onValueChange={setCalculatorSubType}>
                            <SelectTrigger className="w-48 h-9 bg-white border-blue-300"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="orange_lime">Orange to Lime</SelectItem><SelectItem value="orange_lemon">Orange to Lemon</SelectItem><SelectItem value="gf_lime">Grapefruit to Lime</SelectItem></SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="w-48">
                          <Label className="text-xs text-blue-800 mb-1 block">
                            {activeCalculator === 'super_juice' && "Peel Weight (g)"}
                            {activeCalculator === 'syrup' && "Sugar Weight (g)"}
                            {activeCalculator === 'acid_adjust' && "Juice Volume (ml)"}
                            {activeCalculator === 'saline' && "Water Volume (ml)"}
                            {activeCalculator === 'dilution' && calculateTotalVolumeMl && `Current Vol: ${calculateTotalVolumeMl().toFixed(0)} ml`}
                          </Label>
                          {activeCalculator !== 'dilution' && calculatorInput !== undefined && setCalculatorInput && (
                            <Input type="number" value={calculatorInput} onChange={(e) => setCalculatorInput(e.target.value)} className="h-9 bg-white border-blue-300" />
                          )}
                        </div>
                        <Button size="sm" onClick={handleApplyCalculator} className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                          <Plus className="w-4 h-4 mr-2" />Add Calculated Ingredients
                        </Button>
                      </div>
                    </>
                  )}
                  </div>
                  </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-gray-700">
            Ingredients
            <span className="ml-2 text-xs text-gray-500">(Paste full recipe list here)</span>
          </label>
          <div className="flex gap-2">
            {actualIsSubRecipe && (
              <>
                <Button type="button" size="sm" variant="ghost" onClick={handleToggleUnits} className="text-xs px-2 h-7 text-gray-500 hover:text-gray-700">
                  oz ⇄ ml
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={handleRoundToHalf} className="text-xs px-2 h-7 text-gray-500 hover:text-gray-700">
                  ½ Round
                </Button>
              </>
            )}
            <Button type="button" size="sm" variant="outline" onClick={handleSortByCost}>
              <SortDesc className="w-4 h-4 mr-2" />
              Sort by Cost
            </Button>
            <Button type="button" size="sm" onClick={addIngredient} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Ingredient
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-2 pb-2 border-b">
            <div className="col-span-4">Ingredient</div>
            <div className="col-span-3">Amount</div>
            <div className="col-span-3">Unit</div>
            <div className="col-span-2 text-right">Cost</div>
          </div>
          {currentRecipe.ingredients.map((ingredient, index) => {
            const costStatus = getIngredientCostStatus(ingredient.ingredient_name);
            
            const ingredientForCosting = {
              ingredient_id: ingredient.ingredient_id,
              prep_action_id: ingredient.prep_action_id,
              amount: parseFloat(ingredient.amount) || 0,
              unit: ingredient.unit,
              ingredient_name: ingredient.ingredient_name
            };
            const { cost: ingredientCost, status: costingStatus } = calculateIngredientCost(ingredientForCosting, allIngredients, variantsLookup, "auto", allRecipes);
            
            const matchedIngredient = findMatchingIngredient(null, allIngredients, ingredient.ingredient_id);
            const isIngredientSubRecipe = matchedIngredient && matchedIngredient.ingredient_type === 'sub_recipe';

            let needsCostAttention = false;
            if (!ingredient.ingredient_id || !matchedIngredient) {
              needsCostAttention = true;
            } else if (ingredient.prep_action_id && !matchedIngredient.prep_actions?.some(p => p.id === ingredient.prep_action_id)) {
              needsCostAttention = true;
            } else if (costingStatus === 'no_cost' && ingredientCost <= 0) {
              needsCostAttention = true;
            }
            
            return (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-grow grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <div className="flex items-center gap-1 relative">
                      <div className="flex-1 relative">
                        <Input 
                          placeholder="Ingredient Name" 
                          value={ingredient.ingredient_name} 
                          onChange={(e) => handleIngredientChange(index, 'ingredient_name', e.target.value)} 
                          onBlur={() => handleIngredientBlur(index)}
                          autoComplete="off"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault(); 
                              if (showSuggestions[index] && ingredientSuggestions[index]?.length > 0) {
                                handleIngredientSelect(index, ingredientSuggestions[index][0]);
                              } else {
                                e.currentTarget.blur();
                              }
                            }
                          }}
                          onFocus={() => {
                            if (ingredient.ingredient_name.trim()) {
                              const typedInput = ingredient.ingredient_name.trim().toLowerCase();
                              const normalizedTypedInput = typedInput.replace(/[^a-z0-9]/g, '');
                              const newFilteredSuggestions = [];

                              allIngredients.forEach(ing => {
                                const ingredientNameLower = ing.name.toLowerCase();
                                const normalizedIngredientName = ingredientNameLower.replace(/[^a-z0-9]/g, '');

                                const ingredientMatches = normalizedIngredientName.includes(normalizedTypedInput) || ingredientNameLower.includes(typedInput);

                                let baseScore = 0;
                                if (ingredientMatches) {
                                  const isExactMatch = normalizedIngredientName === normalizedTypedInput || ingredientNameLower === typedInput;
                                  const startsWithMatch = normalizedIngredientName.startsWith(normalizedTypedInput) || ingredientNameLower.startsWith(typedInput);
                                  const isNonAlcoholic = !ing.abv || ing.abv === 0;
                                  baseScore = (isExactMatch ? 1000 : 0) + (startsWithMatch ? 100 : 0) + (isNonAlcoholic ? 10 : 0);

                                  newFilteredSuggestions.push({
                                    type: 'ingredient',
                                    display_name: ing.name,
                                    ingredient_id: ing.id,
                                    base_ingredient_obj: ing,
                                    score: baseScore
                                  });
                                }

                                if (ingredientMatches && ing.prep_actions && Array.isArray(ing.prep_actions)) {
                                  ing.prep_actions.forEach(prep => {
                                    if (prep.name && prep.id) {
                                      const prepDisplayName = `${ing.name}, ${prep.name}`;
                                      const prepNameLower = prep.name.toLowerCase();
                                      const prepMatchesInput = prepNameLower.includes(typedInput);
                                      const prepScore = baseScore + (prepMatchesInput ? 50 : 0) + 5;
                                      
                                      newFilteredSuggestions.push({
                                        type: 'prep_action',
                                        display_name: prepDisplayName,
                                        ingredient_id: ing.id,
                                        prep_action_id: prep.id,
                                        base_ingredient_obj: ing,
                                        prep_action_obj: prep,
                                        score: prepScore
                                      });
                                    }
                                  });
                                }
                              });
                              
                              newFilteredSuggestions.sort((a, b) => {
                                if (b.score !== a.score) return b.score - a.score;
                                if (a.type === 'ingredient' && b.type === 'prep_action') return -1;
                                if (a.type === 'prep_action' && b.type === 'ingredient') return 1;
                                return a.display_name.localeCompare(b.display_name);
                              });
                              
                              const uniqueSuggestions = Array.from(new Map(newFilteredSuggestions.map(item => [item.ingredient_id + (item.prep_action_id || ''), item])).values());

                              setIngredientSuggestions(prev => ({
                                ...prev,
                                [index]: uniqueSuggestions.slice(0, 50)
                              }));
                              setShowSuggestions(prev => ({
                                ...prev,
                                [index]: uniqueSuggestions.length > 0
                              }));
                            }
                          }}
                          className={`w-full ${needsCostAttention ? 'border-yellow-300 bg-yellow-50' : ''}`} 
                        />
                        
                        {showSuggestions[index] && ingredientSuggestions[index]?.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {(() => {
                              const suggestions = ingredientSuggestions[index];
                              const grouped = [];
                              
                              suggestions.forEach(suggestion => {
                                if (suggestion.type === 'ingredient') {
                                  grouped.push(suggestion);
                                  const preps = suggestions.filter(s => 
                                    s.type === 'prep_action' && 
                                    s.ingredient_id === suggestion.ingredient_id
                                  );
                                  grouped.push(...preps);
                                }
                              });
                              
                              const seen = new Set();
                              const uniqueGrouped = grouped.filter(item => {
                                const key = item.ingredient_id + (item.prep_action_id || '');
                                if (seen.has(key)) return false;
                                seen.add(key);
                                return true;
                              });
                              
                              return uniqueGrouped.map((suggestion) => (
                                <div
                                  key={suggestion.ingredient_id + (suggestion.prep_action_id || '')}
                                  className={`px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 
                                    ${suggestion.type === 'prep_action' ? 'pl-8 bg-gray-50/50' : ''}`}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleIngredientSelect(index, suggestion)}
                                >
                                  <div className={`font-medium ${suggestion.type === 'prep_action' ? 'text-gray-700 text-xs' : 'text-gray-900 text-sm'}`}>
                                    {suggestion.type === 'prep_action' ? `↳ ${suggestion.prep_action_obj?.name}` : suggestion.display_name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {suggestion.base_ingredient_obj.category} • {suggestion.base_ingredient_obj.supplier || 'No supplier'}
                                    {suggestion.base_ingredient_obj.cost_per_unit > 0 && (() => {
                                      let displayUnit = suggestion.base_ingredient_obj.unit || 'oz';
                                      if (suggestion.type === 'prep_action' && suggestion.prep_action_obj?.yield_unit) {
                                        displayUnit = suggestion.prep_action_obj.yield_unit;
                                      }
                                      return (
                                        <span className="ml-2 text-blue-600">
                                          ${formatCurrency(suggestion.base_ingredient_obj.cost_per_unit)}/{displayUnit}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                      
                      {needsCostAttention && onAddIngredientCost && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="flex-shrink-0 text-yellow-600 border-yellow-300 hover:bg-yellow-50 px-2 ml-1" title="Ingredient not found - Click to map or create">
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                              <IngredientMappingSearch 
                                  currentName={ingredient.ingredient_name}
                                  allIngredients={allIngredients}
                                  onMap={(suggestion) => {
                                    const currentInputText = ingredient.ingredient_name;
                                    const matchedIngredientObj = suggestion.base_ingredient_obj;

                                    const shouldCreateAlias = currentInputText && 
                                      currentInputText.toLowerCase() !== matchedIngredientObj.name.toLowerCase() &&
                                      !matchedIngredientObj.aliases?.some(a => a.toLowerCase() === currentInputText.toLowerCase());
                                    
                                    if (shouldCreateAlias) {
                                      handleAddAliasAndSelect(index, suggestion, { stopPropagation: () => {} });
                                    } else {
                                      handleIngredientSelect(index, suggestion);
                                    }
                                  }}
                                  onCreate={() => handleAddIngredientCost(ingredient.ingredient_name)}
                              />
                          </PopoverContent>
                        </Popover>
                      )}
                      {isIngredientSubRecipe && matchedIngredient?.sub_recipe_id && (() => {
                          const returnUrl = window.location.pathname + window.location.search;
                          const subRecipeUrl = createPageUrl(`CreateSubRecipe?id=${matchedIngredient.sub_recipe_id}&returnTo=${encodeURIComponent(returnUrl)}`);
                          return (
                            <Link to={subRecipeUrl}>
                              <Button type="button" variant="ghost" size="sm" className="flex-shrink-0 text-blue-600 hover:bg-blue-50 px-2 ml-1" title={`Edit ${matchedIngredient.name}`}>
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                          );
                      })()}
                    </div>
                  </div>
                  <div className="col-span-3"><Input type="number" step="0.25" placeholder="Amount" value={ingredient.amount} onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)} disabled={ingredient.unit === 'top'} /></div>
                  <div className="col-span-3"><UnitAutocomplete value={ingredient.unit} onValueChange={(value) => handleIngredientChange(index, 'unit', value)} placeholder="Unit" /></div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-end">
                      <div className="text-right text-sm font-medium text-blue-700">${formatCurrency(ingredientCost)}</div>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center">
                  <div className="flex flex-col">
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveIngredient(index, 'up')} disabled={index === 0} className="h-5 w-5"><ArrowUp className="w-3 h-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveIngredient(index, 'down')} disabled={index === currentRecipe.ingredients.length - 1} className="h-5 w-5"><ArrowDown className="w-3 h-3" /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(index)} disabled={currentRecipe.ingredients.length === 1} className="ml-1"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-gray-700">{actualIsSubRecipe ? 'Preparation Steps' : 'Instructions'}</label>
          <div className="flex gap-2">
            {!actualIsSubRecipe && (
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                onClick={async () => {
                  if (!currentRecipe.ingredients || currentRecipe.ingredients.length === 0) {
                    toast.error("Add ingredients first");
                    return;
                  }
                  
                  const ingredientList = currentRecipe.ingredients
                    .map(ing => `${ing.amount} ${ing.unit} ${ing.ingredient_name}`)
                    .join(', ');

                  const prompt = `You are a professional mixologist. Create concise step-by-step instructions for making this cocktail:

                  Recipe: ${currentRecipe.name || 'Untitled Cocktail'}
                  ${currentRecipe.description ? `Description: ${currentRecipe.description}` : ''}

                  Ingredients: ${ingredientList}

                  ${currentRecipe.glassware ? `Glassware: ${currentRecipe.glassware}` : ''}
                  ${currentRecipe.garnish ? `Garnish: ${currentRecipe.garnish}` : ''}

                  Provide clear, concise instructions. Consolidate ingredients into single steps where possible. Return ONLY the numbered steps as an array, nothing else.`;

                  try {
                    toast.loading("Generating instructions...");
                    const response = await base44.integrations.Core.InvokeLLM({
                      prompt,
                      response_json_schema: {
                        type: "object",
                        properties: {
                          steps: {
                            type: "array",
                            items: { type: "string" }
                          }
                        }
                      }
                    });
                    
                    if (response.steps && response.steps.length > 0) {
                      const updatedRecipe = { ...currentRecipe, instructions: response.steps };
                      setCurrentRecipe(updatedRecipe);
                      if (onRecipeChange) onRecipeChange(updatedRecipe);
                      toast.success("Instructions generated!");
                    }
                  } catch (error) {
                    console.error("Error generating instructions:", error);
                    toast.error("Failed to generate instructions");
                  }
                }}
                className="border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Generate (AI)
              </Button>
            )}
            <Button type="button" size="sm" onClick={addInstruction} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Add Step</Button>
          </div>
        </div>
        <div className="space-y-3">
          {currentRecipe.instructions.map((instruction, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-700 mt-1">{index + 1}</div>
              <Textarea placeholder={`Step ${index + 1} instructions...`} value={instruction} onChange={(e) => handleInstructionChange(index, e.target.value)} className="flex-1 min-h-[60px]" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeInstruction(index)} disabled={currentRecipe.instructions.length === 1} className="mt-1"><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          ))}
        </div>
      </div>

      {!actualIsSubRecipe && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
          <h3 className="text-md font-semibold text-gray-800">Presentation</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label htmlFor="glassware" className="block text-sm font-medium text-gray-700 mb-1">Glassware</label><Input id="glassware" value={currentRecipe.glassware || ''} onChange={(e) => handleInputChange('glassware', e.target.value)} placeholder="e.g., Martini glass, Rocks glass" /></div>
            <div><label htmlFor="garnish" className="block text-sm font-medium text-gray-700 mb-1">Garnish</label><Input id="garnish" value={currentRecipe.garnish || ''} onChange={(e) => handleInputChange('garnish', e.target.value)} placeholder="e.g., Lemon twist, Cherry" /></div>
          </div>
        </div>
      )}

      {actualIsSubRecipe && (
        <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-semibold text-blue-800">Recipe Yield</h3>
            <div className="flex items-center space-x-2">
                <Switch
                    id="auto-calculate-yield"
                    checked={autoCalculateYield}
                    onCheckedChange={setAutoCalculateYield}
                />
                <Label htmlFor="auto-calculate-yield" className="text-sm font-medium text-blue-700 cursor-pointer">Auto-Calculate</Label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="yield_amount" className="block text-sm font-medium text-gray-700 mb-1">Total Yield Amount</label>
              <Input 
                id="yield_amount" 
                type="number" 
                step="0.01" 
                value={currentRecipe.yield_amount || ''} 
                onChange={(e) => handleInputChange('yield_amount', parseFloat(e.target.value) || 0)} 
                placeholder="e.g., 750" 
                required 
                disabled={autoCalculateYield} 
              />
            </div>
            <div>
              <label htmlFor="yield_unit" className="block text-sm font-medium text-gray-700 mb-1">Yield Unit</label>
              <Select 
                value={currentRecipe.yield_unit || 'ml'} 
                onValueChange={(value) => handleYieldUnitChange(value)}
                disabled={autoCalculateYield}
              >
                <SelectTrigger><SelectValue placeholder="Select unit"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="oz">oz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-blue-700">Define how much this recipe produces in total. This determines the ingredient's unit cost.</p>
        </div>
      )}

      {actualIsSubRecipe && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-gray-700">Batch Cocktail</h3>
            <div className="flex items-center space-x-2">
              <Switch 
                id="is_cocktail" 
                checked={currentRecipe.is_cocktail || false} 
                onCheckedChange={(checked) => handleInputChange('is_cocktail', checked)}
              />
              <Label htmlFor="is_cocktail" className="text-sm cursor-pointer text-gray-700 font-medium">
                Batch Cocktail
              </Label>
            </div>
          </div>

          {currentRecipe.is_cocktail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="serving_size" className="block text-sm font-medium text-gray-700 mb-1">Serving Size</label>
                  <Input 
                    id="serving_size" 
                    type="number" 
                    step="0.25" 
                    value={currentRecipe.serving_size || ''} 
                    onChange={(e) => handleInputChange('serving_size', parseFloat(e.target.value) || 0)} 
                    placeholder="e.g., 4" 
                  />
                </div>
                <div>
                  <label htmlFor="serving_unit" className="block text-sm font-medium text-gray-700 mb-1">Serving Unit</label>
                  <Select 
                    value={currentRecipe.serving_unit || 'oz'} 
                    onValueChange={(value) => handleInputChange('serving_unit', value)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select unit"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oz">oz</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <label htmlFor="glassware" className="block text-sm font-medium text-gray-700 mb-1">Glassware</label>
                  <Input 
                    id="glassware" 
                    value={currentRecipe.glassware || ''} 
                    onChange={(e) => handleInputChange('glassware', e.target.value)} 
                    placeholder="e.g., Martini glass, Rocks glass" 
                  />
                </div>
                <div>
                  <label htmlFor="garnish" className="block text-sm font-medium text-gray-700 mb-1">Garnish</label>
                  <Input 
                    id="garnish" 
                    value={currentRecipe.garnish || ''} 
                    onChange={(e) => handleInputChange('garnish', e.target.value)} 
                    placeholder="e.g., Lemon twist, Cherry" 
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {actualIsSubRecipe && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-semibold text-gray-700">Inventory Tracking</h3>
            <div className="flex items-center space-x-2">
              <Switch
                id="track-inventory"
                checked={currentRecipe.batch_settings?.track_batch_inventory || currentRecipe.batch_settings?.inventory_bottle?.enabled || false}
                onCheckedChange={(checked) => {
                  const updatedSettings = {
                    ...currentRecipe.batch_settings,
                    track_batch_inventory: checked,
                    inventory_bottle: {
                      ...(currentRecipe.batch_settings?.inventory_bottle || {}),
                      enabled: checked,
                      size_ml: currentRecipe.batch_settings?.inventory_bottle?.size_ml || 750
                    }
                  };
                  handleInputChange('batch_settings', updatedSettings);
                }}
              />
              <Label htmlFor="track-inventory" className="text-sm font-medium text-gray-700 cursor-pointer">
                Track in Inventory
              </Label>
            </div>
          </div>
          
          {(currentRecipe.batch_settings?.track_batch_inventory || currentRecipe.batch_settings?.inventory_bottle?.enabled) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-3 border-t"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Bottle Label</label>
                <Input
                  value={currentRecipe.batch_settings?.inventory_bottle?.label || currentRecipe.batch_settings?.default_bottle_label || ''}
                  onChange={(e) => {
                    const updatedSettings = {
                      ...currentRecipe.batch_settings,
                      default_bottle_label: e.target.value,
                      inventory_bottle: {
                        ...(currentRecipe.batch_settings?.inventory_bottle || {}),
                        label: e.target.value
                      }
                    };
                    handleInputChange('batch_settings', updatedSettings);
                  }}
                  placeholder="e.g., Batch Name or Date"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Neck Tape Colors (Max 3)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Red', value: '#ef4444' },
                    { name: 'Blue', value: '#3b82f6' },
                    { name: 'Green', value: '#22c55e' },
                    { name: 'Yellow', value: '#eab308' },
                    { name: 'Orange', value: '#f97316' },
                    { name: 'Purple', value: '#a855f7' },
                    { name: 'White', value: '#ffffff', border: true },
                    { name: 'Black', value: '#000000' }
                  ].map((color) => {
                    const selectedColors = currentRecipe.batch_settings?.inventory_bottle?.colors || currentRecipe.batch_settings?.default_bottle_colors || [];
                    const isSelected = selectedColors.includes(color.value);
                    
                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => {
                          let newColors;
                          if (isSelected) {
                            newColors = selectedColors.filter(c => c !== color.value);
                          } else {
                            if (selectedColors.length >= 3) {
                              toast.error("Maximum 3 colors allowed");
                              return;
                            }
                            newColors = [...selectedColors, color.value];
                          }
                          
                          const updatedSettings = {
                            ...currentRecipe.batch_settings,
                            default_bottle_colors: newColors,
                            inventory_bottle: {
                              ...(currentRecipe.batch_settings?.inventory_bottle || {}),
                              colors: newColors
                            }
                          };
                          handleInputChange('batch_settings', updatedSettings);
                        }}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          isSelected 
                            ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' 
                            : 'hover:scale-105'
                        }`}
                        style={{ 
                          backgroundColor: color.value,
                          borderColor: color.border ? '#e5e7eb' : 'transparent' 
                        }}
                        title={color.name}
                      />
                    );
                  })}
                </div>
                {(currentRecipe.batch_settings?.inventory_bottle?.colors?.length > 0 || currentRecipe.batch_settings?.default_bottle_colors?.length > 0) && (
                  <div className="mt-3 flex items-center gap-3 p-2 bg-white rounded border">
                    <span className="text-xs text-gray-500">Preview:</span>
                    <div className="relative w-8 h-12 bg-gray-200 rounded border border-gray-300">
                      <div className="absolute top-1 left-1/2 transform -translate-x-1/2 flex flex-col-reverse gap-[2px] w-5">
                        {(currentRecipe.batch_settings?.inventory_bottle?.colors || currentRecipe.batch_settings?.default_bottle_colors || []).map((c, i) => (
                          <div 
                            key={i} 
                            className="w-full h-1.5 shadow-sm border border-black/10" 
                            style={{ backgroundColor: c }} 
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedSettings = {
                          ...currentRecipe.batch_settings,
                          default_bottle_colors: [],
                          inventory_bottle: {
                            ...(currentRecipe.batch_settings?.inventory_bottle || {}),
                            colors: []
                          }
                        };
                        handleInputChange('batch_settings', updatedSettings);
                      }}
                      className="ml-auto text-xs text-red-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-600">
                These settings will be used when adding this sub-recipe to inventory from the prep drawer.
              </p>
            </motion.div>
          )}
        </div>
      )}

      {(!actualIsSubRecipe || currentRecipe.category !== 'syrup') && (
      <div className="flex justify-end mb-4">
          <div className="flex flex-col gap-3 p-3 border rounded-lg bg-gray-50 w-full max-w-[400px]">
            <div className="relative w-full aspect-square bg-gray-200 rounded-md overflow-hidden border border-gray-300 shadow-sm">
              {currentRecipe.image_url ? (
                <img 
                  key={currentRecipe.image_url}
                  src={currentRecipe.image_url} 
                  alt="Recipe preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full text-gray-400 gap-2">
                  <ImageIcon className="w-10 h-10" />
                  <span className="text-xs font-medium">No Image</span>
                </div>
              )}
              {currentRecipe.image_url && (
                <button
                  type="button"
                  onClick={() => handleInputChange('image_url', '')}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="flex-1 h-9 text-xs"
              >
                {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Generate
              </Button>

              <div className="relative flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploadingImage}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="h-9 text-xs w-full"
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                  Upload
                </Button>
              </div>
            </div>

            {!actualIsSubRecipe && (
              <div className="pt-3 border-t space-y-2">
                <Label className="text-xs font-semibold text-gray-700">Venue Style (Image Generation):</Label>
                <Select value={currentRecipe.venue_style || ''} onValueChange={(value) => handleInputChange('venue_style', value === '__none__' ? '' : value)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select venue style..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="upscale cocktail bar">Upscale Cocktail Bar</SelectItem>
                    <SelectItem value="dive bar">Dive Bar</SelectItem>
                    <SelectItem value="sports bar">Sports Bar</SelectItem>
                    <SelectItem value="nightclub">Nightclub</SelectItem>
                    <SelectItem value="speakeasy">Speakeasy</SelectItem>
                    <SelectItem value="rooftop bar">Rooftop Bar</SelectItem>
                    <SelectItem value="tiki bar">Tiki Bar</SelectItem>
                    <SelectItem value="hotel lobby bar">Hotel Lobby Bar</SelectItem>
                    <SelectItem value="cafe bar">cafe bar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentRecipe.ingredients && currentRecipe.ingredients.length > 0 && (
              <div className="pt-3 border-t space-y-2">
                <Label className="text-xs font-semibold text-gray-700">Use Bottle Images as Reference:</Label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {currentRecipe.ingredients.map((ing, index) => {
                    let matchedIngredient = null;
                    if (ing.ingredient_id) {
                      matchedIngredient = findMatchingIngredient(null, allIngredients, ing.ingredient_id);
                    } else {
                      const { ingredient_name: baseNameFromText } = mapAndSplitJuice(ing.ingredient_name, allIngredients);
                      matchedIngredient = findMatchingIngredient(baseNameFromText, allIngredients);
                    }
                    const hasBottleImage = matchedIngredient && matchedIngredient.bottle_image_url;

                    if (!hasBottleImage) return null;

                    return (
                      <div key={index} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-100">
                        <Checkbox
                          id={`bottle-ref-${index}`}
                          checked={ing.use_bottle_image_as_reference || false}
                          onCheckedChange={(checked) => {
                            const newIngredients = [...currentRecipe.ingredients];
                            newIngredients[index] = { 
                              ...newIngredients[index], 
                              use_bottle_image_as_reference: checked 
                            };
                            const updatedRecipe = { ...currentRecipe, ingredients: newIngredients };
                            setCurrentRecipe(updatedRecipe);
                            if (onRecipeChange) onRecipeChange(updatedRecipe);
                          }}
                        />
                        <Label 
                          htmlFor={`bottle-ref-${index}`}
                          className="text-xs font-normal cursor-pointer flex-1"
                        >
                          {matchedIngredient.name}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
            </div>
      )}

      <div className="flex justify-end gap-3 py-4 border-t border-gray-200 mt-8 sticky bottom-0 bg-white z-10">
        <Button type="button" variant="outline" onClick={onCancel}><X className="w-4 h-4 mr-2" />Cancel</Button>
        
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" onClick={(e) => handleSubmit(e)}>
          <Save className="w-4 h-4 mr-2" />
          {recipe ? 'Save' : `Create ${actualIsSubRecipe ? 'Sub-Recipe' : 'Recipe'}`}
        </Button>
      </div>

    </form>
  );
});

export default RecipeForm;