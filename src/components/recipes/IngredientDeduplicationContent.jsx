import React, { useState, useEffect } from 'react';
import { PlusCircle, Loader2, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import IngredientSearch from "./IngredientSearch";

// Mock Ingredient object for demonstration/testing purposes.
// In a real application, this would typically be an API client, ORM model, or a service.
const Ingredient = {
  create: async (data) => {
    console.log("Mock Ingredient.create called with:", data);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    // Simulate successful creation with a unique ID
    return { id: `mock-${Math.random().toString(36).substring(2, 9)}`, ...data };
  }
};

export default function IngredientDeduplicationContent({
  newIngredients = [],
  existingIngredients = [],
  onComplete,
  onCancel
}) {
  // ingredientResolutions will store the user's selected action (create or map)
  // for each original ingredient name.
  // The key will be the original ingredient name (ingredient.name), and the value
  // will be an object like { action: 'create' } or { action: 'map', matchedName: 'existing_ingredient_name' }.
  const [ingredientResolutions, setIngredientResolutions] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // When the list of newIngredients changes (e.g., a new import is started),
  // reset the ingredientResolutions to ensure a clean state for the new batch.
  useEffect(() => {
    setIngredientResolutions({});
  }, [newIngredients]);

  /**
   * Handles the resolution change for a specific ingredient.
   * Updates the local state to reflect the user's chosen action (create or match).
   * @param {string} ingredientName - The original name of the ingredient from the import.
   * @param {'create' | 'match'} action - The action chosen by the user.
   * @param {string} [matchedName] - The name of the existing ingredient if action is 'match'.
   */
  const handleResolutionChange = (ingredientName, action, matchedName = null) => {
    setIngredientResolutions(prev => ({
      ...prev,
      [ingredientName]: { action, matchedName }
    }));
  };

  /**
   * Processes the final resolutions when the "Complete Mapping" button is clicked.
   * It iterates through all new ingredients, determines their final resolution,
   * and immediately saves any new ingredients to the database as they are processed.
   */
  const handleComplete = async () => {
    setIsSaving(true);
    const finalResolutions = {};

    // Iterate through all new ingredients to determine their final resolution
    // and perform immediate saves for 'create' actions.
    for (const ingredient of newIngredients) {
      const resolution = ingredientResolutions[ingredient.name];

      if (resolution) {
        finalResolutions[ingredient.name] = resolution;

        // If the resolution is to 'create' a new ingredient, save it immediately.
        if (resolution.action === 'create') {
          try {
            const newIngredientData = {
              name: ingredient.name,
              category: 'other', // Default category
              ingredient_type: 'purchased',
              unit: 'oz', // Default unit
              cost_per_unit: 0, // Placeholder
              purchase_price: 0, // Placeholder
              purchase_quantity: 1, // Placeholder
              purchase_unit: 'piece' // Placeholder
            };

            await Ingredient.create(newIngredientData);
            console.log(`Created ingredient: ${ingredient.name}`);
          } catch (error) {
            console.error(`Failed to create ingredient ${ingredient.name}:`, error);
          }
        }
      } else {
        // If no resolution was explicitly selected by the user, default to creating a new one.
        finalResolutions[ingredient.name] = { action: 'create' };
        try {
          const newIngredientData = {
            name: ingredient.name,
            category: 'other',
            ingredient_type: 'purchased',
            unit: 'oz',
            cost_per_unit: 0,
            purchase_price: 0,
            purchase_quantity: 1,
            purchase_unit: 'piece'
          };

          await Ingredient.create(newIngredientData);
          console.log(`Created ingredient: ${ingredient.name}`);
        } catch (error) {
          console.error(`Failed to create ingredient ${ingredient.name}:`, error);
        }
      }
    }

    // Wait a moment for database consistency or for any pending operations to settle.
    await new Promise(resolve => setTimeout(resolve, 1000));

    setIsSaving(false);
    onComplete(finalResolutions); // Pass the final resolutions to the parent component
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Ingredient Mapping Required
        </h3>
        <p className="text-blue-700">
          {newIngredients.length} ingredients from your recipes need to be mapped.
          Choose to match them with existing ingredients or create new ones.
        </p>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {newIngredients.map((ingredient) => {
          const currentResolution = ingredientResolutions[ingredient.name];

          return (
            <div
              key={ingredient.name}
              className="p-4 bg-white border rounded-lg"
            >
              <div className="mb-3">
                <h4 className="font-medium text-gray-900">{ingredient.name}</h4>
                {ingredient.suggestions && ingredient.suggestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 mb-2">Possible matches:</p>
                    <div className="space-y-1">
                      {ingredient.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleResolutionChange(ingredient.name, 'match', suggestion.ingredient.name)}
                          className={`block w-full text-left p-2 rounded text-sm border transition-colors ${
                            currentResolution?.action === 'match' &&
                            currentResolution?.matchedName === suggestion.ingredient.name
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span className="font-medium">{suggestion.ingredient.name}</span>
                          <span className="ml-2 text-xs text-gray-500">
                            {suggestion.confidence}% match
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleResolutionChange(ingredient.name, 'create')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    currentResolution?.action === 'create'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <PlusCircle className="w-3 h-3" />
                    <span>Create New</span>
                  </div>
                </button>
                <IngredientSearch
                  ingredientName={ingredient.name}
                  existingIngredients={existingIngredients}
                  onSelect={(matchedName) => handleResolutionChange(ingredient.name, 'match', matchedName)}
                  currentMatch={currentResolution?.action === 'match' ? currentResolution.matchedName : null}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons at the bottom */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={handleComplete}
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Complete Mapping'
          )}
        </Button>
      </div>
    </div>
  );
}