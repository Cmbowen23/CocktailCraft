
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Recipe } from "@/api/entities";
import RecipeForm from '../recipes/RecipeForm';

export default function SubRecipeFormPage({
    allIngredients = [],
    parentIngredientName = "", // Useful for initial naming when creating a new sub-recipe
    onAddIngredientCost
}) {
    // console.log('SubRecipeFormPage: onAddIngredientCost prop is:', onAddIngredientCost);

    const { id } = useParams(); // Get recipe ID from URL parameters for editing
    const navigate = useNavigate(); // Hook for navigation

    const [recipeToEdit, setRecipeToEdit] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (id) {
            // If an ID is present in the URL, fetch the existing recipe data
            setIsLoading(true);
            const fetchRecipe = async () => {
                try {
                    const fetchedRecipe = await Recipe.get(id); // Assuming Recipe.get(id) fetches a single recipe by ID
                    if (fetchedRecipe) {
                        setRecipeToEdit(fetchedRecipe);
                    } else {
                        setError("Recipe not found.");
                    }
                } catch (err) {
                    console.error("Error fetching sub-recipe:", err);
                    setError("Failed to load sub-recipe.");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchRecipe();
        } else {
            // No ID, so we are creating a new recipe
            setIsLoading(false);
        }
    }, [id]);

    const handleSubmit = async (recipeData) => {
        try {
            if (id) {
                // If ID exists, update the existing recipe
                await Recipe.update(id, recipeData);
            } else {
                // Otherwise, create a new recipe
                await Recipe.create(recipeData);
            }
            // After successful save, navigate back to the previous page or a specific route
            navigate(-1); 
        } catch (error) {
            console.error("Error saving sub-recipe:", error);
            // Optionally, set an error state to display to the user
        }
    };

    // Determine the initial recipe data for the form
    const recipeForForm = recipeToEdit || {
        name: parentIngredientName || "", // Pre-fill name if parentIngredientName is provided
        description: "",
        category: "syrup", // Default category for sub-recipes
        ingredients: [{ ingredient_name: "", amount: "", unit: "ml", notes: "" }],
        instructions: [""],
        yield_amount: 0,
        yield_unit: "ml"
    };

    if (isLoading) {
        return <div className="container mx-auto p-4 text-center">Loading recipe...</div>;
    }

    if (error) {
        return <div className="container mx-auto p-4 text-center text-red-600">Error: {error}</div>;
    }

    return (
        <div className="container mx-auto p-4 max-w-4xl"> {/* Use a div as the main container for the page content */}
            <h1 className="text-3xl font-bold mb-6 text-center">
                {id ? `Edit Sub-Recipe: ${recipeToEdit?.name || 'Loading...'}` : `Create Sub-Recipe: ${parentIngredientName}`}
            </h1>
            <RecipeForm
                recipe={recipeForForm}
                allIngredients={allIngredients}
                isSubRecipe={true}
                onSubmit={handleSubmit}
                onCancel={() => navigate(-1)} // On cancel, navigate back
                onAddIngredientCost={onAddIngredientCost}
            />
        </div>
    );
}
