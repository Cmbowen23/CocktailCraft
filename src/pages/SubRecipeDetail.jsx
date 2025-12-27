import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Recipe } from '@/api/entities';
import { Ingredient } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Edit, Trash2, Copy } from 'lucide-react';
import { calculateIngredientCost, findMatchingIngredient } from '../components/utils/costCalculations';

const formatNumber = (num, precision = 2) => {
    const number = parseFloat(num);
    if (isNaN(number)) return "0.00";
    
    let formatted = number.toFixed(precision);
    if (precision > 0) {
        formatted = formatted.replace(/\.?0+$/, "");
    }
    return formatted;
};

export default function SubRecipeDetail() {
    const [recipe, setRecipe] = useState(null);
    const [allIngredients, setAllIngredients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const urlParams = new URLSearchParams(window.location.search);
    const recipeId = urlParams.get('id');
    const returnTo = urlParams.get('returnTo');

    const decodedReturnTo = useMemo(() => {
        return returnTo ? decodeURIComponent(returnTo) : null;
    }, [returnTo]);

    const loadData = useCallback(async () => {
        if (!recipeId) {
            setError("No recipe ID provided.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [recipeData, ingredientsData] = await Promise.all([
                Recipe.get(recipeId),
                Ingredient.list()
            ]);

            if (!recipeData) {
                setError("Sub-recipe not found.");
                setRecipe(null);
            } else {
                setRecipe(recipeData);
            }
            setAllIngredients(ingredientsData || []);
        } catch (err) {
            console.error("Error loading sub-recipe data:", err);
            setError("Failed to load data. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, [recipeId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDelete = async () => {
        if (!recipeId) return;
        if (window.confirm("Are you sure you want to delete this sub-recipe? This action cannot be undone.")) {
            try {
                await Recipe.delete(recipeId);
                window.location.href = createPageUrl("Recipes");
            } catch (err) {
                console.error("Failed to delete sub-recipe:", err);
                setError("Failed to delete the sub-recipe. Please try again.");
            }
        }
    };

    const copyToClipboard = () => {
        const yieldText = `${formatNumber(recipe.yield_amount, 2)} ${recipe.yield_unit}`;
        const ingredientsText = recipe.ingredients.map(ing => `- ${formatNumber(ing.amount, 2)} ${ing.unit} ${ing.ingredient_name}`).join('\n');
        const instructionsText = (recipe?.instructions || []).map((step, i) => `${i + 1}. ${step}`).join('\n');
        const textToCopy = `Sub-Recipe: ${recipe.name}\nYield: ${yieldText}\n\nIngredients:\n${ingredientsText}\n\nInstructions:\n${instructionsText}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert('Recipe copied to clipboard!');
        }, (err) => {
            console.error('Could not copy text: ', err);
        });
    };

    if (isLoading) {
        return <div className="p-8">Loading...</div>;
    }

    if (error) {
        return <div className="p-8 text-red-500">{error}</div>;
    }

    if (!recipe) {
        return (
            <div className="p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Sub-Recipe Not Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>The requested sub-recipe could not be found.</p>
                        <Link to={createPageUrl("Recipes")} className="mt-4 inline-block">
                            <Button variant="outline">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Recipes
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <Link to={decodedReturnTo || createPageUrl("Recipes")} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                <div className="flex gap-2">
                    <Link to={createPageUrl(`EditRecipe?id=${recipeId}`)}>
                        <Button variant="outline"><Edit className="w-4 h-4 mr-2" />Edit</Button>
                    </Link>
                    <Button variant="destructive" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
                </div>
            </div>

            <Card className="mb-6 bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold text-gray-900">{recipe.name}</CardTitle>
                    <CardDescription className="text-gray-600 pt-2">{recipe.description}</CardDescription>
                    <div className="pt-2 space-y-1">
                        <div>
                            <span className="text-sm font-medium text-gray-500">Total Yield: </span>
                            <span className="text-sm font-bold text-gray-900">
                                {recipe.yield_total_amount || recipe.yield_amount} {recipe.yield_total_unit || recipe.yield_unit}
                            </span>
                            {recipe.yield_basis && (
                                <span className="text-xs text-gray-500 ml-2">({recipe.yield_basis === 'final' ? 'Final' : 'Pre-Process'})</span>
                            )}
                        </div>
                        {(recipe.is_sellable_item || recipe.is_cocktail) && recipe.serving_size_amount && (
                            <div>
                                <span className="text-sm font-medium text-gray-500">Serving Size: </span>
                                <span className="text-sm font-bold text-emerald-700">
                                    {recipe.serving_size_amount || recipe.serving_size} {recipe.serving_size_unit || recipe.serving_unit}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                    ({Math.floor((recipe.yield_total_amount || recipe.yield_amount) / (recipe.serving_size_amount || recipe.serving_size))} servings per batch)
                                </span>
                            </div>
                        )}
                    </div>
                </CardHeader>
            </Card>

            <div className="space-y-6">
                {/* Instructions */}
                <Card className="border border-gray-200 shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle>Instructions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {(recipe.instructions || []).map((instruction, index) => (
                                <div key={index} className="flex gap-3 items-start">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-700 mt-1">{index + 1}</div>
                                    <p className="flex-1 pt-2 text-gray-800">{instruction}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Ingredients (Static) */}
                <Card className="border border-gray-200 shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Ingredients</CardTitle>
                        <Button variant="ghost" size="icon" onClick={copyToClipboard} title="Copy ingredients to clipboard">
                            <Copy className="w-4 h-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recipe.ingredients.filter(ing => ing.ingredient_role !== 'processing_agent').map((ingredient, index) => {
                                const matchedIngredient = findMatchingIngredient(ingredient.ingredient_name, allIngredients);
                                const cost = calculateIngredientCost(matchedIngredient, ingredient.amount, ingredient.unit);
                                
                                const isSellable = recipe.is_sellable_item || recipe.is_cocktail;
                                const servingSize = recipe.serving_size_amount || recipe.serving_size;
                                const totalYield = recipe.yield_total_amount || recipe.yield_amount;
                                const servingsPerBatch = servingSize > 0 ? totalYield / servingSize : 0;
                                const perServingAmount = servingsPerBatch > 0 ? ingredient.amount / servingsPerBatch : 0;
                                
                                return (
                                    <div key={index} className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                                        <div className="font-medium text-sm text-gray-700 mb-2 flex items-center justify-between">
                                            <span>{ingredient.ingredient_name}</span>
                                            {ingredient.ingredient_role && ingredient.ingredient_role !== 'other' && (
                                                <span className="text-xs text-gray-500 capitalize">
                                                    {ingredient.ingredient_role.replace('_', ' ')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900">{formatNumber(ingredient.amount)} {ingredient.unit}</span>
                                            {isSellable && servingsPerBatch > 0 && (
                                                <span className="text-xs text-emerald-700 font-medium">
                                                    ({formatNumber(perServingAmount, 2)} {ingredient.unit} per serving)
                                                </span>
                                            )}
                                            {cost > 0 && <span className="text-sm font-medium text-gray-500 ml-auto">${formatNumber(cost, 2)}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}