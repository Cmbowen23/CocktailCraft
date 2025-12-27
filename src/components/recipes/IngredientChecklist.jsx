
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, X, Download } from "lucide-react";

export default function IngredientChecklist({ isOpen, onClose, menuId, recipes = [], allIngredients }) {
  const [checklist, setChecklist] = useState([]);
  const [checkedItems, setCheckedItems] = useState(new Set());
  
  const storageKey = `checklist-state-${menuId}`;

  // Load state from localStorage on component mount
  useEffect(() => {
    if (!menuId) return; // Only load if menuId is provided
    try {
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        setCheckedItems(new Set(JSON.parse(savedState)));
      } else {
        // If no saved state, ensure it's an empty set
        setCheckedItems(new Set());
      }
    } catch (error) {
      console.error("Failed to load checklist state:", error);
      // Fallback to empty set on error
      setCheckedItems(new Set());
    }
  }, [menuId, storageKey]); // Depend on menuId and storageKey

  // Save state to localStorage whenever checkedItems changes
  useEffect(() => {
    if (!menuId) return; // Only save if menuId is provided
    try {
      // Convert Set to Array for JSON serialization
      localStorage.setItem(storageKey, JSON.stringify(Array.from(checkedItems)));
    } catch (error) {
      console.error("Failed to save checklist state:", error);
    }
  }, [checkedItems, menuId, storageKey]); // Depend on checkedItems, menuId, and storageKey

  useEffect(() => {
    if (allIngredients && recipes) { // Added check for recipes
        generateChecklist();
    }
  }, [recipes, allIngredients]);
  
  const findMatchingIngredient = (ingredientName) => {
    if (!allIngredients || allIngredients.length === 0) return null;
    const normalizedName = ingredientName.toLowerCase().trim();
    return allIngredients.find(ing => ing.name.toLowerCase().trim() === normalizedName);
  };

  const formatCategory = (category) => {
    if (!category) return 'Other';
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  const generateChecklist = () => {
    const ingredientMap = new Map();

    (recipes || []).forEach(recipe => {
      recipe.ingredients?.forEach(ingredient => {
        const key = ingredient.ingredient_name.toLowerCase();
        const matchedIngredient = findMatchingIngredient(ingredient.ingredient_name);
        const category = matchedIngredient ? formatCategory(matchedIngredient.category) : 'Other';

        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key);
          existing.recipes.push(recipe.name);
          existing.totalAmount += ingredient.amount || 0;
        } else {
          ingredientMap.set(key, {
            name: ingredient.ingredient_name,
            unit: ingredient.unit,
            totalAmount: ingredient.amount || 0,
            recipes: [recipe.name],
            category: category
          });
        }
      });
    });

    const sortedIngredients = Array.from(ingredientMap.values())
      .sort((a, b) => a.category.localeCompare(b.category));

    setChecklist(sortedIngredients);
  };

  const handleCheck = (index) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedItems(newChecked);
  };

  const downloadChecklist = () => {
    const content = checklist.map(item => 
      `[ ] ${item.name} - ${item.totalAmount.toFixed(2)} ${item.unit} (Used in: ${item.recipes.join(', ')})`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ingredient-checklist.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedIngredients = checklist.reduce((acc, ingredient, index) => {
    if (!acc[ingredient.category]) {
      acc[ingredient.category] = [];
    }
    acc[ingredient.category].push({ ...ingredient, index });
    return acc;
  }, {});

  const categoryOrder = { 
    'Spirit': 1, 
    'Liqueur': 2, 
    'Bitters': 3, 
    'Syrup': 4, 
    'Juice': 5, 
    'Fresh': 6, 
    'Mixer': 7, 
    'Garnish': 8, 
    'Other': 99 
  };
  const sortedCategories = Object.entries(groupedIngredients).sort(([catA], [catB]) => {
      const orderA = categoryOrder[catA] || 99;
      const orderB = categoryOrder[catB] || 99;
      if (orderA !== orderB) {
          return orderA - orderB;
      }
      return catA.localeCompare(catB);
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-0 sm:max-w-4xl h-screen w-screen max-w-full rounded-none sm:h-auto sm:w-full sm:max-w-4xl sm:rounded-lg">
        <DialogHeader className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-6 h-6 text-blue-600" />
              <DialogTitle className="text-gray-900">
                Ingredient Checklist ({(recipes || []).length} recipes)
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadChecklist}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {sortedCategories.map(([category, ingredients]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{category}</h3>
              <div className="space-y-2">
                {ingredients.map((ingredient) => (
                  <div key={ingredient.index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <Checkbox
                      checked={checkedItems.has(ingredient.index)}
                      onCheckedChange={() => handleCheck(ingredient.index)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${checkedItems.has(ingredient.index) ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {ingredient.name}
                        </span>
                        <span className="text-blue-700 font-medium">
                          {ingredient.totalAmount.toFixed(2)} {ingredient.unit}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {ingredient.recipes.map((recipe, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {recipe}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-auto p-6 border-t">
          <div className="flex justify-between text-sm text-blue-600">
            <span>Progress: {checkedItems.size} of {checklist.length} items</span>
            <span>{checklist.length > 0 ? ((checkedItems.size / checklist.length) * 100).toFixed(0) : 0}% complete</span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${checklist.length > 0 ? (checkedItems.size / checklist.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
