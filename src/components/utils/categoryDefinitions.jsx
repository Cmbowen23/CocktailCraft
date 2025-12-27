export const cocktailCategories = [
  "classic", "modern", "tropical", "sour", "spirit_forward", "dessert", "low_abv", "signature"
];

export const ingredientCategories = [
  "syrup", "infusion", "shrub", "cordial", "bitters", "tincture", "oleo_saccharum", "foam", "garnish_prep", "wash", "clarification", "super_juice", "other"
];

export const difficulties = ["easy", "medium", "hard"];

export const spiritStyles = [
  "gin", "vodka", "rum", "whiskey", "tequila", "mezcal", "brandy", "liqueur", "apertif", "non-alcoholic", "split_base", "other"
];

export const isCocktail = (recipe) => {
    if (!recipe || !recipe.category) return false;
    return cocktailCategories.includes(recipe.category);
};

export const isSubRecipe = (recipe) => {
    if (!recipe || !recipe.category) return false;
    return ingredientCategories.includes(recipe.category);
};

export const alcoholicCategories = ["spirit", "liquor", "vermouth", "wine", "beer", "bitters"];

export const isAlcoholicIngredient = (ingredient) => {
    if (!ingredient) return false;
    // Check if ABV is a positive number
    const hasAbv = typeof ingredient.abv === 'number' && ingredient.abv > 0;
    // Check if category is in the alcoholic list
    const hasAlcoholicCategory = ingredient.category && alcoholicCategories.includes(ingredient.category.toLowerCase());
    return hasAbv || hasAlcoholicCategory;
};