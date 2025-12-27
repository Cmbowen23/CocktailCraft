import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Ingredient } from "@/api/entities";
import { Recipe } from "@/api/entities";
import IngredientForm from './IngredientForm';
import { saveIngredientWithPrepActions } from './ingredientManagementService';
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { isSubRecipe } from "../utils/categoryDefinitions";
import { BookOpen, FlaskConical, ExternalLink } from "lucide-react";

export default function AddIngredientModal({ 
    ingredientName, 
    ingredientId = null,
    allIngredients, 
    allRecipes, 
    onSave, 
    onClose, 
    customCategories = [], 
    onCategoryAdded,
    // New props for recipe context
    contextRecipeId = null,
    originalIngredientName = null
}) {
    const [ingredient, setIngredient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const hasInitialized = React.useRef(false);

    useEffect(() => {
        if (hasInitialized.current) return;
        
        const findIngredient = () => {
            const defaultNewIngredient = { 
                name: ingredientName, 
                category: 'other',
                unit: 'oz', 
                ingredient_type: 'purchased' 
            };

            if (ingredientName && allIngredients?.length > 0) {
                let match = null;
                if (ingredientId) {
                    match = allIngredients.find(ing => ing.id === ingredientId);
                }
                if (!match) {
                    const normalizedName = ingredientName.toLowerCase().trim();
                    match = allIngredients.find(ing => ing.name.toLowerCase().trim() === normalizedName);
                }
                setIngredient(match || defaultNewIngredient);
            } else {
                setIngredient(defaultNewIngredient);
            }
            setIsLoading(false);
            hasInitialized.current = true;
        };
        findIngredient();
    }, [ingredientName, allIngredients, ingredientId]);

    const recipesUsingIngredient = useMemo(() => {
        if (!ingredient?.name || !allRecipes?.length) {
            return [];
        }
        const ingredientNameLower = ingredient.name.toLowerCase().trim();
        return allRecipes.filter(recipe => 
            recipe.ingredients?.some(ing => ing.ingredient_name?.toLowerCase().trim() === ingredientNameLower)
        );
    }, [ingredient, allRecipes]);

    const cocktailsUsingIngredient = recipesUsingIngredient.filter(r => !isSubRecipe(r));
    const subRecipesUsingIngredient = recipesUsingIngredient.filter(r => isSubRecipe(r));

    const handleSaveIngredient = async (formData) => {
        setIsSaving(true);
        try {
            const savedIngredient = await saveIngredientWithPrepActions(formData);
            
            // If we have recipe context and the ingredient name changed, update the recipe
            if (contextRecipeId && originalIngredientName && savedIngredient.name !== originalIngredientName) {
                await updateRecipeIngredientName(contextRecipeId, originalIngredientName, savedIngredient.name);
            }
            
            onSave();
        } catch (error) {
            console.error("Error saving ingredient:", error);
            // Even if it fails, call onSave to trigger a refresh which might resolve state issues
            onSave(); 
        } finally {
            setIsSaving(false);
        }
    };

    const updateRecipeIngredientName = async (recipeId, oldName, newName) => {
        try {
            // Get the current recipe
            const recipe = await Recipe.get(recipeId);
            if (!recipe || !recipe.ingredients) return;

            // Normalize names for comparison (case-insensitive, trimmed)
            const normalizeIngredientName = (name) => {
                return name ? name.toLowerCase().trim() : '';
            };

            const normalizedOldName = normalizeIngredientName(oldName);
            const normalizedNewName = normalizeIngredientName(newName);

            // Only proceed if names are actually different after normalization
            if (normalizedOldName === normalizedNewName) {
                console.log(`Ingredient name "${oldName}" is effectively the same as "${newName}" after normalization. No recipe update needed.`);
                return;
            }

            // Update the ingredient name in the recipe's ingredients array
            let updated = false;
            const updatedIngredients = recipe.ingredients.map(ingredient => {
                const currentIngredientName = normalizeIngredientName(ingredient.ingredient_name);
                
                // Find matching ingredient using normalized comparison
                if (currentIngredientName === normalizedOldName) {
                    updated = true;
                    return { 
                        ...ingredient, 
                        ingredient_name: newName // Use the exact new name (preserve capitalization)
                    };
                }
                return ingredient;
            });

            // Only update the recipe if we actually found and changed an ingredient
            if (updated) {
                await Recipe.update(recipeId, { ingredients: updatedIngredients });
                console.log(`Updated recipe ${recipeId}: Changed ingredient "${oldName}" to "${newName}"`);
            } else {
                console.log(`Recipe ${recipeId} did not contain ingredient "${oldName}". No update performed.`);
            }
        } catch (error) {
            console.error("Error updating recipe ingredient name:", error);
            // Don't throw - this is a nice-to-have feature, not critical
        }
    };
    
    const handleCreateOrEditSubRecipe = () => {
        const recipeId = ingredient?.sub_recipe_id;
        const returnTo = encodeURIComponent(window.location.href);
        let url;

        if (recipeId) {
            // We have a linked sub-recipe, so edit it.
            url = createPageUrl(`CreateSubRecipe?id=${recipeId}&returnTo=${returnTo}`);
        } else {
            // No sub-recipe is linked, so create a new one.
            // Pass the ingredient name to pre-populate the new sub-recipe.
            const newRecipeName = encodeURIComponent(ingredient.name);
            
            const params = new URLSearchParams({
                name: newRecipeName,
                returnTo: returnTo
            });

            if (ingredient && ingredient.id) {
                params.append('ingredientId', ingredient.id);
            }
        
            url = createPageUrl(`CreateSubRecipe?${params.toString()}`);
        }
        
        window.location.href = url;
    };

    return (
        <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {ingredient?.id ? `Edit Ingredient: ${ingredient.name}` : `Add New Ingredient: ${ingredientName}`}
                    </DialogTitle>
                    <DialogDescription>
                       Manage ingredient details, cost, and type. For house-made ingredients, link them to a sub-recipe.
                    </DialogDescription>
                </DialogHeader>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">Loading...</div>
                ) : (
                    <>
                        <IngredientForm
                            ingredient={ingredient}
                            allRecipes={allRecipes || []}
                            allIngredients={allIngredients || []}
                            customCategories={customCategories}
                            onCategoryAdded={onCategoryAdded}
                            onSubmit={handleSaveIngredient}
                            onCancel={onClose}
                            isSaving={isSaving}
                            lockName={!!ingredient?.id}
                        />

                        {recipesUsingIngredient.length > 0 && (
                            <div className="mt-6 pt-6 border-t">
                                <h3 className="text-lg font-semibold text-gray-800 mb-3">Used In Recipes</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-h-56 overflow-y-auto p-2 bg-gray-50/70 rounded-lg">
                                    {cocktailsUsingIngredient.length > 0 && (
                                        <div>
                                            <h4 className="font-medium text-gray-600 mb-2 flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-blue-600" />
                                                Cocktails
                                            </h4>
                                            <ul className="space-y-1 text-sm list-disc pl-5">
                                                {cocktailsUsingIngredient.map(recipe => (
                                                    <li key={recipe.id}>
                                                        <Link to={createPageUrl(`EditRecipe?id=${recipe.id}`)} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                                                            {recipe.name}
                                                            <ExternalLink className="w-3 h-3" />
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {subRecipesUsingIngredient.length > 0 && (
                                        <div>
                                            <h4 className="font-medium text-gray-600 mb-2 flex items-center gap-2">
                                                <FlaskConical className="w-4 h-4 text-blue-600" />
                                                Sub-Recipes
                                            </h4>
                                            <ul className="space-y-1 text-sm list-disc pl-5">
                                                {subRecipesUsingIngredient.map(recipe => (
                                                    <li key={recipe.id}>
                                                        <Link to={createPageUrl(`EditRecipe?id=${recipe.id}`)} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                                                            {recipe.name}
                                                            <ExternalLink className="w-3 h-3" />
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}