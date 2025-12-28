export function createPageUrl(pageName: string) {
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}

export function parseRecipeData(recipe: any) {
    if (!recipe) return recipe;

    const parsed = { ...recipe };

    const jsonFields = ['ingredients', 'prep_actions', 'batch_settings', 'garnish', 'tags', 'allergens'];

    jsonFields.forEach(field => {
        if (parsed[field] && typeof parsed[field] === 'string') {
            try {
                parsed[field] = JSON.parse(parsed[field]);
            } catch (e) {
                console.warn(`Failed to parse ${field} for recipe:`, recipe.name || recipe.id, e);
                parsed[field] = field === 'ingredients' || field === 'prep_actions' || field === 'tags' || field === 'allergens' ? [] : null;
            }
        }

        if (!parsed[field] && (field === 'ingredients' || field === 'prep_actions' || field === 'tags' || field === 'allergens')) {
            parsed[field] = [];
        }
    });

    return parsed;
}