import { Ingredient } from "@/api/entities";
import { Recipe } from "@/api/entities";

export const updateIngredientAndPropagate = async (oldIngredient, newIngredientData) => {
    if (!oldIngredient || !newIngredientData) {
        throw new Error("Old and new ingredient data must be provided.");
    }
    
    // Check if name has changed
    if (oldIngredient.name !== newIngredientData.name) {
        const allRecipes = await Recipe.list();

        const recipesToUpdate = allRecipes.filter(recipe => 
          recipe.ingredients.some(ing => ing.ingredient_name === oldIngredient.name)
        );

        if (recipesToUpdate.length > 0) {
            const updatePromises = recipesToUpdate.map(recipe => {
              const newIngredients = recipe.ingredients.map(ing => {
                if (ing.ingredient_name === oldIngredient.name) {
                  return { ...ing, ingredient_name: newIngredientData.name };
                }
                return ing;
              });
              return Recipe.update(recipe.id, { ingredients: newIngredients });
            });

            await Promise.all(updatePromises);
        }
    }

    // Finally, update the ingredient itself
    await Ingredient.update(oldIngredient.id, newIngredientData);
};