import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, RotateCcw, Beaker, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { calculateBatchMetrics, findOptimalScaleFactor, roundToIncrement } from '../utils/batchCalculations';
import { convertToMl, convertWithCustomConversions } from '../utils/costCalculations';

// This component handles the display and "mini calculator" logic for batch blocks
export default function BatchBlockRenderer({ block, allIngredients = [] }) {
    const [recipe, setRecipe] = useState(null);
    const [showCalculator, setShowCalculator] = useState(false);
    
    // Calculator State
    const [targetMode, setTargetMode] = useState('servings'); // 'servings' or 'volume'
    const [targetValue, setTargetValue] = useState('');
    
    // Computed override state (local only, never saved)
    const [customScaleFactor, setCustomScaleFactor] = useState(null);

    const originalBatchAmountsMlPerServingRef = useRef(new Map());
    const [ingredientOverrides, setIngredientOverrides] = useState({});
    const [batchIngredientUnits, setBatchIngredientUnits] = useState({});

    useEffect(() => {
        if (block.recipeId) {
            loadRecipe(block.recipeId);
        }
    }, [block.recipeId]);

    const loadRecipe = async (id) => {
        try {
            const r = await base44.entities.Recipe.get(id);
            setRecipe(r);
            
            // Initialize calculation baselines
            const overrides = {};
            const units = {};
            const originalAmounts = new Map();

            (r.ingredients || []).forEach(ing => {
                const matchedIng = allIngredients.find(i => i.name.toLowerCase() === ing.ingredient_name.toLowerCase());
                
                // ALWAYS read from Recipe.batch_settings
                if (r.batch_settings?.ingredient_overrides?.[ing.ingredient_name]) {
                    overrides[ing.ingredient_name] = r.batch_settings.ingredient_overrides[ing.ingredient_name];
                } else {
                    // Default logic (simplified)
                    const isCitrus = ['lemon', 'lime', 'orange', 'grapefruit'].some(c => ing.ingredient_name.toLowerCase().includes(c));
                    overrides[ing.ingredient_name] = isCitrus ? 'service' : 'batch';
                }

                // Read units from Recipe.batch_settings
                units[ing.ingredient_name] = r.batch_settings?.batch_ingredient_units?.[ing.ingredient_name] || ing.unit || 'ml';
                
                const amountMl = convertToMl(ing.amount, ing.unit, ing.ingredient_name, allIngredients);
                originalAmounts.set(ing.ingredient_name, amountMl);
            });

            setIngredientOverrides(overrides);
            setBatchIngredientUnits(units);
            originalBatchAmountsMlPerServingRef.current = originalAmounts;

        } catch (error) {
            console.error("Error loading recipe for batch block:", error);
        }
    };

    // Derived Metrics - ALWAYS read from Recipe.batch_settings
    const activeMetrics = useMemo(() => {
        if (!recipe) return null;

        // Read config from Recipe.batch_settings (never versions)
        const baseContainerType = block.containerType || recipe.batch_settings?.container_type || '1L Bottle';
        const baseContainerCount = block.containerCount || recipe.batch_settings?.container_count || 1;
        const baseScaleFactor = recipe.batch_settings?.scale_factor || 1;
        const isCustom = customScaleFactor !== null || recipe.batch_settings?.is_container_custom;

        return calculateBatchMetrics({
            recipe,
            allIngredients,
            ingredientOverrides,
            containerType: baseContainerType,
            containerCount: baseContainerCount,
            scaleFactor: customScaleFactor !== null ? customScaleFactor : baseScaleFactor,
            isContainerCustom: isCustom,
            includeDilution: recipe.batch_settings?.include_dilution || false,
            dilutionPercentage: recipe.batch_settings?.dilution_percentage || 25,
            constrainToTotalVolume: recipe.batch_settings?.constrain_to_total_volume ?? true,
            clarificationEnabled: recipe.batch_settings?.clarification?.enabled || false,
            clarificationTechnique: recipe.batch_settings?.clarification?.technique,
            clarificationRatio: recipe.batch_settings?.clarification?.agent_ratio_percentage,
            clarificationAgent: recipe.batch_settings?.clarification?.agent_ingredient_name,
            originalBatchAmountsMlPerServing: originalBatchAmountsMlPerServingRef.current
        });
    }, [recipe, block, allIngredients, ingredientOverrides, customScaleFactor]);

    const handleCalculate = () => {
        if (!activeMetrics || !targetValue) return;
        
        const val = parseFloat(targetValue);
        if (isNaN(val) || val <= 0) return;

        let newScaleFactor = 1;

        if (targetMode === 'servings') {
            // Target Servings -> Scale Factor
            // scaleFactor = targetServings * singleServingConcentrate / singleServingConcentrate
            // Actually: scaleFactor = targetServings
            // wait, calculateBatchMetrics uses: 
            // singleServingConcentrateMl = sum(originalMlPerServing)
            // batchConcentrateVolumeMl = singleServingConcentrateMl * scaleFactor
            // totalServings = batchConcentrateVolumeMl / singleServingConcentrateMl = scaleFactor
            // So if constrained to total volume, scaleFactor is derived. If custom, scaleFactor is direct.
            // Basically: scaleFactor IS the number of servings if we ignore dilution/constraint complexity for a moment.
            
            // To be precise:
            // currentServings = activeMetrics.totalServings
            // we want targetServings
            // newScaleFactor = currentScaleFactor * (targetServings / currentServings)
            
            if (activeMetrics.totalServings > 0) {
                newScaleFactor = activeMetrics.scaleFactor * (val / activeMetrics.totalServings);
            }
        } else {
            // Target Volume (ml)
            if (activeMetrics.totalVolumeMl > 0) {
                newScaleFactor = activeMetrics.scaleFactor * (val / activeMetrics.totalVolumeMl);
            }
        }

        setCustomScaleFactor(newScaleFactor);
    };

    const handleReset = () => {
        setCustomScaleFactor(null);
        setTargetValue('');
    };

    // Calculate Final Ingredient Amounts for Display
    const displayedIngredients = useMemo(() => {
        if (!activeMetrics || !recipe) return [];

        const list = [];
        const { scaleFactor: finalScale, dilutionWaterMl, clarificationAgentMl } = activeMetrics;
        const increments = [1, 0.5]; // For rounding

        originalBatchAmountsMlPerServingRef.current.forEach((originalMl, name) => {
            if (ingredientOverrides[name] === 'batch') {
                const scaledMl = originalMl * finalScale;
                const unit = batchIngredientUnits[name] || 'ml';
                
                const matchedIng = allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
                let amount = convertWithCustomConversions(scaledMl, 'ml', unit, matchedIng);
                
                // Round nicely for display
                amount = roundToIncrement(amount, increments);

                list.push({ name, amount, unit });
            }
        });

        if (dilutionWaterMl > 0) {
            const unit = batchIngredientUnits['Water (Dilution)'] || 'ml';
            let amount = convertWithCustomConversions(dilutionWaterMl, 'ml', unit, null);
            amount = roundToIncrement(amount, increments);
            list.push({ name: 'Water (Dilution)', amount, unit });
        }

        if (clarificationAgentMl > 0) {
            const agentName = recipe.batch_settings?.clarification?.agent_ingredient_name || 'Clarification Agent';
            const unit = batchIngredientUnits[agentName] || 'ml';
            let amount = convertWithCustomConversions(clarificationAgentMl, 'ml', unit, null);
            amount = roundToIncrement(amount, increments);
            list.push({ name: agentName, amount, unit });
        }

        return list;
    }, [activeMetrics, recipe, ingredientOverrides, batchIngredientUnits, allIngredients]);

    if (!recipe) return <div className="p-4 bg-gray-50 rounded border animate-pulse">Loading Batch Info...</div>;

    const isCustomized = customScaleFactor !== null;

    return (
        <Card className={`mb-6 border-l-4 ${isCustomized ? 'border-l-amber-500 bg-amber-50/30' : 'border-l-blue-500 bg-blue-50/30'}`}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between items-center">
                    <span>{block.title || `Batch: ${recipe.name}`}</span>
                    {isCustomized && <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Scaled Custom</Badge>}
                </CardTitle>
                <div className="text-sm text-gray-500 flex gap-4">
                    <span>
                         {isCustomized 
                            ? `Custom Target: ${Math.round(activeMetrics.totalVolumeMl)}ml` 
                            : `${block.containerCount || 1} x ${block.containerType || 'Container'}`
                         }
                    </span>
                    <span>•</span>
                    <span>Approx. {Math.round(activeMetrics.totalServings)} servings</span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Ingredients Table */}
                    <div>
                        <h4 className="font-medium text-gray-700 mb-2 text-sm uppercase tracking-wide">Ingredients</h4>
                        <div className="space-y-1">
                            {displayedIngredients.map((ing, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-0">
                                    <span className="text-gray-800">{ing.name}</span>
                                    <span className="font-mono font-medium text-blue-700">
                                        {ing.amount} {ing.unit}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calculator Section */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div 
                            className="flex items-center gap-2 text-blue-700 cursor-pointer hover:text-blue-900 mb-4 p-2 bg-blue-50 rounded-md border border-blue-100 transition-colors"
                            onClick={() => setShowCalculator(!showCalculator)}
                        >
                            <Calculator className="w-5 h-5" />
                            <span className="text-base font-bold">{showCalculator ? 'Hide Calculator' : 'Open Batch Calculator'}</span>
                        </div>

                        {showCalculator && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs">I want to make:</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Button 
                                                size="sm" 
                                                variant={targetMode === 'servings' ? 'default' : 'outline'} 
                                                onClick={() => setTargetMode('servings')}
                                                className="flex-1 text-xs"
                                            >
                                                Servings
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant={targetMode === 'volume' ? 'default' : 'outline'} 
                                                onClick={() => setTargetMode('volume')}
                                                className="flex-1 text-xs"
                                            >
                                                Total Volume (ml)
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input 
                                            type="number" 
                                            placeholder={targetMode === 'servings' ? "e.g. 50" : "e.g. 2000"}
                                            value={targetValue}
                                            onChange={e => setTargetValue(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCalculate()}
                                        />
                                        <Button onClick={handleCalculate} size="icon">
                                            <Beaker className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    {isCustomized && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={handleReset} 
                                            className="w-full text-gray-500 hover:text-gray-700 h-8"
                                        >
                                            <RotateCcw className="w-3 h-3 mr-2" /> Reset to Standard
                                        </Button>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400 italic bg-gray-50 p-2 rounded">
                                    Changes here are temporary and won't affect the saved recipe.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}