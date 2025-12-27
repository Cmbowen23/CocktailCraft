
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Scale, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Recipe } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { convertToMl, calculateRecipeCost, findMatchingIngredient, formatCurrency } from "../utils/costCalculations";

const formatAmountDisplay = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(2);
};

const getIngredientCostStatus = (ingredientName, allIngredients) => {
    const exemptIngredients = ['water', 'filtered water', 'tap water', 'ice', 'soda water'];
    if (!ingredientName || !ingredientName.trim()) return null;
    const normalizedName = ingredientName.toLowerCase().trim();
    if (exemptIngredients.some(exempt => normalizedName.includes(exempt.toLowerCase()))) return 'has_cost';
    
    const match = findMatchingIngredient(ingredientName, allIngredients);
    if (!match) return 'not_found';
    
    const costPerUnit = parseFloat(match.cost_per_unit) || 0;
    return costPerUnit > 0 ? 'has_cost' : 'no_cost';
};

export default function BuyerSpecRecipeCard({ recipe, allIngredients = [], allRecipes = [], onRecipeUpdate }) {
    const [customPrice, setCustomPrice] = useState(recipe.menu_price || '');
    const [isEditingPrice, setIsEditingPrice] = useState(false);

    const singleSpecDetails = useMemo(() => {
        const { totalCost, ingredientsWithCost } = calculateRecipeCost(recipe, allIngredients);
        
        let totalAlcoholMl = 0, totalVolumeMl = 0, totalVolumeMlForYield = 0;
        
        ingredientsWithCost.forEach((ing) => {
            const volumeInMl = convertToMl(ing.amount, ing.unit, ing.ingredient_name, allIngredients);
            if (volumeInMl > 0) {
                totalVolumeMl += volumeInMl;
                if (ing.unit?.toLowerCase().trim() !== 'dash') {
                    totalVolumeMlForYield += volumeInMl;
                }
                const matchedIngredient = findMatchingIngredient(ing.ingredient_name, allIngredients);
                if (matchedIngredient) {
                    if (matchedIngredient.abv && parseFloat(matchedIngredient.abv) > 0) {
                        totalAlcoholMl += volumeInMl * (parseFloat(matchedIngredient.abv) / 100);
                    } else if (matchedIngredient.ingredient_type === 'sub_recipe' && matchedIngredient.sub_recipe_id) {
                        const subRecipe = allRecipes.find(r => r.id === matchedIngredient.sub_recipe_id);
                        if (subRecipe?.abv > 0) {
                            totalAlcoholMl += volumeInMl * (parseFloat(subRecipe.abv) / 100);
                        }
                    }
                }
            }
        });

        let finalVolumeMl = totalVolumeMl > 0 ? totalVolumeMl * 1.25 : 0;
        const abv = finalVolumeMl > 0 ? (totalAlcoholMl / finalVolumeMl) * 100 : 0;
        const yieldAmountInOz = totalVolumeMlForYield / 29.5735;
        const hasMissingCost = ingredientsWithCost.some(ing => getIngredientCostStatus(ing.ingredient_name, allIngredients) !== 'has_cost');
        const suggestedPrice = totalCost > 0 ? Math.ceil(totalCost * 5) : 0; // Updated to 5x markup for consistency
        
        const effectivePrice = parseFloat(customPrice) > 0 ? parseFloat(customPrice) : 0;

        const pourCost = effectivePrice > 0 ? (totalCost / effectivePrice) * 100 : 0;
        const profit = effectivePrice - totalCost;

        return { ingredients: ingredientsWithCost, totalCost, abv, yieldAmount: yieldAmountInOz, hasMissingCost, suggestedPrice, pourCost, profit, effectivePrice };
    }, [recipe, allIngredients, allRecipes, customPrice]);

    const handlePriceChange = (e) => {
        setCustomPrice(e.target.value);
    };

    const handlePriceUpdate = async () => {
        setIsEditingPrice(false);
        const newPrice = parseFloat(customPrice);
        const priceToSave = isNaN(newPrice) || newPrice <= 0 ? null : newPrice;
        
        // Only update if the price has actually changed
        if (priceToSave !== recipe.menu_price) {
            try {
                const updatedRecipe = await Recipe.update(recipe.id, { menu_price: priceToSave });
                if (onRecipeUpdate) {
                    onRecipeUpdate(updatedRecipe);
                }
            } catch (error) {
                console.error("Failed to update price:", error);
                setCustomPrice(recipe.menu_price || ''); // Revert on error
            }
        }
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handlePriceUpdate();
        } else if (e.key === 'Escape') {
            setCustomPrice(recipe.menu_price || '');
            setIsEditingPrice(false);
        }
    };

    const hasCustomPrice = recipe?.menu_price && recipe.menu_price > 0;

    return (
        <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm overflow-hidden w-full print-card print-bg-white print-break-inside-avoid">
            <CardHeader className="bg-white/50 print-bg-white">
                <CardTitle className="text-xl sm:text-2xl font-bold text-emerald-900 break-words print-text-black">{recipe?.name || 'Unknown Recipe'}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    {/* Left Column: Ingredients */}
                    <div className="space-y-4 min-w-0">
                        <div className="flex items-center gap-2 font-medium text-gray-600 text-sm">
                            <span>Yield:</span>
                            <span className="text-emerald-800 font-bold">{singleSpecDetails.yieldAmount.toFixed(2)} oz</span>
                            <Scale className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="space-y-3">
                            {singleSpecDetails.ingredients.map((ing, index) => {
                                const costStatus = getIngredientCostStatus(ing.ingredient_name, allIngredients);
                                const needsCostAttention = costStatus === 'no_cost' || costStatus === 'not_found';
                                const displayIngredientText = ing.prep_action && !['pour', 'none', 'add', 'mix'].includes(ing.prep_action.toLowerCase()) ? `${ing.ingredient_name} (${ing.prep_action})` : (ing.ingredient_name || '');
                                
                                return (
                                    <div key={index} className={`flex items-center justify-between gap-2 p-2 rounded-md bg-gray-50/70 min-w-0`}>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-12 text-center font-bold text-emerald-800 text-sm flex-shrink-0">{formatAmountDisplay(ing.amount || '0')}</div>
                                            <span className="w-8 text-gray-500 text-xs flex-shrink-0">{ing.unit || ''}</span>
                                            <div className="flex-1 min-w-0 font-medium text-emerald-800 text-sm break-words">{displayIngredientText}</div>
                                        </div>
                                        <div className={`font-bold text-xs ${needsCostAttention ? 'text-red-500' : 'text-green-600'} flex-shrink-0`}>${formatCurrency(ing.cost || 0)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Right Column: Financials */}
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded-lg text-center print-bg-white border">
                            <div className="text-gray-600 font-medium text-xs">ABV (25% dilution)</div>
                            <div className="text-lg font-bold text-gray-900">{singleSpecDetails.abv.toFixed(1)}%</div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 print-bg-white border border-emerald-200">
                            <h4 className="font-semibold text-emerald-800 mb-4 print-text-black">Financial Details</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-emerald-700 print-text-black">Recipe Cost</span>
                                    <div className="flex items-center gap-2">
                                      {singleSpecDetails.hasMissingCost && <AlertTriangle className="w-4 h-4 text-red-500" title="Cost is incomplete" />}
                                      <span className="text-lg font-bold text-emerald-900 print-text-black">${formatCurrency(singleSpecDetails.totalCost)}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-emerald-700 print-text-black">
                                        {hasCustomPrice ? 'Menu Price' : 'Suggested Menu Price'}
                                    </span>
                                    <div className="text-lg font-bold text-emerald-900 print-text-black flex items-center">
                                        <span>$</span>
                                        {isEditingPrice ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={customPrice}
                                                onChange={handlePriceChange}
                                                onBlur={handlePriceUpdate}
                                                onKeyDown={handleKeyDown}
                                                autoFocus
                                                className="bg-transparent border-none outline-none text-right ml-0"
                                                style={{ 
                                                    fontSize: '1.125rem', 
                                                    fontWeight: '700',
                                                    color: 'inherit',
                                                    width: '4rem',
                                                    padding: '0',
                                                    margin: '0'
                                                }}
                                            />
                                        ) : (
                                            <span 
                                                className="cursor-pointer hover:bg-emerald-100/30 rounded px-1 ml-0"
                                                onClick={() => setIsEditingPrice(true)}
                                            >
                                                {formatCurrency(singleSpecDetails.effectivePrice || singleSpecDetails.suggestedPrice)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {singleSpecDetails.effectivePrice > 0 && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-emerald-700 print-text-black">Pour Cost</span>
                                            <span className="text-lg font-bold text-emerald-900 print-text-black">{singleSpecDetails.pourCost.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-emerald-700 print-text-black">Profit</span>
                                            <span className="text-lg font-bold text-emerald-900 print-text-black">${formatCurrency(singleSpecDetails.profit)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Details Section */}
                <div className="mt-8 pt-6 border-t border-gray-200 space-y-4 print-no-border">
                    {recipe.instructions && recipe.instructions.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Instructions:</h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                                {recipe.instructions.map((step, idx) => (<li key={idx}>{step}</li>))}
                            </ol>
                        </div>
                    )}
                    {recipe.garnish && (
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-1">Garnish:</h4>
                            <p className="text-sm text-gray-600">{recipe.garnish}</p>
                        </div>
                    )}
                    {recipe.glassware && (
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-1">Glassware:</h4>
                            <p className="text-sm text-gray-600">{recipe.glassware}</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
