import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";
import { calculateRecipeCost, convertToMl, findMatchingIngredient, formatCurrency } from "../utils/costCalculations";

const formatAmountDisplay = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
};

export default function BuyerSpecSubRecipeCard({ recipe, allIngredients }) {
    const { totalCost, ingredientsWithCost: displayItems } = useMemo(() => {
        return calculateRecipeCost(recipe, allIngredients, 'single_spec');
    }, [recipe, allIngredients]);

    const metrics = useMemo(() => {
        let totalVolume = 0;
        let totalAlcoholVolume = 0;
        
        (displayItems || []).forEach(ing => {
            if (!ing.isBatch) {
                const mlAmount = convertToMl(ing.amount, ing.unit, ing.ingredient_name, allIngredients);
                totalVolume += mlAmount;
                
                const matchedIngredient = findMatchingIngredient(ing.ingredient_name, allIngredients);
                if (matchedIngredient && matchedIngredient.abv) {
                    totalAlcoholVolume += mlAmount * (matchedIngredient.abv / 100);
                }
            }
        });
        
        const dilutedVolume = totalVolume > 0 ? totalVolume * 1.25 : 0;
        const abv = dilutedVolume > 0 ? (totalAlcoholVolume / dilutedVolume) * 100 : 0;
        
        return {
            yieldAmount: recipe.yield_amount || (totalVolume / 29.5735),
            yieldUnit: recipe.yield_unit || 'oz',
            abv: abv,
        };
    }, [displayItems, allIngredients, recipe]);

    return (
        <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                    <FlaskConical className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-semibold text-emerald-700 text-sm">{recipe.name} (Sub-Recipe)</h3>
                </div>

                {/* Recipe Name */}
                <h4 className="text-lg font-semibold text-gray-800 mb-3">{recipe.name}</h4>
                {recipe.description && <p className="text-sm text-gray-600 mb-4">{recipe.description}</p>}

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Ingredients */}
                    <div className="md:col-span-2 space-y-2">
                        {displayItems.map((ing, index) => (
                            <div key={index} className="flex items-center justify-between py-1">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="w-6 font-medium text-right">{formatAmountDisplay(ing.amount || '0')}</span>
                                    <span className="w-6 text-gray-500 text-xs">{ing.unit || ''}</span>
                                    <span className="text-gray-700">{ing.ingredient_name || ''}</span>
                                </div>
                                <span className="text-xs font-medium text-green-600">${formatCurrency(ing.cost || 0)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Metrics */}
                    <div className="space-y-2">
                        <div className="bg-gray-50 p-2 rounded text-center">
                            <p className="text-xs text-gray-500">Yield</p>
                            <p className="text-sm font-semibold">{metrics.yieldAmount.toFixed(2)} {metrics.yieldUnit}</p>
                        </div>
                        
                        {metrics.abv > 0 && (
                            <div className="bg-gray-50 p-2 rounded text-center">
                                <p className="text-xs text-gray-500">ABV</p>
                                <p className="text-sm font-semibold">{metrics.abv.toFixed(1)}%</p>
                            </div>
                        )}
                        
                        <div className="bg-emerald-50 p-2 rounded text-center border border-emerald-200">
                            <p className="text-xs text-emerald-600">Total Cost</p>
                            <p className="text-base font-semibold text-emerald-800">${formatCurrency(totalCost)}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}