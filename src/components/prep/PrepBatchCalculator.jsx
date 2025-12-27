import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronUp, ChevronDown, Zap, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import UnitAutocomplete from "@/components/ui/unit-autocomplete";
import { parseContainerSize } from '../utils/unitConverter';
import { convertToMl, convertWithCustomConversions } from '../utils/costCalculations';

const containerOptions = ["750ml Bottle", "1L Bottle", "375ml Bottle", "1 qt", "1.75L Handle", "5 Gallon Bucket", "3 Gallon Cambro", "2 Gallon Cambro", "1 Gallon Cambro"];

const formatNumber = (num) => num?.toFixed(2)?.replace(/\.00$/, '') || '';
const getUnitIncrement = (unit) => ({'ml': 1, 'cl': 1, 'l': 0.01, 'oz': 0.25, 'fl oz': 0.25, 'g': 1, 'kg': 0.001}[unit?.toLowerCase()] || 1);

// --- HELPER REQUIRED ---
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

const findMatchingIngredient = (name, allIngredients) => {
    if (!name || !allIngredients) return null;
    return allIngredients.find(ing => ing.name.toLowerCase() === name.toLowerCase());
};

// --- SYNCHRONIZED BARTENDER ALGORITHM ---
const findOptimalScaleFactor = (activeIngredients, batchIngredientUnits, allIngredients, containerVolumeMl) => {
    const batchIngredients = activeIngredients
        .map(ing => {
            const name = ing.ingredient_name || ing.name;
            return {
                name,
                originalMl: convertToMl(ing.amount, ing.unit, name, allIngredients),
                targetUnit: batchIngredientUnits[name] || 'ml',
                matchedIngredient: findMatchingIngredient(name, allIngredients),
                isSmall: ['dash', 'drop', 'spray', 'pinch'].includes(ing.unit?.toLowerCase())
            };
        })
        .filter(i => i.originalMl > 0);

    if (batchIngredients.length === 0) return 1;

    const singleBatchTotalMl = batchIngredients.reduce((sum, i) => sum + i.originalMl, 0);
    const maxScale = containerVolumeMl / singleBatchTotalMl;
    
    if (maxScale < 1) return 1;

    const baseIngredient = batchIngredients.reduce((prev, current) => (prev.originalMl > current.originalMl) ? prev : current);
    const baseAmountTargetUnit = convertWithCustomConversions(baseIngredient.originalMl, 'ml', baseIngredient.targetUnit, baseIngredient.matchedIngredient);
    const maxBaseAmount = baseAmountTargetUnit * maxScale;
    
    let bestScale = 1;
    let bestScore = -Infinity;
    
    const candidateScales = new Set([maxScale]);

    for (let amount = Math.floor(maxBaseAmount); amount > 0; amount -= 0.5) {
        if (amount <= 0) break;
        candidateScales.add(amount / baseAmountTargetUnit);
        if (amount / maxBaseAmount < 0.5) break; 
    }

    candidateScales.forEach(scale => {
        let score = 0;
        let isInvalid = false;

        for (const ing of batchIngredients) {
            if (ing.isSmall) continue; 

            const scaledMl = ing.originalMl * scale;
            const scaledAmount = convertWithCustomConversions(scaledMl, 'ml', ing.targetUnit, ing.matchedIngredient);
            
            const nearestQuarter = Math.round(scaledAmount * 4) / 4;
            const deviation = Math.abs(scaledAmount - nearestQuarter);
            
            if (scaledAmount > 0.5 && deviation / scaledAmount > 0.08) { isInvalid = true; break; }

            if (Math.abs(scaledAmount - Math.round(scaledAmount)) < 0.01) score += 10;
            else if (Math.abs(scaledAmount % 1 - 0.5) < 0.01) score += 5;
            
            score -= (deviation / scaledAmount) * 100;
        }

        const fillPercent = scale / maxScale;
        score += fillPercent * 20; 

        if (!isInvalid && score > bestScore) {
            bestScore = score;
            bestScale = scale;
        }
    });

    return bestScale;
};

export default function PrepBatchCalculator({
    recipe,
    ingredients: fallbackIngredients = [],
    initialMultiplier = 1,
    allIngredients = [],
    onCalculationUpdate
}) {
    // 1. READ SAVED SETTINGS
    const settings = recipe?.batch_settings || {};
    
    const [containerType, setContainerType] = useState(settings.container_type || "750ml Bottle");
    const [containerCount, setContainerCount] = useState(settings.container_count || 1);
    const [includeDilution, setIncludeDilution] = useState(settings.include_dilution || false);
    const [dilutionPercentage, setDilutionPercentage] = useState(settings.dilution_percentage ?? 25);
    const [constrainToTotalVolume, setConstrainToTotalVolume] = useState(settings.constrain_to_total_volume ?? true);
    
    // Scale Logic
    const [scaleFactor, setScaleFactor] = useState(initialMultiplier > 1 ? initialMultiplier : (settings.scale_factor || 1));
    const [isContainerCustom, setIsContainerCustom] = useState(settings.is_container_custom || false); 
    const [outputUnit, setOutputUnit] = useState('ml');
    
    // Custom Container Modal State
    const [showCustomContainerModal, setShowCustomContainerModal] = useState(false);
    const [customContainerName, setCustomContainerName] = useState("");
    const [customContainerVolume, setCustomContainerVolume] = useState("");
    const [customContainerUnit, setCustomContainerUnit] = useState("ml");
    
    // 2. FIX: Pre-populate Manual Amounts from Recipe "Instructions"
    // This ensures what you saw in the modal is what you see here
    const [manualAmounts, setManualAmounts] = useState(() => {
        if (settings.is_container_custom && settings.batch_ingredient_amounts) {
            return new Map(Object.entries(settings.batch_ingredient_amounts));
        }
        return new Map();
    });

    // 3. Identify Batch Ingredients
    const activeIngredients = useMemo(() => {
        const sourceIngredients = recipe?.ingredients || fallbackIngredients;
        const overrides = settings.ingredient_overrides || {};
        if (recipe && Object.keys(overrides).length > 0) {
            return sourceIngredients.filter(ing => overrides[ing.ingredient_name || ing.name] === 'batch');
        }
        return sourceIngredients;
    }, [recipe, fallbackIngredients, settings]);

    // 4. Lazy Init Units - Use saved or original units
    const [batchIngredientUnits, setBatchIngredientUnits] = useState(() => {
        const initial = {};
        const savedUnits = settings.batch_ingredient_units || {};
        activeIngredients.forEach(ing => {
            const name = ing.name || ing.ingredient_name;
            initial[name] = savedUnits[name] || ing.unit || 'ml';
        });
        return initial;
    });

    const handleUnitChange = useCallback((name, newUnit) => {
        const oldUnit = batchIngredientUnits[name] || 'ml';
        
        // Convert the current display amount to the new unit
        const matchedIngredient = findMatchingIngredient(name, allIngredients);
        
        if (manualAmounts.has(name)) {
            const currentAmount = manualAmounts.get(name);
            
            // Convert: current amount in old unit -> ml -> new unit
            const amountMl = convertToMl(currentAmount, oldUnit, name, allIngredients);
            const convertedAmount = convertWithCustomConversions(amountMl, 'ml', newUnit, matchedIngredient);
            
            // Check if conversion succeeded and is valid
            if (convertedAmount && !isNaN(convertedAmount) && convertedAmount > 0) {
                setManualAmounts(prev => new Map(prev).set(name, convertedAmount));
            }
        } else {
            // Also convert the calculated amount when changing units without manual override
            const ingredient = activeIngredients.find(i => (i.name || i.ingredient_name) === name);
            if (ingredient) {
                const ml1x = convertToMl(ingredient.amount, ingredient.unit, name, allIngredients);
                const scaledMl = ml1x * scaleFactor;
                
                // Direct conversion from ml to new unit (skip old unit)
                const convertedAmount = convertWithCustomConversions(scaledMl, 'ml', newUnit, matchedIngredient);
                
                // Set as manual amount only if conversion succeeded
                if (convertedAmount && !isNaN(convertedAmount) && convertedAmount > 0) {
                    setManualAmounts(prev => new Map(prev).set(name, convertedAmount));
                }
            }
        }
        
        setBatchIngredientUnits(prev => ({ ...prev, [name]: newUnit }));
    }, [batchIngredientUnits, manualAmounts, allIngredients, activeIngredients, scaleFactor]);

    // 5. Core Math
    const baseVolumeToScaleFromMl = useMemo(() => {
        let sum = 0;
        activeIngredients.forEach(ing => {
            const name = ing.name || ing.ingredient_name;
            sum += convertToMl(ing.amount, ing.unit, name, allIngredients);
        });
        return sum;
    }, [activeIngredients, allIngredients]);

    // Auto-scale on container change
    useEffect(() => {
        if (isContainerCustom) return;
        
        const totalContainerVolume = parseContainerSize(containerType) * containerCount;
        
        if (baseVolumeToScaleFromMl > 0 && totalContainerVolume > 0) {
            let targetConcentrateVolume;
            if (includeDilution && constrainToTotalVolume) {
                const dilutionRatio = 1 + (dilutionPercentage / 100);
                targetConcentrateVolume = totalContainerVolume / dilutionRatio;
            } else {
                targetConcentrateVolume = totalContainerVolume;
            }
            setScaleFactor(targetConcentrateVolume / baseVolumeToScaleFromMl);
            // Clear manual amounts when container changes to force recalculation
            setManualAmounts(new Map());
        } else {
            setScaleFactor(1);
        }
    }, [containerType, containerCount, isContainerCustom, includeDilution, dilutionPercentage, constrainToTotalVolume, baseVolumeToScaleFromMl]);

    const calculations = useMemo(() => {
        const batchVolume1x = baseVolumeToScaleFromMl;
        const currentConcentrateVolumeMl = batchVolume1x * scaleFactor;
        
        let dilutionWaterMl = 0;
        let finalDisplayVolumeMl = 0;

        if (includeDilution) {
            dilutionWaterMl = currentConcentrateVolumeMl * (dilutionPercentage / 100);
        }

        const volumePreClarification = currentConcentrateVolumeMl + dilutionWaterMl;

        if (constrainToTotalVolume && includeDilution && !isContainerCustom) {
             finalDisplayVolumeMl = parseContainerSize(containerType) * containerCount;
        } else {
             finalDisplayVolumeMl = volumePreClarification;
        }

        return {
            concentrateVolumeMl: currentConcentrateVolumeMl,
            dilutionWaterMl,
            finalDisplayVolumeMl
        };
    }, [scaleFactor, baseVolumeToScaleFromMl, includeDilution, dilutionPercentage, containerType, containerCount, isContainerCustom, constrainToTotalVolume]);

    // Notify Parent
    useEffect(() => {
        if (onCalculationUpdate) {
            onCalculationUpdate({
                yieldMl: calculations.finalDisplayVolumeMl,
                servings: scaleFactor,
                containerCount: isContainerCustom ? null : containerCount,
                containerType: isContainerCustom ? 'Custom' : containerType
            });
        }
    }, [calculations, onCalculationUpdate, scaleFactor, isContainerCustom, containerCount, containerType]);

    // Handlers
    const handleIngredientAmountChange = useCallback((name, newAmountRaw) => {
        const numValue = parseFloat(newAmountRaw);
        if (isNaN(numValue) || numValue < 0) return;

        setManualAmounts(prev => new Map(prev).set(name, numValue));

        if (name === 'Water (Dilution)') {
             const currentMl = convertToMl(numValue, batchIngredientUnits[name] || 'ml', name, allIngredients);
             if (calculations.concentrateVolumeMl > 0) {
                 setDilutionPercentage((currentMl / calculations.concentrateVolumeMl) * 100);
             }
             setIsContainerCustom(true);
             setContainerType("Custom");
             return;
        }

        const ingredient = activeIngredients.find(i => (i.name || i.ingredient_name) === name);
        if (!ingredient) return;

        const originalMl = convertToMl(ingredient.amount, ingredient.unit, name, allIngredients);
        const targetMl = convertToMl(numValue, batchIngredientUnits[name] || 'ml', name, allIngredients);
        
        if (originalMl > 0) {
            setScaleFactor(targetMl / originalMl);
            setIsContainerCustom(true);
            setContainerType("Custom");
        }
    }, [activeIngredients, batchIngredientUnits, allIngredients, calculations]);

    const handleEasyScale = () => {
        const containerVol = isContainerCustom 
            ? Math.max(calculations.finalDisplayVolumeMl, 750) 
            : parseContainerSize(containerType) * containerCount;

        const optimal = findOptimalScaleFactor(
            activeIngredients,
            batchIngredientUnits,
            allIngredients,
            containerVol
        );
        
        setScaleFactor(optimal);
        setIsContainerCustom(true);
        setContainerType("Custom");
        setManualAmounts(new Map()); // Reset manual so auto-rounding takes over
    };

    const renderRow = (name, amountMl, isSpecial = false) => {
        let displayUnit = batchIngredientUnits[name] || 'ml';
        
        // FIX: Display Manual Amount if exists, otherwise calculate from amountMl
        let displayAmount;
        if (manualAmounts.has(name)) {
            displayAmount = manualAmounts.get(name);
        } else {
            // If amountMl is invalid (0 or NaN), fall back to original recipe amount scaled
            if (!amountMl || isNaN(amountMl) || amountMl <= 0) {
                const ingredient = activeIngredients.find(i => (i.name || i.ingredient_name) === name);
                if (ingredient) {
                    displayAmount = parseFloat(ingredient.amount) * scaleFactor;
                    displayUnit = ingredient.unit || 'ml';
                } else {
                    displayAmount = 0;
                }
            } else {
                displayAmount = convertWithCustomConversions(amountMl, 'ml', displayUnit, findMatchingIngredient(name, allIngredients));
                // If conversion failed, try to use original recipe unit
                if (!displayAmount || isNaN(displayAmount) || displayAmount <= 0) {
                    const ingredient = activeIngredients.find(i => (i.name || i.ingredient_name) === name);
                    if (ingredient) {
                        displayAmount = parseFloat(ingredient.amount) * scaleFactor;
                        displayUnit = ingredient.unit || 'ml';
                    } else {
                        displayAmount = amountMl;
                        displayUnit = 'ml';
                    }
                }
            }
        }
        
        const finalDisplayValue = manualAmounts.has(name) 
            ? displayAmount 
            : (isContainerCustom ? roundToIncrement(displayAmount, [1, 0.5]) : displayAmount);
            
        const increment = getUnitIncrement(displayUnit);

        return (
            <div key={name} className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-lg border ${isSpecial ? 'bg-purple-50 border-purple-200' : 'bg-blue-50/70 border-blue-200/50'}`}>
                <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${isSpecial ? 'text-purple-900' : 'text-blue-900'}`}>{name}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleIngredientAmountChange(name, (finalDisplayValue - increment).toString())}>
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Input 
                        type="number" 
                        value={formatNumber(finalDisplayValue)} 
                        onChange={(e) => handleIngredientAmountChange(name, e.target.value)}
                        className="w-24 text-right bg-white"
                    />
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleIngredientAmountChange(name, (finalDisplayValue + increment).toString())}>
                        <ChevronUp className="w-4 h-4" />
                    </Button>
                    <div className="w-28">
                        <UnitAutocomplete value={displayUnit} onValueChange={(u) => handleUnitChange(name, u)} />
                    </div>
                </div>
            </div>
        );
    };

    const handleAddCustomContainer = () => {
        if (!customContainerName || !customContainerVolume) {
            alert("Please enter both container name and volume");
            return;
        }
        
        const volumeMl = convertToMl(parseFloat(customContainerVolume), customContainerUnit, null, allIngredients);
        const newContainerLabel = `${customContainerName} (${customContainerVolume}${customContainerUnit})`;
        
        // Add to container options
        if (!containerOptions.includes(newContainerLabel)) {
            containerOptions.push(newContainerLabel);
        }
        
        setContainerType(newContainerLabel);
        setIsContainerCustom(false);
        setShowCustomContainerModal(false);
        setCustomContainerName("");
        setCustomContainerVolume("");
        setCustomContainerUnit("ml");
    };

    return (
        <div className="space-y-6 py-2">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Container Type</Label>
                    <Select value={containerType} onValueChange={(val) => { setContainerType(val); if(val !== 'Custom') setIsContainerCustom(false); else setIsContainerCustom(true); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                             {isContainerCustom && <SelectItem value="Custom">Custom</SelectItem>}
                             {containerOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Count</Label>
                    <Input type="number" value={containerCount} onChange={e => { setContainerCount(Math.max(1, parseInt(e.target.value)||1)); setIsContainerCustom(false); }} disabled={isContainerCustom} />
                </div>
            </div>

            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowCustomContainerModal(true)}
                className="w-full border-dashed border-blue-300 text-blue-700 hover:bg-blue-50"
            >
                <Plus className="w-4 h-4 mr-2" />
                Add Container Type with Custom Volumes
            </Button>

            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
                 <div>
                     <Label className="text-xs text-gray-500 uppercase">Dilution</Label>
                     <div className="flex items-center gap-2 mt-1">
                         <Switch checked={includeDilution} onCheckedChange={(v) => { setIncludeDilution(v); setIsContainerCustom(true); }} />
                         <span className="text-sm font-medium">{includeDilution ? `${dilutionPercentage}%` : 'Off'}</span>
                     </div>
                 </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center">
                <div className="text-sm text-blue-700 font-semibold uppercase tracking-wide mb-2">Expected Yield</div>
                <div className="flex items-center justify-center gap-2">
                    <span className="text-4xl font-bold text-blue-900">
                        {(() => {
                            const ml = calculations.finalDisplayVolumeMl;
                            let converted;
                            if (outputUnit === 'ml') converted = ml;
                            else if (outputUnit === 'L') converted = ml / 1000;
                            else if (outputUnit === 'oz' || outputUnit === 'fl oz') converted = ml / 29.5735;
                            else if (outputUnit === 'qt') converted = ml / 946.353;
                            else if (outputUnit === 'gal') converted = ml / 3785.41;
                            else converted = ml;
                            return formatNumber(converted);
                        })()}
                    </span>
                    <Select value={outputUnit} onValueChange={setOutputUnit}>
                        <SelectTrigger className="w-24 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ml">ml</SelectItem>
                            <SelectItem value="L">L</SelectItem>
                            <SelectItem value="oz">oz</SelectItem>
                            <SelectItem value="fl oz">fl oz</SelectItem>
                            <SelectItem value="qt">qt</SelectItem>
                            <SelectItem value="gal">Gal</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Batch Ingredients</h3>
                    <Button variant="ghost" size="sm" onClick={handleEasyScale} className="text-amber-600"><Zap className="w-4 h-4 mr-2"/> Optimize</Button>
                </div>
                
                {activeIngredients.map(ing => {
                    const name = ing.name || ing.ingredient_name;
                    const ml1x = convertToMl(ing.amount, ing.unit, name, allIngredients);
                    return renderRow(name, ml1x * scaleFactor);
                })}

                {includeDilution && calculations.dilutionWaterMl > 0 && renderRow('Water (Dilution)', calculations.dilutionWaterMl, true)}
            </div>

            {/* Custom Container Modal */}
            {showCustomContainerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCustomContainerModal(false)}>
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold mb-4">Add Custom Container Type</h3>
                        <div className="space-y-4">
                            <div>
                                <Label>Container Name</Label>
                                <Input 
                                    value={customContainerName}
                                    onChange={(e) => setCustomContainerName(e.target.value)}
                                    placeholder="e.g., Large Jug, Mason Jar"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Volume</Label>
                                    <Input 
                                        type="number"
                                        value={customContainerVolume}
                                        onChange={(e) => setCustomContainerVolume(e.target.value)}
                                        placeholder="e.g., 500"
                                    />
                                </div>
                                <div>
                                    <Label>Unit</Label>
                                    <UnitAutocomplete 
                                        value={customContainerUnit}
                                        onValueChange={setCustomContainerUnit}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end pt-4">
                                <Button variant="outline" onClick={() => setShowCustomContainerModal(false)}>Cancel</Button>
                                <Button onClick={handleAddCustomContainer} className="bg-blue-600 hover:bg-blue-700">
                                    <Plus className="w-4 h-4 mr-2" />Add Container
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}