import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown, X, Save, Zap, ChevronRight, FileText, ChevronUp, ChevronDown, Info, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import UnitAutocomplete from "@/components/ui/unit-autocomplete";
import { parseContainerSize } from '../utils/unitConverter';
import { convertToMl, convertWithCustomConversions } from '../utils/costCalculations';
import { findOptimalScaleFactor } from '../utils/batchScalingAlgorithm';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { updateRecipeBatchSettings } from '../utils/batchSettingsService';

const containerOptions = ["750ml Bottle", "1L Bottle", "375ml Bottle", "1.75L Handle", "5 Gallon Bucket", "3 Gallon Cambro", "2 Gallon Cambro", "1 Gallon Cambro"];
const citrusIngredients = ['lemon juice', 'lime juice', 'orange juice', 'grapefruit juice', 'lemon', 'lime', 'orange', 'grapefruit'];

const shouldNeverBatch = (ingredientName) => {
    if (!ingredientName) return false;
    const normalizedName = ingredientName.toLowerCase().trim();
    return citrusIngredients.some(citrus => normalizedName.includes(citrus) || citrus.includes(normalizedName));
};

const batchingRules = {
    'spirit': { timing: 'pre-batch' }, 'liqueur': { timing: 'pre-batch' }, 'syrup': { timing: 'pre-batch' }, 'vermouth': { timing: 'pre-batch' },
    'bitters': { timing: 'service' }, 'juice': { timing: 'service' }, 'citrus': { timing: 'service' }, 'other': { timing: 'pre-batch' }
};

const findMatchingIngredient = (name, allIngredients) => {
    if (!name || !allIngredients) return null;
    return allIngredients.find(ing => ing.name.toLowerCase() === name.toLowerCase());
};

const formatNumber = (num) => num?.toFixed(2)?.replace(/\.00$/, '') || '';
const getUnitIncrement = (unit) => ({'ml': 1, 'cl': 1, 'l': 0.01, 'oz': 0.25, 'fl oz': 0.25, 'g': 1, 'kg': 0.001}[unit.toLowerCase()] || 1);

const roundToIncrement = (value, increments) => {
    let bestRounded = value;
    let minDeviation = Infinity;
    for (const increment of increments) {
        const rounded = Math.round(value / increment) * increment;
        const deviation = Math.abs(value - rounded);
        if (deviation < minDeviation) { minDeviation = deviation; bestRounded = rounded; }
    }
    return bestRounded;
};

export default function BatchScalingModal({ isOpen, onClose, recipe, allIngredients = [], onSave, embedded = false, initialScale = 1 }) {
    const [containerType, setContainerType] = useState("750ml Bottle");
    const [containerCount, setContainerCount] = useState(1);
    const [includeDilution, setIncludeDilution] = useState(false);
    const [dilutionPercentage, setDilutionPercentage] = useState(25);
    const [constrainToTotalVolume, setConstrainToTotalVolume] = useState(true);
    const [ingredientOverrides, setIngredientOverrides] = useState({});
    const [manualIngredientAmounts, setManualIngredientAmounts] = useState(new Map());
    
    const [batchIngredientUnits, setBatchIngredientUnits] = useState(() => {
        const settings = recipe?.batch_settings || {};
        const initial = {};
        (recipe?.ingredients || []).forEach(ing => {
            initial[ing.ingredient_name] = settings.batch_ingredient_units?.[ing.ingredient_name] || ing.unit || 'ml';
        });
        return initial;
    });

    const [currentIngredients, setCurrentIngredients] = useState([]);
    const [scaleFactor, setScaleFactor] = useState(1);
    const [isContainerCustom, setIsContainerCustom] = useState(false);
    const originalBatchAmountsMlPerServingRef = useRef(new Map());

    const [batchInstructions, setBatchInstructions] = useState("");
    const [inventoryBottleEnabled, setInventoryBottleEnabled] = useState(false);
    const [inventoryBottleSize, setInventoryBottleSize] = useState(null);
    const [inventoryBottleLabel, setInventoryBottleLabel] = useState("");
    const [inventoryBottleColors, setInventoryBottleColors] = useState([]);
    
    const TAPE_COLORS = [{ name: 'Red', value: '#ef4444' }, { name: 'Blue', value: '#3b82f6' }, { name: 'Green', value: '#22c55e' }, { name: 'Yellow', value: '#eab308' }, { name: 'Orange', value: '#f97316' }, { name: 'Purple', value: '#a855f7' }, { name: 'White', value: '#ffffff', border: true }, { name: 'Black', value: '#000000' }];
    
    const toggleColor = (colorValue) => {
        if (inventoryBottleColors.includes(colorValue)) setInventoryBottleColors(inventoryBottleColors.filter(c => c !== colorValue));
        else if (inventoryBottleColors.length < 3) setInventoryBottleColors([...inventoryBottleColors, colorValue]);
    };
    
    const [expandedSubRecipes, setExpandedSubRecipes] = useState({});
    const [subRecipeData, setSubRecipeData] = useState({});
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const loadUser = async () => { try { const user = await base44.auth.me(); setCurrentUser(user); } catch (e) { console.error(e); } };
        loadUser();
    }, []);

    useEffect(() => {
        if (!recipe) return;
        const tempOriginalAmounts = new Map();
        (recipe.ingredients || []).forEach(ing => {
            const amountInMl = convertToMl(ing.amount, ing.unit, ing.ingredient_name, allIngredients);
            tempOriginalAmounts.set(ing.ingredient_name, amountInMl);
        });
        originalBatchAmountsMlPerServingRef.current = tempOriginalAmounts;
        setCurrentIngredients(recipe.ingredients || []);
        
        const settings = recipe.batch_settings || {};
        const hasSettings = !!recipe.batch_settings;
        
        const initialOverrides = {};
        (recipe.ingredients || []).forEach(ing => {
            if (hasSettings && settings.ingredient_overrides?.[ing.ingredient_name]) {
                initialOverrides[ing.ingredient_name] = settings.ingredient_overrides[ing.ingredient_name];
            } else if (!hasSettings) {
                const matchedIngredient = findMatchingIngredient(ing.ingredient_name, allIngredients);
                const category = matchedIngredient?.category?.toLowerCase() || 'other';
                const rule = batchingRules[category] || batchingRules['other'];
                let assignment = rule.timing === 'pre-batch' ? 'batch' : 'service';
                if (shouldNeverBatch(ing.ingredient_name)) assignment = 'service';
                initialOverrides[ing.ingredient_name] = assignment;
            } else {
                initialOverrides[ing.ingredient_name] = 'batch';
            }
        });
        setIngredientOverrides(initialOverrides);

        if (hasSettings) {
            setScaleFactor(settings.scale_factor || 1);
            setIsContainerCustom(settings.is_container_custom || false);
            setContainerType(settings.container_type || "750ml Bottle");
            setContainerCount(settings.container_count || 1);
            setIncludeDilution(settings.include_dilution || false);
            setDilutionPercentage(settings.dilution_percentage ?? 25);
            setConstrainToTotalVolume(settings.constrain_to_total_volume ?? true);
            
            setInventoryBottleEnabled(settings.inventory_bottle?.enabled || false);
            if (settings.inventory_bottle) {
                setInventoryBottleSize(settings.inventory_bottle.size_ml);
                setInventoryBottleLabel(settings.inventory_bottle.label);
                setInventoryBottleColors(settings.inventory_bottle.colors || []);
            }
            setBatchInstructions(settings.batch_instructions || "");

            if (settings.is_container_custom && settings.batch_ingredient_amounts) {
                const loadedManualAmounts = new Map();
                Object.keys(settings.batch_ingredient_amounts).forEach(ingName => {
                    loadedManualAmounts.set(ingName, settings.batch_ingredient_amounts[ingName]);
                });
                setManualIngredientAmounts(loadedManualAmounts);
            }
        } else {
            setScaleFactor(1);
            setIsContainerCustom(false);
            setContainerType("750ml Bottle");
            setContainerCount(1);
            setIncludeDilution(false);
            setDilutionPercentage(25);
            setConstrainToTotalVolume(true);
            setInventoryBottleEnabled(false);
            setInventoryBottleSize(null);
            setInventoryBottleLabel(`${recipe.name} Batch`);
            setInventoryBottleColors([]);
            setBatchInstructions("");
        }
        
        if (embedded && initialScale !== 1) {
            setScaleFactor(initialScale);
            setIsContainerCustom(true);
            setContainerType("Custom");
        }
    }, [recipe, allIngredients, embedded, initialScale]);

    const handleBatchStatusChange = useCallback((ingredientName, status) => {
        setIngredientOverrides(prev => ({ ...prev, [ingredientName]: status }));
    }, []);

    const handleUnitChange = useCallback((name, newUnit) => {
        setBatchIngredientUnits(prev => ({ ...prev, [name]: newUnit }));
    }, []);

    useEffect(() => {
        if (isContainerCustom) return;
        let singleServingConcentrateMl = 0;
        originalBatchAmountsMlPerServingRef.current.forEach((amountMl, name) => {
            if (ingredientOverrides[name] === 'batch') singleServingConcentrateMl += amountMl;
        });
        const totalContainerVolume = parseContainerSize(containerType) * containerCount;
        if (singleServingConcentrateMl > 0) {
            let targetConcentrateVolume;
            if (includeDilution && constrainToTotalVolume) {
                const dilutionRatio = 1 + (dilutionPercentage / 100);
                targetConcentrateVolume = totalContainerVolume / dilutionRatio;
            } else {
                targetConcentrateVolume = totalContainerVolume;
            }
            setScaleFactor(targetConcentrateVolume / singleServingConcentrateMl);
        } else {
            setScaleFactor(1);
        }
    }, [containerType, containerCount, isContainerCustom, ingredientOverrides, includeDilution, dilutionPercentage, constrainToTotalVolume]);

    const calculations = useMemo(() => {
        if (!recipe || !recipe.ingredients) return { totalServings: 0, totalVolumeMl: 0, dilutionWaterMl: 0, concentrateVolumeMl: 0, scaleFactor: 1 };
        let singleServingConcentrateMl = 0;
        originalBatchAmountsMlPerServingRef.current.forEach((originalMlPerServing, ingredientName) => {
            if (ingredientOverrides[ingredientName] === 'batch') singleServingConcentrateMl += originalMlPerServing;
        });
        let batchConcentrateVolumeMl;
        let calculatedScaleFactor;
        if (isContainerCustom) {
            batchConcentrateVolumeMl = 0;
            originalBatchAmountsMlPerServingRef.current.forEach((originalMlPerServing, ingredientName) => {
                if (ingredientOverrides[ingredientName] === 'batch') {
                    let amountInMl = 0;
                    if (manualIngredientAmounts.has(ingredientName)) {
                         const currentUnit = batchIngredientUnits[ingredientName] || 'ml';
                         const amount = manualIngredientAmounts.get(ingredientName);
                         amountInMl = convertToMl(amount, currentUnit, ingredientName, allIngredients);
                    } else {
                         amountInMl = originalMlPerServing * scaleFactor;
                    }
                    batchConcentrateVolumeMl += amountInMl;
                }
            });
            calculatedScaleFactor = singleServingConcentrateMl > 0 ? batchConcentrateVolumeMl / singleServingConcentrateMl : scaleFactor;
        } else {
            const totalContainerVolume = parseContainerSize(containerType) * containerCount;
            if (includeDilution && constrainToTotalVolume) {
                const dilutionRatio = 1 + (dilutionPercentage / 100);
                batchConcentrateVolumeMl = totalContainerVolume / dilutionRatio;
            } else {
                batchConcentrateVolumeMl = totalContainerVolume;
            }
            calculatedScaleFactor = singleServingConcentrateMl > 0 ? batchConcentrateVolumeMl / singleServingConcentrateMl : 1;
        }
        const dilutionWaterMl = includeDilution ? (batchConcentrateVolumeMl * (dilutionPercentage / 100)) : 0;
        const finalTotalVolumeMl = batchConcentrateVolumeMl + dilutionWaterMl;
        const totalServings = singleServingConcentrateMl > 0 ? batchConcentrateVolumeMl / singleServingConcentrateMl : 0;
        return { totalServings, totalVolumeMl: finalTotalVolumeMl, dilutionWaterMl, concentrateVolumeMl: batchConcentrateVolumeMl, scaleFactor: calculatedScaleFactor };
    }, [recipe, containerType, containerCount, scaleFactor, isContainerCustom, ingredientOverrides, includeDilution, dilutionPercentage, constrainToTotalVolume, batchIngredientUnits, manualIngredientAmounts, allIngredients]);

    const handleIngredientAmountChange = useCallback((ingredientName, newAmountRaw) => {
        const numValue = parseFloat(newAmountRaw);
        if (isNaN(numValue) || numValue < 0) return;

        if (!isContainerCustom) {
            setIsContainerCustom(true);
            setContainerType("Custom");
        }
        setManualIngredientAmounts(prev => new Map(prev).set(ingredientName, numValue));
        
        if (ingredientName === 'Water (Dilution)') {
            const currentDisplayUnit = batchIngredientUnits[ingredientName] || 'ml';
            const newDilutionWaterMl = convertToMl(numValue, currentDisplayUnit, ingredientName, allIngredients);
            let newDilutionPercentage = 0;
            if (calculations.concentrateVolumeMl > 0) {
                newDilutionPercentage = (newDilutionWaterMl / calculations.concentrateVolumeMl) * 100;
            }
            setDilutionPercentage(Math.max(0, Math.round(newDilutionPercentage)));
            return;
        }

        const originalAmountMlPerServing = originalBatchAmountsMlPerServingRef.current.get(ingredientName);
        if (originalAmountMlPerServing === undefined || originalAmountMlPerServing === 0) return;
        const currentDisplayUnit = batchIngredientUnits[ingredientName] || 'ml';
        const newValueMl = convertToMl(numValue, currentDisplayUnit, ingredientName, allIngredients);
        let newCalculatedScaleFactor = newValueMl / originalAmountMlPerServing;
        setScaleFactor(newCalculatedScaleFactor);

    }, [batchIngredientUnits, allIngredients, isContainerCustom, calculations]);

    const scaledBatchAmounts = useMemo(() => {
        if (!recipe || !recipe.ingredients) return new Map();
        const amounts = new Map();
        const { scaleFactor: calculatedScaleFactor } = calculations;
        const shouldApplyRounding = isContainerCustom; // If Custom (Optimized), apply rounding.
        const increments = [1, 0.5];
        
        originalBatchAmountsMlPerServingRef.current.forEach((originalMlPerServing, ingredientName) => {
            if (ingredientOverrides[ingredientName] === 'batch') {
                const scaledMl = originalMlPerServing * calculatedScaleFactor;
                const targetUnit = batchIngredientUnits[ingredientName] || 'ml';
                const matchedIngredient = findMatchingIngredient(ingredientName, allIngredients);
                let convertedAmount = convertWithCustomConversions(scaledMl, 'ml', targetUnit, matchedIngredient);
                
                if (isContainerCustom && manualIngredientAmounts.has(ingredientName)) {
                    convertedAmount = manualIngredientAmounts.get(ingredientName);
                } else if (shouldApplyRounding) {
                    convertedAmount = roundToIncrement(convertedAmount, increments);
                }
                amounts.set(ingredientName, { amount: convertedAmount, unit: targetUnit });
            }
        });
        if (includeDilution && calculations.dilutionWaterMl > 0) {
            const displayUnit = batchIngredientUnits['Water (Dilution)'] || 'ml';
            const displayAmount = convertWithCustomConversions(calculations.dilutionWaterMl, 'ml', displayUnit, null);
            amounts.set('Water (Dilution)', {amount: displayAmount, unit: displayUnit});
        }
        return amounts;
    }, [recipe, calculations, ingredientOverrides, batchIngredientUnits, allIngredients, includeDilution, isContainerCustom, manualIngredientAmounts]);

    const handleContainerTypeChange = (newType) => {
        setContainerType(newType);
        if (isContainerCustom && newType !== "Custom") {
            setIsContainerCustom(false);
            setManualIngredientAmounts(new Map());
        } else if (newType === "Custom") {
            setIsContainerCustom(true);
        }
    };

    const handleEasyScale = () => {
        const containerVol = isContainerCustom 
            ? Math.max(calculations.totalVolumeMl, 750) 
            : parseContainerSize(containerType) * containerCount;
        
        const optimalScale = findOptimalScaleFactor(originalBatchAmountsMlPerServingRef.current, ingredientOverrides, batchIngredientUnits, allIngredients, containerVol);
        
        setScaleFactor(optimalScale);
        setIsContainerCustom(true);
        setContainerType("Custom");
        setManualIngredientAmounts(new Map()); // Reset manual overrides so auto-rounding works
    };

    const handleSave = async () => {
        const batchIngredientAmounts = {};
        const finalBatchIngredientUnits = { ...batchIngredientUnits };
        
        // SAVE EXACT VALUES (Instructions)
        scaledBatchAmounts.forEach((data, ingredientName) => {
            batchIngredientAmounts[ingredientName] = data.amount;
            finalBatchIngredientUnits[ingredientName] = data.unit;
        });

        const newSettings = {
            ingredient_overrides: ingredientOverrides,
            batch_ingredient_amounts: batchIngredientAmounts,
            batch_ingredient_units: finalBatchIngredientUnits,
            include_dilution: includeDilution,
            dilution_percentage: dilutionPercentage,
            constrain_to_total_volume: constrainToTotalVolume,
            scale_factor: calculations.scaleFactor,
            is_container_custom: isContainerCustom,
            container_type: isContainerCustom ? 'Custom' : containerType,
            container_count: containerCount,
            batch_instructions: batchInstructions,
            inventory_bottle: {
                enabled: inventoryBottleEnabled,
                size_ml: inventoryBottleEnabled ? inventoryBottleSize : null,
                label: inventoryBottleEnabled ? inventoryBottleLabel : null,
                colors: inventoryBottleEnabled ? inventoryBottleColors : []
            },
            track_batch_inventory: inventoryBottleEnabled
        };

        const updatedRecipe = await updateRecipeBatchSettings({ recipe, newBatchSettings: newSettings, allIngredients, accountId: currentUser?.account_id });
        if (onSave) onSave(updatedRecipe);
        onClose();
    };

    const handleCreateTrainingDoc = () => {
        const batchBlock = {
            type: 'batch', recipeId: recipe.id, title: `Batch Prep: ${recipe.name}`,
            containerType: isContainerCustom ? 'Custom' : containerType, containerCount: containerCount,
            standardVolumeMl: calculations.totalVolumeMl, standardServings: calculations.totalServings
        };
        const encodedBlock = encodeURIComponent(JSON.stringify(batchBlock));
        window.location.href = createPageUrl(`TrainingDocEditor?initialBlockType=batch&initialBlockData=${encodedBlock}`);
    };

    const toggleSubRecipeExpansion = useCallback(async (ingredientName) => { 
        setExpandedSubRecipes(prev => ({ ...prev, [ingredientName]: !prev[ingredientName] })); 
        if (!expandedSubRecipes[ingredientName] && !subRecipeData[ingredientName]) { 
            const matchedIngredient = findMatchingIngredient(ingredientName, allIngredients); 
            if (matchedIngredient?.ingredient_type === 'sub_recipe' && matchedIngredient.sub_recipe_id) { 
                try { 
                    const subRecipe = await base44.entities.Recipe.get(matchedIngredient.sub_recipe_id); 
                    setSubRecipeData(prev => ({ ...prev, [ingredientName]: subRecipe })); 
                } catch (error) { 
                    console.error(error); 
                } 
            } 
        } 
    }, [expandedSubRecipes, subRecipeData, allIngredients]);

    const renderSubRecipeIngredients = useCallback((ingredientName, parentScaledAmount, parentUnit) => { 
        const subRecipe = subRecipeData[ingredientName]; 
        if (!subRecipe) return <div className="text-xs text-gray-500 italic pl-8 py-2">Loading sub-recipe...</div>; 
        const subRecipeYieldAmount = subRecipe.yield_amount || 1; 
        const subRecipeYieldUnit = subRecipe.yield_unit || 'ml'; 
        const neededMl = convertToMl(parentScaledAmount, parentUnit, ingredientName, allIngredients); 
        const yieldMl = convertToMl(subRecipeYieldAmount, subRecipeYieldUnit, ingredientName, allIngredients); 
        const subRecipeScaleFactor = yieldMl > 0 ? neededMl / yieldMl : 1; 
        if (!subRecipe.ingredients || subRecipe.ingredients.length === 0) return <div className="text-xs text-gray-500 italic pl-8 py-2">No ingredients.</div>; 
        return ( 
            <div className="pl-8 mt-2 space-y-2 border-l-2 border-purple-200"> 
                <div className="text-xs font-semibold text-purple-700 mb-2">Sub-Recipe Ingredients (scaled to {formatNumber(parentScaledAmount)} {parentUnit}):</div> 
                {subRecipe.ingredients.map((subIng, idx) => { 
                    const scaledSubAmount = subIng.amount * subRecipeScaleFactor; 
                    return ( 
                        <div key={idx} className="flex items-center justify-between text-sm bg-purple-50/50 p-2 rounded"> 
                            <span className="text-gray-700">{subIng.ingredient_name}</span> 
                            <span className="font-medium text-purple-900">{formatNumber(scaledSubAmount)} {subIng.unit}</span> 
                        </div> 
                    ); 
                })} 
            </div> 
        ); 
    }, [subRecipeData, allIngredients]);

    const renderIngredientRow = useCallback((ingredient, isBatch) => {
        const { ingredient_name, unit, amount } = ingredient;
        const scaledData = scaledBatchAmounts.get(ingredient_name);
        if (!scaledData && isBatch && ingredient_name !== 'Water (Dilution)') return null;
        const currentDisplayedAmount = parseFloat(scaledData?.amount || 0);
        const currentDisplayedUnit = scaledData?.unit || unit || 'ml';
        const increment = getUnitIncrement(currentDisplayedUnit);
        const handleRoundInternal = (direction) => {
            let newValue = currentDisplayedAmount;
            if (direction === 'up') newValue = newValue % 1 !== 0 ? Math.ceil(newValue) : newValue + 1;
            else newValue = newValue % 1 !== 0 ? Math.floor(newValue) : newValue - 1;
            newValue = Math.max(0, newValue);
            
            // Manual rounding triggers Custom Mode
            if (!isContainerCustom) {
                setIsContainerCustom(true);
                setContainerType("Custom");
            }
            setManualIngredientAmounts(prev => new Map(prev).set(ingredient_name, newValue));
        };
        const isDilutionWater = ingredient_name === 'Water (Dilution)';
        const isAmountEditableForScaling = isBatch && !isDilutionWater;
        const matchedIngredient = findMatchingIngredient(ingredient_name, allIngredients);
        const isSubRecipe = matchedIngredient?.ingredient_type === 'sub_recipe' && matchedIngredient.sub_recipe_id;
        const isExpanded = expandedSubRecipes[ingredient_name];

        return (
            <div key={ingredient_name}>
                <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-lg ${isBatch ? 'bg-blue-50/70 border border-blue-200/50' : 'bg-gray-50/70'}`}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={() => handleBatchStatusChange(ingredient_name, isBatch ? 'service' : 'batch')} className="h-6 w-6 p-0">
                                        {isBatch ? <ArrowDown className="w-3 h-3 text-gray-500" /> : <ArrowUp className="w-3 h-3 text-gray-500" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{isBatch ? "Move to Service" : "Move to Batch"}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        {isSubRecipe && isBatch && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="sm" variant="ghost" onClick={() => toggleSubRecipeExpansion(ingredient_name)} className="h-6 w-6 p-0">
                                            <ChevronRight className={`w-4 h-4 text-purple-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{isExpanded ? "Hide" : "Show"}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${isBatch ? 'text-blue-900' : 'text-gray-800'} break-words flex items-center gap-2`}>
                                {ingredient_name}
                                {isSubRecipe && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Sub-Recipe</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isBatch ? (
                            <div className="flex items-center">
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 mr-1" onClick={() => handleRoundInternal('down')} disabled={!isAmountEditableForScaling}><ChevronDown className="w-4 h-4" /></Button>
                                <Input 
                                    type="number" step={increment.toString()} value={formatNumber(currentDisplayedAmount)} 
                                    onChange={(e) => {
                                        const num = parseFloat(e.target.value);
                                        if(!isNaN(num)) {
                                            if(!isContainerCustom) { setIsContainerCustom(true); setContainerType("Custom"); }
                                            setManualIngredientAmounts(prev => new Map(prev).set(ingredient_name, num));
                                        }
                                    }} 
                                    className="w-24 text-right bg-white" min="0" disabled={!isAmountEditableForScaling} 
                                />
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 ml-1 mr-2" onClick={() => handleRoundInternal('up')} disabled={!isAmountEditableForScaling}><ChevronUp className="w-4 h-4" /></Button>
                                <div className="w-28"><UnitAutocomplete value={currentDisplayedUnit} onValueChange={(newUnit) => handleUnitChange(ingredient_name, newUnit)} disabled={!isAmountEditableForScaling} /></div>
                            </div>
                        ) : (
                            <>
                                <span className="text-right w-24 text-gray-700">{formatNumber(amount)}</span>
                                <span className="w-28 pl-2 text-gray-600">{unit}</span>
                            </>
                        )}
                    </div>
                </div>
                {isSubRecipe && isBatch && isExpanded && renderSubRecipeIngredients(ingredient_name, currentDisplayedAmount, currentDisplayedUnit)}
            </div>
        );
    }, [scaledBatchAmounts, handleBatchStatusChange, allIngredients, handleIngredientAmountChange, handleUnitChange, expandedSubRecipes, toggleSubRecipeExpansion, renderSubRecipeIngredients, isContainerCustom]);

    const content = (
        <div className={embedded ? "" : "space-y-6 py-4"}>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="container-type">Container Type</Label>
                    <Select value={containerType} onValueChange={handleContainerTypeChange}>
                        <SelectTrigger id="container-type"><SelectValue placeholder="Select container" /></SelectTrigger>
                        <SelectContent>
                            {isContainerCustom && <SelectItem value="Custom">Custom (Scaled Manually)</SelectItem>}
                            {containerOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            {!isContainerCustom && <SelectItem value="Custom">Custom (Scale Manually)</SelectItem>}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="container-count">Count</Label>
                    <Input id="container-count" type="number" min="1" value={containerCount} onChange={e => { setContainerCount(Math.max(1, parseInt(e.target.value || '1')) || 1); if (isContainerCustom) setIsContainerCustom(false); }} disabled={isContainerCustom} />
                </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-blue-50/30">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Dilution</h3>
                <div className="flex items-center space-x-2 mb-3">
                    <Checkbox id="include-dilution" checked={includeDilution} onCheckedChange={setIncludeDilution} />
                    <Label htmlFor="include-dilution" className="text-blue-800">Add Dilution Water</Label>
                </div>
                {includeDilution && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Label htmlFor="dilution-percentage" className="text-sm font-medium text-blue-700">Dilution Percentage</Label>
                                <Input id="dilution-percentage" type="number" min="0" max="50" step="1" value={dilutionPercentage} onChange={(e) => setDilutionPercentage(parseInt(e.target.value) || 0)} className="mt-1" />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="constrain-volume" checked={constrainToTotalVolume} onCheckedChange={setConstrainToTotalVolume} />
                                <Label htmlFor="constrain-volume" className="text-sm text-blue-700">Constrain to Total Volume</Label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-center">
                    <div className="text-sm text-emerald-700">Total Servings</div>
                    <div className="text-2xl font-bold text-emerald-900">{formatNumber(calculations.totalServings)}</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                    <div className="text-sm text-blue-700">Total Volume</div>
                    <div className="text-2xl font-bold text-blue-900">{Math.round(calculations.totalVolumeMl)} ml</div>
                </div>
                 <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 text-center">
                    <div className="text-sm text-purple-700">Scale Factor</div>
                    <div className="text-2xl font-bold text-purple-900">{formatNumber(calculations.scaleFactor)}x</div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Batch Ingredients</h3>
                        <Button onClick={handleEasyScale} variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                            <Zap className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="mt-2 space-y-2">
                        {recipe.ingredients.filter(i => ingredientOverrides[i.ingredient_name] === 'batch').length > 0
                            ? recipe.ingredients.filter(i => ingredientOverrides[i.ingredient_name] === 'batch').map(ing => renderIngredientRow(ing, true))
                            : <p className="text-sm text-gray-500 italic p-3">No ingredients designated for batch.</p>
                        }
                        {includeDilution && calculations.dilutionWaterMl > 0 && scaledBatchAmounts.has('Water (Dilution)') && (
                            renderIngredientRow({ingredient_name: 'Water (Dilution)', amount: scaledBatchAmounts.get('Water (Dilution)')?.amount || 0, unit: scaledBatchAmounts.get('Water (Dilution)')?.unit || 'ml'}, true)
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Service Ingredients (per serving)</h3>
                    <div className="mt-2 space-y-2">
                        {recipe.ingredients.filter(i => ingredientOverrides[i.ingredient_name] === 'service').length > 0
                            ? recipe.ingredients.filter(i => ingredientOverrides[i.ingredient_name] === 'service').map(ing => renderIngredientRow(ing, false))
                            : <p className="text-sm text-gray-500 italic p-3">All ingredients are designated for batching.</p>
                        }
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Inventory Bottle
                </h3>
                
                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id="inventory-bottle-enabled" 
                        checked={inventoryBottleEnabled} 
                        onCheckedChange={setInventoryBottleEnabled} 
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="inventory-bottle-enabled" className="font-medium text-gray-900">
                            Track this batch as a bottle in inventory
                        </Label>
                        <p className="text-xs text-gray-500">
                            Creates an inventory item that bartenders can count and track
                        </p>
                    </div>
                </div>
                
                {inventoryBottleEnabled && (
                    <div className="pt-3 border-t border-blue-200 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-gray-900">Bottle size for inventory</Label>
                            <Select 
                                value={inventoryBottleSize?.toString() || "none"} 
                                onValueChange={(val) => setInventoryBottleSize(val === "none" ? null : parseInt(val))}
                                disabled={!inventoryBottleEnabled}
                            >
                                <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="– Select bottle size –" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">– Select –</SelectItem>
                                    <SelectItem value="750">750 ml bottle</SelectItem>
                                    <SelectItem value="1000">1 L bottle</SelectItem>
                                </SelectContent>
                            </Select>
                            {inventoryBottleEnabled && !inventoryBottleSize && (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    Select 750 ml or 1 L to track this in inventory
                                </p>
                            )}
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-gray-900">Bottle neck label</Label>
                            <Input 
                                value={inventoryBottleLabel}
                                onChange={(e) => setInventoryBottleLabel(e.target.value)}
                                placeholder="e.g., Negroni Batch"
                                maxLength={20}
                                className="bg-white"
                                disabled={!inventoryBottleEnabled}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-gray-900">Neck tape colors (Max 3)</Label>
                            <div className="flex flex-wrap gap-2">
                                {TAPE_COLORS.map((color) => (
                                    <button
                                        key={color.name}
                                        type="button"
                                        onClick={() => toggleColor(color.value)}
                                        disabled={!inventoryBottleEnabled}
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                                            inventoryBottleColors.includes(color.value) 
                                                ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' 
                                                : 'hover:scale-105'
                                        } ${!inventoryBottleEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        style={{ 
                                            backgroundColor: color.value,
                                            borderColor: color.border ? '#e5e7eb' : 'transparent' 
                                        }}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                            
                            <div className="flex items-center mt-2 p-3 bg-white/70 rounded-lg border border-blue-200">
                                <div className="flex-1">
                                    <span className="text-xs text-gray-500 block mb-1">Preview (Bottom-up):</span>
                                    {inventoryBottleColors.length === 0 ? (
                                        <span className="text-xs text-gray-400 italic">No colors selected</span>
                                    ) : (
                                        <div className="relative w-8 h-12 bg-gray-200 rounded border border-gray-300 mx-auto">
                                            <div className="absolute top-1 left-1/2 transform -translate-x-1/2 flex flex-col-reverse gap-[2px] w-5">
                                                {inventoryBottleColors.map((c, i) => (
                                                    <div 
                                                        key={i} 
                                                        className="w-full h-1.5 shadow-sm border border-black/10" 
                                                        style={{ backgroundColor: c }} 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {inventoryBottleColors.length > 0 && (
                                    <button 
                                        onClick={() => setInventoryBottleColors([])}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="pt-2 border-t border-blue-200">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCreateTrainingDoc} 
                        className="w-full text-blue-600 border-blue-300 hover:bg-blue-100"
                    >
                        <FileText className="w-4 h-4 mr-2" /> Save to Training Docs
                    </Button>
                </div>
            </div>
        </div>
    );

    if (embedded) return content;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="text-emerald-900">Batch Prep: {recipe.name}</DialogTitle><DialogDescription>Customize which ingredients are batched and which are added per serving.</DialogDescription></DialogHeader>
                {content}
                <DialogFooter className="pt-6"><Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Cancel</Button><Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700"><Save className="w-4 h-4 mr-2" />Save Batch Settings</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}