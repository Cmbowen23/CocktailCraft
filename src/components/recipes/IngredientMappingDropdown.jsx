import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Sparkles, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { safeLower, safeTrim } from "../utils/stringSafe";

// Helper function to safely parse prep_actions
const getPrepActionsArray = (prepActions) => {
  if (!prepActions) return [];
  if (Array.isArray(prepActions)) return prepActions;
  if (typeof prepActions === 'string') {
    try {
      const parsed = JSON.parse(prepActions);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

export default function IngredientMappingDropdown({
  ingredientName,
  suggestions = [],
  allIngredients = [],
  newSubRecipes = [],
  onSelect,
  onCreate,
  isCreating = false,
  currentMapping = null,
  isMapped = false
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIngredients = useMemo(() => {
    const results = [];
    const searchLower = safeTrim(safeLower(search));

    // Helper to add result if not already present (by id to avoid duplicates)
    const addResult = (item) => {
        if (!results.some(r => r.id === item.id)) {
            results.push(item);
        }
    };

    for (const ing of allIngredients) {
        // Stop if we have enough results
        if (results.length >= 20) break;

        const ingNameLower = safeLower(ing.name);
        
        // 1. Check base ingredient
        if (!searchLower || ingNameLower.includes(searchLower)) {
            addResult(ing);
        }

        // 2. Check aliases
        if (ing.aliases && Array.isArray(ing.aliases)) {
            for (const alias of ing.aliases) {
                if (!searchLower || safeLower(alias).includes(searchLower)) {
                    addResult(ing);
                    break;
                }
            }
        }

        // 3. Check prep actions - generate virtual items with prep metadata
        if (ing.prep_actions && Array.isArray(ing.prep_actions)) {
            for (const prep of ing.prep_actions) {
                const preppedName = `${ing.name}, ${prep.name}`;
                if (!searchLower || safeLower(preppedName).includes(searchLower)) {
                    addResult({
                        ...ing,
                        name: preppedName, // Virtual name for display/selection
                        id: `${ing.id}_${prep.name}`, // Virtual ID
                        category: `${ing.category || 'Ingredient'} (${prep.name})`, // Clarify in UI
                        _isVirtualPrepAction: true,
                        _baseName: ing.name,
                        _prepAction: prep.name
                    });
                }
            }
        }
    }
    
    // If no search and we haven't filled the list, add basic ingredients
    if (!search && results.length < 10) {
        const remaining = allIngredients.slice(0, 10).filter(i => !results.some(r => r.id === i.id));
        results.push(...remaining);
    }
    
    return results;
  }, [allIngredients, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-[160px] justify-between h-9 text-xs",
            isMapped 
              ? "text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
              : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
          )}
        >
          {isCreating ? "Creating..." : currentMapping?.name || (isMapped ? "Mapped" : "Map")}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search database..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {/* 1. Suggestions Section - Always show if available */}
            {suggestions.length > 0 && (
              <CommandGroup heading="Suggestions">
                {suggestions.map((s) => (
                  <CommandItem
                    key={s.ingredient.id}
                    value={s.ingredient.name}
                    onSelect={() => {
                      onSelect(s.ingredient);
                      setOpen(false);
                    }}
                    className="text-emerald-700 aria-selected:bg-emerald-50"
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-emerald-500" />
                    {s.ingredient.name}
                    <span className="ml-auto text-xs text-emerald-500 font-medium">{s.confidence}%</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {suggestions.length > 0 && <CommandSeparator />}

            {/* 2. New Sub-Recipes (from this import) */}
            {newSubRecipes.length > 0 && (
              <CommandGroup heading="New Sub-Recipes (This Import)">
                {newSubRecipes.map((subRecipe) => (
                  <CommandItem
                    key={`new-${subRecipe.name}`}
                    value={subRecipe.name}
                    onSelect={() => {
                      onSelect(subRecipe);
                      setOpen(false);
                    }}
                    className="text-purple-700 aria-selected:bg-purple-50"
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                    {subRecipe.name}
                    <span className="ml-auto text-xs text-purple-500 font-medium">New</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {(suggestions.length > 0 || newSubRecipes.length > 0) && <CommandSeparator />}

            {/* 3. Database Search Results */}
            {filteredIngredients.length > 0 ? (
              <CommandGroup heading="Database">
                  {filteredIngredients.map((ingredient) => (
                    <CommandItem
                      key={ingredient.id}
                      value={ingredient.name}
                      onSelect={() => {
                        onSelect(ingredient);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center w-full">
                          <div className="flex-1">
                              <span>{ingredient.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                              {ingredient.category && <span>{ingredient.category}</span>}
                              {(() => {
                                  const cost = parseFloat(ingredient.cost_per_unit);
                                  if (!cost || cost <= 0) return null;
                                  
                                  // Determine the correct unit to display
                                  let displayUnit = ingredient.unit || 'oz';
                                  
                                  // If this is a virtual prep action, use the prep yield unit
                                  if (ingredient._isVirtualPrepAction && ingredient._prepAction) {
                                      const baseIng = allIngredients.find(i => i.id === ingredient.id.split('_')[0]);
                                      if (baseIng?.prep_actions) {
                                          const prep = getPrepActionsArray(baseIng.prep_actions).find(p => p.name === ingredient._prepAction);
                                          if (prep?.yield_unit) {
                                              displayUnit = prep.yield_unit;
                                          }
                                      }
                                  }
                                  
                                  return <span className="text-blue-600 whitespace-nowrap">• ${cost.toFixed(2)}/{displayUnit}</span>;
                              })()}
                          </div>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>No ingredient found in database.</CommandEmpty>
            )}
            
            <CommandSeparator />
            
            {/* 4. Create New Action - Always visible */}
            <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => {
                    onCreate(ingredientName);
                    setOpen(false);
                  }}
                  className="text-blue-600 aria-selected:bg-blue-50 cursor-pointer font-medium"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Create new "{ingredientName}"
                </CommandItem>
            </CommandGroup>

          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}