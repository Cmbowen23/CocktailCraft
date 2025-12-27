export const generateRecipeHtml = (recipe) => {
    let html = '';
    
    // Style based on type
    const isSubRecipe = ['sub_recipe', 'syrup', 'infusion', 'prep', 'cordial', 'batch'].includes(recipe.category);
    
    if (isSubRecipe) {
         html += `<h2 style="font-size: 2.2em; font-weight: 900; margin-top: 1em; border-bottom: 2px solid #ccc;">${recipe.name}</h2>`;
    } else {
         html += `<h3 style="font-weight: 800; font-size: 1.5em; margin-bottom: 0.5em;">${recipe.name}</h3>`;
    }

    if (recipe.description) {
        html += `<p><em>${recipe.description}</em></p>`;
    }
    
    if (recipe.yield_amount) {
         html += `<p><strong>Yield:</strong> ${recipe.yield_amount} ${recipe.yield_unit || ''}</p>`;
    }

    html += `<h4>Ingredients</h4><ul>`;
    (recipe.ingredients || []).forEach(ing => {
        html += `<li>${ing.amount} ${ing.unit} ${ing.ingredient_name} ${ing.notes ? `(${ing.notes})` : ''}</li>`;
    });
    html += `</ul>`;

    if (recipe.instructions && recipe.instructions.length > 0) {
        html += `<h4>Instructions</h4><ol>`;
        recipe.instructions.forEach(step => html += `<li>${step}</li>`);
        html += `</ol>`;
    }
    
    if (!isSubRecipe) {
         if (recipe.glassware) html += `<p><strong>Glassware:</strong> ${recipe.glassware}</p>`;
         if (recipe.garnish) html += `<p><strong>Garnish:</strong> ${recipe.garnish}</p>`;
    }
    
    html += `<p><br/></p><hr/><p><br/></p>`;
    
    return html;
};