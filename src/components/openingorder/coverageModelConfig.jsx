export const coverageModel = [
  // Base Spirits - Vodka
  {
    id: "wellVodka",
    label: "Well Vodka",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Vodka", tier: "well" },
    minQuantity: 1,
  },
  {
    id: "callVodka",
    label: "Call Vodka",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Vodka", tier: "call" },
    minQuantity: 1,
  },

  // Base Spirits - Gin
  {
    id: "londonDryGin",
    label: "London Dry Gin",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Gin", style: "London Dry" },
    minQuantity: 1,
  },

  // Base Spirits - Rum
  {
    id: "whiteRum",
    label: "White Rum",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Rum", style: "White" },
    minQuantity: 1,
  },
  {
    id: "darkRum",
    label: "Dark Rum",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Rum", style: "Dark" },
    minQuantity: 1,
  },

  // Base Spirits - Whiskey
  {
    id: "bourbon",
    label: "Bourbon",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Whiskey", style: "Bourbon" },
    minQuantity: 1,
  },
  {
    id: "rye",
    label: "Rye Whiskey",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Whiskey", style: "Rye" },
    minQuantity: 1,
  },
  {
    id: "irishWhiskey",
    label: "Irish Whiskey",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Whiskey", substyle: "Irish" },
    minQuantity: 1,
  },
  {
    id: "scotch",
    label: "Scotch",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Whiskey", style: "Scotch" },
    minQuantity: 1,
  },

  // Base Spirits - Tequila
  {
    id: "blancoTequila",
    label: "Blanco Tequila",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Tequila", style: "Blanco" },
    minQuantity: 1,
  },
  {
    id: "reposadoTequila",
    label: "Reposado Tequila",
    category: "Base Spirits",
    criteria: { category: "Spirit", spirit_type: "Tequila", style: "Reposado" },
    minQuantity: 1,
  },

  // Modifiers - Vermouth
  {
    id: "sweetVermouth",
    label: "Sweet Vermouth",
    category: "Modifiers",
    criteria: { category: "Vermouth", style: "Sweet" },
    minQuantity: 1,
  },
  {
    id: "dryVermouth",
    label: "Dry Vermouth",
    category: "Modifiers",
    criteria: { category: "Vermouth", style: "Dry" },
    minQuantity: 1,
  },

  // Modifiers - Liqueurs
  {
    id: "orangeLiqueur",
    label: "Orange Liqueur",
    category: "Modifiers",
    criteria: { category: "Liqueur", spirit_type: "Orange Liqueur" },
    minQuantity: 1,
  },
  {
    id: "aperitivo",
    label: "Aperitivo",
    category: "Modifiers",
    criteria: { category: "Liqueur", style: "Aperitivo" },
    minQuantity: 1,
  },
  {
    id: "bitterAmaro",
    label: "Bitter Amaro",
    category: "Modifiers",
    criteria: { category: "Liqueur", style: "Amaro" },
    minQuantity: 1,
  },
  {
    id: "fernet",
    label: "Fernet (Optional)",
    category: "Modifiers",
    criteria: { category: "Liqueur", substyle: "Fernet" },
    minQuantity: 0,
    optional: true,
  },
];

export function evaluateCoverage(orderItems, allIngredients) {
  return coverageModel.map(slot => {
    const matchingItems = orderItems.filter(item => {
      const ingredient = allIngredients.find(ing => ing.id === item.ingredient_id);
      if (!ingredient) return false;

      return Object.entries(slot.criteria).every(([key, value]) => {
        const ingredientValue = ingredient[key];
        if (!ingredientValue) return false;
        return ingredientValue.toLowerCase() === value.toLowerCase();
      });
    });

    const totalQuantity = matchingItems.reduce((sum, item) => {
      if (item.unit === 'case') {
        const ingredient = allIngredients.find(ing => ing.id === item.ingredient_id);
        return sum + (item.quantity * (ingredient?.bottles_per_case || 1));
      }
      return sum + (item.quantity || 0);
    }, 0);

    let status = 'missing';
    if (totalQuantity >= slot.minQuantity && slot.minQuantity > 0) {
      status = 'complete';
    } else if (totalQuantity > 0) {
      status = 'partial';
    }

    // Get suggestions for missing or partial slots
    const suggestions = (status === 'missing' || status === 'partial') 
      ? allIngredients.filter(ing => {
          return Object.entries(slot.criteria).every(([key, value]) => {
            const ingredientValue = ing[key];
            if (!ingredientValue) return false;
            return ingredientValue.toLowerCase() === value.toLowerCase();
          });
        }).slice(0, 5) // Limit to 5 suggestions
      : [];

    return {
      ...slot,
      status,
      currentQuantity: totalQuantity,
      matchingItems,
      suggestions,
    };
  });
}