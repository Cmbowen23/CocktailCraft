import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, AlertTriangle, Scale, Trash2, X, Wand2, FlaskConical, Plus, Settings2, Calculator, Sparkles, RefreshCw } from "lucide-react";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

import RecipeForm from "../components/recipes/RecipeForm";
import AddIngredientModal from "../components/ingredients/AddIngredientModal";
import { calculateIngredientCost, findMatchingIngredient, convertToMl, convertWithCustomConversions, isClarifyingAgent } from "../components/utils/costCalculations";
import SubRecipeScalingModal from "../components/recipes/SubRecipeScalingModal";
import { calculateSubRecipeABV } from "../components/utils/subRecipeAbvCalculation";
import { safeLower, safeTrim, safeString, safeIncludes } from "../components/utils/stringSafe";
import { useAppSettings } from "@/components/contexts/AppSettingsContext";
import { InvokeLLM } from "@/api/integrations";
import SubRecipeTextImport from "../components/recipes/SubRecipeTextImport";
import SubRecipeAuditAndMapping from "../components/recipes/SubRecipeAuditAndMapping";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, FileText } from 'lucide-react';

// --- Helper: Calculate Current Stats ---
const calculateStats = (ingredients, allIngredients) => {
    let totalVol = 0;
    let totalAlcoholVol = 0;
    let totalSugarWeight = 0;

    if (!ingredients || !Array.isArray(ingredients)) {
        return { totalVol: 0, currentAbv: 0, currentBrix: 0 };
    }

    ingredients.forEach(ing => {
        if (!ing || !ing.ingredient_name || !ing.amount) return;
        
        const match = findMatchingIngredient(ing.ingredient_name, allIngredients);
        const vol = convertToMl(parseFloat(ing.amount) || 0, ing.unit, ing.ingredient_name, allIngredients);
        
        if (vol && vol > 0 && !isNaN(vol)) {
            totalVol += vol;
            const abv = parseFloat(match?.abv || 0) / 100;
            totalAlcoholVol += vol * abv;
            
            // Rough Brix Estimation
            const sugarContent = parseFloat(match?.sugar_g_per_100ml || 0) / 100; // Simplified
            if (safeIncludes(safeLower(ing.ingredient_name), 'sugar')) {
                totalSugarWeight += parseFloat(ing.amount) || 0; // Assuming grams
            } else {
                totalSugarWeight += vol * sugarContent;
            }
        }
    });

    const currentAbv = totalVol > 0 ? (totalAlcoholVol / totalVol) * 100 : 0;
    // Very rough brix calc: (sugar mass / total mass) * 100. Assuming density ~1 for simplicity or water base
    const currentBrix = totalVol > 0 ? (totalSugarWeight / totalVol) * 100 : 0; 

    return { 
        totalVol: totalVol || 0, 
        currentAbv: currentAbv || 0, 
        currentBrix: currentBrix || 0 
    };
};

export const updateSubRecipeCost = async (recipe, allIngredients, ozInterpretation = 'auto') => {
    if (!recipe || !recipe.ingredients || !Array.isArray(recipe.ingredients)) return;
    let totalCost = 0;
    const yieldAmount = parseFloat(recipe.yield_amount) || 0;
    recipe.ingredients.forEach(ing => {
        if (!ing.ingredient_name || !ing.amount) return;
        const matchedIngredient = findMatchingIngredient(ing.ingredient_name, allIngredients);
        if (matchedIngredient) {
            const cost = calculateIngredientCost(matchedIngredient, ing.amount, ing.unit, ing.prep_action, false, null, ozInterpretation);
            totalCost += cost;
        }
    });
    const subRecipeIngredient = allIngredients.find(ing => ing.ingredient_type === 'sub_recipe' && ing.sub_recipe_id === recipe.id);
    if (subRecipeIngredient) {
        const costPerUnit = yieldAmount > 0 ? totalCost / yieldAmount : 0;
        await base44.entities.Ingredient.update(subRecipeIngredient.id, { cost_per_unit: costPerUnit, unit: recipe.yield_unit || 'ml' });
    }
};

export default function CreateSubRecipe() {
    const { settings } = useAppSettings();
    const [currentRecipe, setCurrentRecipe] = useState(null);
    const [allIngredients, setAllIngredients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    
    // Modals
    const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
    const [ingredientToAdd, setIngredientToAdd] = useState("");
    const [showScalingModal, setShowScalingModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('manual');
    const [parsedSubRecipe, setParsedSubRecipe] = useState(null);

    // --- CORDIAL ARCHITECT STATE ---
    const [showArchitect, setShowArchitect] = useState(false);
    const [architectPrompt, setArchitectPrompt] = useState("");
    const [targetABV, setTargetABV] = useState(15);
    const [targetBrix, setTargetBrix] = useState(20);
    const [selectedFortifier, setSelectedFortifier] = useState(null); // ID of spirit to add
    const [clarificationMethod, setClarificationMethod] = useState("none");
    const [localClarificationMethod, setLocalClarificationMethod] = useState("none");
    
    // --- ADVANCED TOOLS STATE ---
    const [showAdvancedTools, setShowAdvancedTools] = useState(false);
    const [activeCalculator, setActiveCalculator] = useState(null);
    const [calculatorSubType, setCalculatorSubType] = useState("lime");
    const [calculatorInput, setCalculatorInput] = useState("");
    const [variableConfig, setVariableConfig] = useState({
        agarPerc: 0.2,
        milkPerc: 25,
        fatPerc: 20,
        dilutionPerc: 20,
        salinePerc: 6
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    const recipeId = urlParams.get('id');
    const ingredientId = urlParams.get('ingredientId');
    const returnTo = urlParams.get('returnTo');
    const menuId = urlParams.get('menuId');
    const prefilledName = urlParams.get('name') ? decodeURIComponent(urlParams.get('name')) : '';
    const editingRecipe = !!recipeId;

    // Load Data
    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const ingredientsData = await base44.entities.Ingredient.list();
            setAllIngredients(ingredientsData || []);

            if (recipeId) {
                const recipeData = await base44.entities.Recipe.get(recipeId);
                // Initialize clarification method from stored data
                if (recipeData.category === 'clarification' && !recipeData.clarificationMethod) {
                  const hasMilk = recipeData.ingredients?.some(ing => 
                    safeIncludes(safeLower(ing.ingredient_name), 'milk')
                  );
                  const hasAgar = recipeData.ingredients?.some(ing => 
                    safeIncludes(safeLower(ing.ingredient_name), 'agar')
                  );
                  if (hasMilk) {
                    recipeData.clarificationMethod = 'milk_wash';
                  } else if (hasAgar) {
                    recipeData.clarificationMethod = 'agar';
                  }
                }
                setCurrentRecipe(recipeData);
                if (recipeData.clarificationMethod) {
                  setLocalClarificationMethod(recipeData.clarificationMethod);
                  setClarificationMethod(recipeData.clarificationMethod);
                } else if (recipeData.clarification_method) {
                  setLocalClarificationMethod(recipeData.clarification_method);
                  setClarificationMethod(recipeData.clarification_method);
                }
            } else {
                setCurrentRecipe({
                    name: prefilledName || "", description: "", category: "syrup",
                    ingredients: [{ ingredient_name: "", amount: "", unit: "ml", notes: "" }],
                    instructions: [""], yield_amount: 750, yield_unit: "ml", abv: 0, clarification_method: "none"
                });
            }
        } catch (err) { console.error(err); setError("Failed to load."); } 
        finally { setIsLoading(false); }
    }, [recipeId, prefilledName]);

    useEffect(() => { if (settings) loadData(); }, [loadData, settings]);

    // Detect Cordial Category -> Open Architect
    useEffect(() => {
        const catLower = safeLower(currentRecipe?.category);
        if (safeIncludes(catLower, 'cordial') || safeIncludes(catLower, 'liqueur')) {
            setShowArchitect(true);
        } else {
            setShowArchitect(false);
        }
    }, [currentRecipe?.category]);

    // Set active calculator based on category
    useEffect(() => {
        if (!currentRecipe?.category) return;
        
        const catLower = safeLower(currentRecipe.category);
        if (catLower === 'super_juice') {
            setActiveCalculator('super_juice');
            setShowAdvancedTools(true);
        } else if (catLower === 'clarification') {
            // Clarification has its own UI
            setActiveCalculator(null);
        } else {
            setActiveCalculator(null);
        }
    }, [currentRecipe?.category]);

    // --- Live Calculations ---
    const stats = useMemo(() => {
        if (!currentRecipe?.ingredients) return { totalVol: 0, currentAbv: 0, currentBrix: 0 };
        return calculateStats(currentRecipe.ingredients, allIngredients);
    }, [currentRecipe?.ingredients, allIngredients]);

    // Calculate total volume in ml for clarification calculator
    const calculateTotalVolumeMl = (excludeClarifiers = false) => {
        if (!currentRecipe?.ingredients) return 0;
        let totalVol = 0;
        currentRecipe.ingredients.forEach(ing => {
            if (ing.ingredient_name && ing.amount && ing.unit) {
                if (excludeClarifiers && isClarifyingAgent(ing.ingredient_name)) {
                    return;
                }
                const vol = convertToMl(parseFloat(ing.amount), ing.unit, ing.ingredient_name, allIngredients);
                if (!isNaN(vol) && vol !== null) {
                    totalVol += vol;
                }
            }
        });
        return totalVol;
    };

    // Find Spirit in Recipe or Default
    const activeSpirit = useMemo(() => {
        // Try to find a spirit already in the ingredients
        const spiritIng = currentRecipe?.ingredients.find(ing => {
            const match = findMatchingIngredient(ing.ingredient_name, allIngredients);
            return match && parseFloat(match.abv) > 30; // Assume spirit > 30%
        });
        if (spiritIng) {
            return findMatchingIngredient(spiritIng.ingredient_name, allIngredients);
        }
        // Fallback to Vodka if not found (for calculation purposes)
        return allIngredients.find(i => safeIncludes(safeLower(i.name), 'vodka')) || { name: 'Neutral Grain Spirit', abv: 95 };
    }, [currentRecipe?.ingredients, allIngredients]);


    // --- ARCHITECT ACTIONS ---

    const handlePromptAgent = async () => {
        if (!architectPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const prompt = `
                Act as a Master Distiller.
                User Request: "${architectPrompt}"
                Task: Create a cordial recipe plan.
                Return JSON: { 
                    "name": "Recipe Name", 
                    "base_ingredient": "Name (e.g. Strawberry Juice)", 
                    "base_amount_ml": number, 
                    "target_abv": number, 
                    "target_brix": number,
                    "fortifier": "Spirit Name (e.g. Vodka)"
                }
            `;
            const res = await InvokeLLM({
                prompt,
                response_json_schema: { type: "object", properties: { name: {type:"string"}, base_ingredient: {type:"string"}, base_amount_ml: {type:"number"}, target_abv: {type:"number"}, target_brix: {type:"number"}, fortifier: {type:"string"} }, required: ["base_ingredient", "target_abv"] }
            });

            if (res) {
                setTargetABV(res.target_abv);
                setTargetBrix(res.target_brix || 20);
                
                // Populate Recipe
                setCurrentRecipe(prev => ({
                    ...prev,
                    name: res.name || prev.name,
                    ingredients: [
                        { ingredient_name: res.base_ingredient, amount: res.base_amount_ml || 500, unit: 'ml', notes: 'Base' },
                        // Don't add spirit yet, let the solver do it
                    ]
                }));
                setArchitectPrompt("");
            }
        } catch (e) { console.error(e); alert("Agent failed."); }
        finally { setIsGenerating(false); }
    };

    const handleAutoFixABV = () => {
        if (!activeSpirit) { alert("Please add a spirit to the recipe first so I know what to fortify with."); return; }
        
        const currentVol = stats.totalVol;
        const currentAlcVol = currentVol * (stats.currentAbv / 100);
        const spiritAbv = parseFloat(activeSpirit.abv) / 100;
        const target = targetABV / 100;

        // Formula: (CurrentAlc + AddedSpiritVol * SpiritABV) / (CurrentVol + AddedSpiritVol) = Target
        // Solve for AddedSpiritVol:
        // AddedSpiritVol = (Target * CurrentVol - CurrentAlc) / (SpiritABV - Target)
        
        if (spiritAbv <= target) { alert("Spirit is too weak to reach target."); return; }

        const neededVol = (target * currentVol - currentAlcVol) / (spiritAbv - target);
        
        if (neededVol <= 0) { alert("ABV is already too high!"); return; }

        // Check if spirit already exists in recipe, update it. If not, add it.
        const spiritIndex = currentRecipe.ingredients.findIndex(i => i.ingredient_name === activeSpirit.name);
        let newIngredients = [...currentRecipe.ingredients];

        if (spiritIndex >= 0) {
            const currentAmt = convertToMl(newIngredients[spiritIndex].amount, newIngredients[spiritIndex].unit, activeSpirit.name, allIngredients) || 0;
            newIngredients[spiritIndex] = {
                ...newIngredients[spiritIndex],
                amount: parseFloat((currentAmt + neededVol).toFixed(0)),
                unit: 'ml',
                notes: `Fortified to ${targetABV}%`
            };
        } else {
            newIngredients.push({
                ingredient_name: activeSpirit.name,
                amount: parseFloat(neededVol.toFixed(0)),
                unit: 'ml',
                notes: `Fortified to ${targetABV}%`
            });
        }

        setCurrentRecipe(prev => ({ ...prev, ingredients: newIngredients }));
    };

    // --- CALCULATOR HANDLERS ---
    const handleApplyCalculator = () => {
        if (!activeCalculator) return;
        
        const newIngredients = [...(currentRecipe?.ingredients || [])];
        
        if (activeCalculator === 'super_juice') {
            const peelWeight = parseFloat(calculatorInput) || 0;
            const citrusType = calculatorSubType === 'lime' ? 'Lime' : 'Lemon';
            
            if (peelWeight > 0) {
                // Super Juice formula: peel + citric acid + malic acid + sugar + water
                newIngredients.push(
                    { ingredient_name: `${citrusType} Peel`, amount: peelWeight, unit: 'g', notes: 'Base' },
                    { ingredient_name: 'Citric Acid', amount: peelWeight * 0.06, unit: 'g', notes: 'Acidity' },
                    { ingredient_name: 'Malic Acid', amount: peelWeight * 0.03, unit: 'g', notes: 'Acidity' },
                    { ingredient_name: 'White Sugar', amount: peelWeight * 0.3, unit: 'g', notes: 'Sweetness' },
                    { ingredient_name: 'Filtered Water', amount: peelWeight * 6, unit: 'ml', notes: 'Dilution' }
                );
                setCurrentRecipe(prev => ({ ...prev, ingredients: newIngredients }));
                setCalculatorInput("");
            }
        } else if (activeCalculator === 'syrup') {
            const sugarWeight = parseFloat(calculatorInput) || 0;
            if (sugarWeight > 0) {
                const ratio = calculatorSubType === 'rich' ? 2 : 1;
                newIngredients.push(
                    { ingredient_name: 'White Sugar', amount: sugarWeight, unit: 'g', notes: 'Sweetener' },
                    { ingredient_name: 'Filtered Water', amount: sugarWeight / ratio, unit: 'ml', notes: 'Base' }
                );
                setCurrentRecipe(prev => ({ ...prev, ingredients: newIngredients }));
                setCalculatorInput("");
            }
        }
    };

    const handleAddIngredientCost = (ingredientName, ingredientId) => {
      setIngredientToAdd(ingredientName);
      setShowAddIngredientModal(true);
    };

    // --- GENERIC FORM ACTIONS (Save, etc) ---
    const handleSubmit = async (recipeData) => {
        setIsSaving(true);
        try {
            const calculatedABV = calculateSubRecipeABV(recipeData, allIngredients);
            const recipeWithABV = { 
              ...recipeData, 
              abv: calculatedABV,
              clarification_method: localClarificationMethod !== 'none' ? localClarificationMethod : "none"
            };
            let savedRecipe;
            if (editingRecipe) {
                await base44.entities.Recipe.update(recipeId, recipeWithABV);
                savedRecipe = { ...recipeWithABV, id: recipeId };
            } else {
                savedRecipe = await base44.entities.Recipe.create(recipeWithABV);
            }

            // Create or link ingredient (for BOTH new and edited recipes)
            const existingIngredient = allIngredients.find(i => 
              safeLower(i.name) === safeLower(savedRecipe.name)
            );

            if (existingIngredient) {
              await base44.entities.Ingredient.update(existingIngredient.id, {
                ingredient_type: 'sub_recipe',
                sub_recipe_id: savedRecipe.id
              });
            } else {
              await base44.entities.Ingredient.create({
                name: savedRecipe.name,
                ingredient_type: 'sub_recipe',
                sub_recipe_id: savedRecipe.id,
                category: savedRecipe.category,
                unit: savedRecipe.yield_unit || 'ml',
                cost_per_unit: 0
              });
            }

            await updateSubRecipeCost(savedRecipe, allIngredients, settings?.oz_interpretation);
            
            // Redirect back to the page where this was created from
            if (returnTo) {
                window.location.href = decodeURIComponent(returnTo);
            } else {
                window.location.href = createPageUrl('Recipes');
            }
        } catch (error) { console.error(error); setError("Failed to save."); } 
        finally { setIsSaving(false); }
    };

    const handleParsedRecipeComplete = (parsedRecipes) => {
        setParsedSubRecipe(parsedRecipes);
    };

    const handleAuditSave = async (finalRecipes) => {
        // finalRecipes is the array from audit, get the first one
        const finalRecipe = finalRecipes[0];
        setIsSaving(true);
        try {
            const calculatedABV = calculateSubRecipeABV(finalRecipe, allIngredients);
            const recipeWithABV = { 
              ...finalRecipe, 
              abv: calculatedABV,
              clarification_method: finalRecipe.clarificationMethod || "none"
            };
            const savedRecipe = await base44.entities.Recipe.create(recipeWithABV);
            
            // Link to ingredient
            const existingIngredient = allIngredients.find(i => safeLower(i.name) === safeLower(savedRecipe.name));
            if (existingIngredient) {
                await base44.entities.Ingredient.update(existingIngredient.id, {
                    ingredient_type: 'sub_recipe',
                    sub_recipe_id: savedRecipe.id
                });
            } else {
                await base44.entities.Ingredient.create({
                    name: savedRecipe.name,
                    ingredient_type: 'sub_recipe',
                    sub_recipe_id: savedRecipe.id,
                    category: savedRecipe.category,
                    unit: savedRecipe.yield_unit || 'ml',
                    cost_per_unit: 0
                });
            }
            
            await updateSubRecipeCost(savedRecipe, allIngredients, settings?.oz_interpretation);
            
            // Redirect back to the page where this was created from
            if (returnTo) {
                window.location.href = decodeURIComponent(returnTo);
            } else {
                window.location.href = createPageUrl('Recipes');
            }
        } catch (error) {
            console.error(error);
            setError("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="min-h-screen p-8 bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

    // Show audit if we have parsed recipe
    if (parsedSubRecipe) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Review Sub-Recipe</h1>
                            <p className="text-gray-500 text-sm">Review and map ingredients before saving.</p>
                        </div>
                    </div>
                    <Card>
                        <CardContent className="pt-6">
                            <SubRecipeAuditAndMapping
                                parsedRecipes={parsedSubRecipe}
                                allIngredients={allIngredients}
                                onSaveComplete={handleAuditSave}
                                onCancel={() => setParsedSubRecipe(null)}
                            />
                        </CardContent>
                    </Card>
                </div>

                {showAddIngredientModal && (
                    <AddIngredientModal
                        ingredientName={ingredientToAdd}
                        allIngredients={allIngredients}
                        allRecipes={[]}
                        customCategories={[]}
                        onSave={() => {
                            setShowAddIngredientModal(false);
                            loadData();
                        }}
                        onClose={() => setShowAddIngredientModal(false)}
                    />
                )}
                </div>
                );
                }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{editingRecipe ? 'Edit Sub-Recipe' : 'New Sub-Recipe'}</h1>
                        <p className="text-gray-500 text-sm">Create internal ingredients for your menu.</p>
                    </div>
                    <Button variant="outline" onClick={() => window.history.back()}><X className="w-4 h-4 mr-2"/> Cancel</Button>
                </div>

                {/* TABS FOR MANUAL OR TEXT IMPORT */}
                <Card>
                    <CardContent className="pt-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="manual">
                                    <Edit className="w-4 h-4 mr-2" />
                                    Create Manually
                                </TabsTrigger>
                                <TabsTrigger value="text">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Import from Text
                                </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="manual">
                                <div className="flex justify-end mb-4">
                                    <Button
                                        type="button"
                                        size="icon"
                                        onClick={async () => {
                                            if (!currentRecipe?.name?.trim()) {
                                                alert("Please enter a recipe name first");
                                                return;
                                            }
                                            setIsGenerating(true);
                                            try {
                                                const prompt = `Create a detailed sub-recipe for "${currentRecipe.name}". Return JSON with: name, description, category (syrup/cordial/bitters/tincture/infusion/shrub), ingredients array with {ingredient_name, amount, unit, notes}, instructions array, yield_amount, yield_unit.`;
                                                const response = await base44.integrations.Core.InvokeLLM({
                                                    prompt,
                                                    response_json_schema: {
                                                        type: "object",
                                                        properties: {
                                                            name: { type: "string" },
                                                            description: { type: "string" },
                                                            category: { type: "string" },
                                                            ingredients: {
                                                                type: "array",
                                                                items: {
                                                                    type: "object",
                                                                    properties: {
                                                                        ingredient_name: { type: "string" },
                                                                        amount: { type: "number" },
                                                                        unit: { type: "string" },
                                                                        notes: { type: "string" }
                                                                    }
                                                                }
                                                            },
                                                            instructions: { type: "array", items: { type: "string" } },
                                                            yield_amount: { type: "number" },
                                                            yield_unit: { type: "string" }
                                                        }
                                                    }
                                                });
                                                if (response && typeof response === 'object' && response !== null) {
                                                    // Format ingredients with string amounts for form compatibility
                                                    const formattedIngredients = (response.ingredients && Array.isArray(response.ingredients) && response.ingredients.length > 0)
                                                        ? response.ingredients.map(ing => ({
                                                            ...ing,
                                                            amount: String(ing.amount || "")
                                                          }))
                                                        : [{ ingredient_name: "", amount: "", unit: "ml", notes: "" }];

                                                    setCurrentRecipe(prev => ({
                                                        ...prev,
                                                        description: response.description || prev.description || "",
                                                        category: response.category || prev.category || "syrup",
                                                        ingredients: formattedIngredients,
                                                        instructions: (response.instructions && Array.isArray(response.instructions) && response.instructions.length > 0)
                                                            ? response.instructions
                                                            : [""],
                                                        yield_amount: response.yield_amount || prev.yield_amount || 0,
                                                        yield_unit: response.yield_unit || prev.yield_unit || "ml"
                                                    }));
                                                    alert("AI generated recipe details!");
                                                } else {
                                                    alert("AI generation failed: No valid recipe data received.");
                                                }
                                            } catch (error) {
                                                console.error("Generation failed:", error);
                                                alert("Failed to generate recipe. Please try again.");
                                            } finally {
                                                setIsGenerating(false);
                                            }
                                        }}
                                        disabled={isGenerating}
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                        title="Generate recipe with AI"
                                    >
                                        {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                    </Button>
                                </div>

                                {currentRecipe && (
                                    <>
                                        <RecipeForm
                                            recipe={currentRecipe}
                                            allIngredients={allIngredients}
                                            onSubmit={handleSubmit}
                                            onCancel={() => {
                                                if (returnTo) {
                                                    window.location.href = decodeURIComponent(returnTo);
                                                } else {
                                                    window.history.back();
                                                }
                                            }}
                                            isSubRecipe={true}
                                            onRecipeChange={setCurrentRecipe}
                                            onAddIngredientCost={handleAddIngredientCost}
                                            clarificationMethod={clarificationMethod}
                                            setClarificationMethod={setClarificationMethod}
                                            calculateTotalVolumeMl={() => calculateTotalVolumeMl(true)}
                                            showAdvancedTools={showAdvancedTools}
                                            onToggleAdvancedTools={() => setShowAdvancedTools(!showAdvancedTools)}
                                            activeCalculator={activeCalculator}
                                            calculatorSubType={calculatorSubType}
                                            calculatorInput={calculatorInput}
                                            setCalculatorInput={setCalculatorInput}
                                            setCalculatorSubType={setCalculatorSubType}
                                            variableConfig={variableConfig}
                                            setVariableConfig={setVariableConfig}
                                            handleApplyCalculator={handleApplyCalculator}
                                            cordialArchitect={showArchitect && (
                                                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white border-2 border-purple-100 rounded-xl shadow-sm overflow-hidden">
                                                    {/* 1. SMART PROMPT */}
                                                    <div className="bg-purple-50 p-4 border-b border-purple-100 flex gap-3 items-center">
                                                        <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
                                                        <Input 
                                                            value={architectPrompt}
                                                            onChange={(e) => setArchitectPrompt(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handlePromptAgent()}
                                                            placeholder="Tell me what you want (e.g. 'Strawberry Cordial, 15% ABV, 750ml yield')..."
                                                            className="border-purple-200 bg-white focus-visible:ring-purple-400"
                                                        />
                                                        <Button onClick={handlePromptAgent} disabled={isGenerating} className="bg-purple-600 hover:bg-purple-700 text-white shrink-0">
                                                            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
                                                        </Button>
                                                    </div>

                                                    <div className="p-6 grid md:grid-cols-2 gap-8">
                                                        {/* 2. LIVE MONITOR (Reverse Mode) */}
                                                        <div className="space-y-4">
                                                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Current Specs</h3>
                                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                                <div className="p-3 bg-gray-50 rounded-lg border">
                                                                    <div className="text-2xl font-mono font-bold text-gray-900">{(stats?.currentAbv || 0).toFixed(1)}%</div>
                                                                    <div className="text-xs text-gray-500">ABV</div>
                                                                </div>
                                                                <div className="p-3 bg-gray-50 rounded-lg border">
                                                                    <div className="text-2xl font-mono font-bold text-gray-900">{(stats?.currentBrix || 0).toFixed(1)}</div>
                                                                    <div className="text-xs text-gray-500">Brix (Est)</div>
                                                                </div>
                                                                <div className="p-3 bg-gray-50 rounded-lg border">
                                                                    <div className="text-2xl font-mono font-bold text-gray-900">{(stats?.totalVol || 0).toFixed(0)}</div>
                                                                    <div className="text-xs text-gray-500">Vol (ml)</div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 3. TARGET SOLVER (Forward Mode) */}
                                                        <div className="space-y-4 relative">
                                                            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-100 -ml-4 hidden md:block"></div>
                                                            <div className="flex justify-between items-center">
                                                                <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wide">Targets</h3>
                                                                {Math.abs((stats?.currentAbv || 0) - targetABV) > 0.5 && (
                                                                    <Button size="sm" onClick={handleAutoFixABV} className="h-7 bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200 text-xs">
                                                                        Fix ABV <ArrowLeft className="w-3 h-3 ml-1" />
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className="space-y-6">
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-sm">
                                                                        <Label>Target ABV</Label>
                                                                        <span className="font-mono font-bold">{targetABV}%</span>
                                                                    </div>
                                                                    <Slider value={[targetABV]} min={0} max={40} step={0.5} onValueChange={([v]) => setTargetABV(v)} className="py-2" />
                                                                </div>
                                                                {/* Placeholder for Brix Solver (Future) */}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        />
                                    </>
                                )}
                            </TabsContent>
                            
                            <TabsContent value="text">
                                <SubRecipeTextImport 
                                    allIngredients={allIngredients}
                                    onComplete={handleParsedRecipeComplete}
                                    onCancel={() => setActiveTab('manual')}
                                />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {showAddIngredientModal && (
                    <AddIngredientModal
                        ingredientName={ingredientToAdd}
                        allIngredients={allIngredients}
                        allRecipes={[]}
                        customCategories={[]}
                        onSave={() => {
                            setShowAddIngredientModal(false);
                            loadData();
                        }}
                        onClose={() => setShowAddIngredientModal(false)}
                    />
                )}
            </div>
        </div>
    );
}