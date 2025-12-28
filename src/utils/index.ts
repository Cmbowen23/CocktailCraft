export function createPageUrl(pageName: string) {
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}

function attemptJSONParse(value: string, field: string, recipe: any) {
    if (!value) return null;

    try {
        return JSON.parse(value);
    } catch (e) {
        let cleaned = value.trim();

        cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        cleaned = cleaned.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, ':"$1"$2');
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

        try {
            return JSON.parse(cleaned);
        } catch (e2) {
            console.warn(`Failed to parse ${field} for recipe:`, recipe.name || recipe.id, 'Value:', value.substring(0, 100));
            return null;
        }
    }
}

export function parseRecipeData(recipe: any) {
    if (!recipe) return recipe;

    const parsed = { ...recipe };

    const jsonFields = ['ingredients', 'prep_actions', 'batch_settings', 'garnish', 'tags', 'allergens'];

    jsonFields.forEach(field => {
        if (parsed[field] && typeof parsed[field] === 'string') {
            const parsedValue = attemptJSONParse(parsed[field], field, recipe);

            if (parsedValue !== null) {
                parsed[field] = parsedValue;
            } else {
                parsed[field] = field === 'ingredients' || field === 'prep_actions' || field === 'tags' || field === 'allergens' ? [] : null;
            }
        }

        if (!parsed[field] && (field === 'ingredients' || field === 'prep_actions' || field === 'tags' || field === 'allergens')) {
            parsed[field] = [];
        }
    });

    return parsed;
}