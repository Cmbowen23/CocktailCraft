import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, PackagePlus, DollarSign, BadgePercent } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { alcoholicCategories } from "@/components/utils/categoryDefinitions";

export default function ResolveInventoryVariantsModal({ isOpen, onClose, menuId, accountId, onComplete, mode = 'inventory', onResolve, ingredients = null }) {
  const [step, setStep] = useState('loading'); 
  const [candidates, setCandidates] = useState([]); 
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
        if (ingredients || (menuId && (accountId || mode === 'order'))) {
            loadCandidates();
        }
    }
  }, [isOpen, menuId, accountId, mode, ingredients]);

  const loadCandidates = async () => {
    setStep('loading');
    try {
      let relevantIngredients = [];
      let existingInventory = [];

      // 1. Determine Ingredients
      if (ingredients) {
         relevantIngredients = ingredients;
      } else {
        // Menu Mode - get recipes from menu's recipe_order OR menu_id
        const [menu] = await base44.entities.Menu.filter({ id: menuId });
        if (!menu) throw new Error("Menu not found");

        const recipeOrder = menu.customer_menu_settings?.recipe_order || [];
        const allRecipes = await base44.entities.Recipe.list();
        const menuRecipes = allRecipes.filter(r => 
           recipeOrder.includes(r.id) || r.menu_id === menuId
        );

        // FIX: Respect Batch Settings
        const ingredientNames = new Set();
        const batchRecipeIds = new Set();

        menuRecipes.forEach(recipe => {
           const settings = recipe.batch_settings || {};
           const isBatchTracked = settings.inventory_bottle?.enabled || settings.track_batch_inventory;

           if (isBatchTracked) {
               // If tracked as a bottle, we want the BATCH ITSELF (Sub-Recipe Ingredient), not the components
               batchRecipeIds.add(recipe.id);
           } else {
               // Otherwise, add the raw components
               recipe.ingredients?.forEach(ing => {
                  if (ing.ingredient_name) ingredientNames.add(ing.ingredient_name);
               });
           }
        });

        if (ingredientNames.size === 0 && batchRecipeIds.size === 0) {
           toast.info("No ingredients found in this menu.");
           onClose();
           return;
        }

        const allIngredients = await base44.entities.Ingredient.list();

        // FIX: Filter by Name OR by Sub-Recipe ID
        relevantIngredients = allIngredients.filter(ing => 
           (ingredientNames.has(ing.name) || batchRecipeIds.has(ing.sub_recipe_id)) && 
           (
              ing.is_liquor_portfolio_item || 
              (ing.category && alcoholicCategories.includes(ing.category.toLowerCase())) ||
              // Ensure Batch ingredients are included regardless of category if matched by ID
              batchRecipeIds.has(ing.sub_recipe_id)
           )
        );
      }

      // 2. Fetch Variants
      const allVariants = await base44.entities.ProductVariant.list();

      // 3. Fetch Existing Inventory
      if (mode === 'inventory' && accountId) {
         existingInventory = await base44.entities.InventoryItem.filter({ account_id: accountId });
      }

      const existingVariantIds = new Set(existingInventory.map(i => i.product_variant_id));

      // 4. Build Candidates List
      const candidateList = relevantIngredients.map(ing => {
        const ingVariants = allVariants.filter(v => v.ingredient_id === ing.id);
        
        let minCostPerOz = Infinity;
        
        const variantsWithStats = ingVariants.map(v => {
             const price = v.purchase_price || 0;
             const actualMl = (v.size_ml < 10) ? v.size_ml * 1000 : v.size_ml;
             const sizeOz = (actualMl || 0) / 29.5735;
             const costPerOz = (price > 0 && sizeOz > 0) ? price / sizeOz : 0;
             
             if (costPerOz > 0 && costPerOz < minCostPerOz) {
                 minCostPerOz = costPerOz;
             }
             
             return { ...v, price, costPerOz };
        });

        const variantStates = variantsWithStats.map(v => ({
            ...v,
            isBestValue: v.costPerOz > 0 && v.costPerOz === minCostPerOz && variantsWithStats.length > 1,
            isTracked: existingVariantIds.has(v.id),
            selected: (mode === 'order' || !existingVariantIds.has(v.id)) && variantsWithStats.length === 1
        }));

        if (mode === 'inventory') {
            const hasUntracked = variantStates.some(v => !v.isTracked);
            if (!hasUntracked) return null;
        } else {
             if (variantStates.length === 0) return null;
        }

        return { ingredient: ing, variants: variantStates };
      }).filter(Boolean);

      setCandidates(candidateList);
      
      if (candidateList.length === 0) {
        if (mode === 'inventory') {
            toast.info("All applicable ingredients are already in your inventory.");
        } else {
            toast.info("No applicable variants found.");
        }
        onClose();
      } else {
        setStep('selection');
      }

    } catch (error) {
      console.error("Error loading inventory candidates:", error);
      toast.error("Failed to load inventory options");
      onClose();
    }
  };

  const toggleVariant = (ingredientId, variantId) => {
    setCandidates(prev => prev.map(c => {
        if (c.ingredient.id !== ingredientId) return c;
        return {
            ...c,
            variants: c.variants.map(v => {
                if (v.id !== variantId) return v;
                return { ...v, selected: !v.selected };
            })
        };
    }));
  };

  const handleSave = async () => {
    if (onResolve) {
        const selectedVariants = [];
        candidates.forEach(c => {
            c.variants.forEach(v => {
                if (v.selected) {
                    selectedVariants.push({
                        ...v,
                        ingredient_name: c.ingredient.name,
                        ingredient_id: c.ingredient.id
                    });
                }
            });
        });
        onResolve(selectedVariants);
        onClose();
        return;
    }

    setStep('processing');
    let addedCount = 0;
    try {
        const variantsToAdd = [];
        candidates.forEach(c => {
            c.variants.forEach(v => {
                if (v.selected && !v.isTracked) {
                    variantsToAdd.push({
                        product_variant_id: v.id,
                        ingredient_id: c.ingredient.id,
                        account_id: accountId,
                        current_stock: 0,
                        reorder_point: 0,
                        unit: 'bottle',
                        location_id: null
                    });
                }
            });
        });

        if (variantsToAdd.length > 0) {
            const chunkSize = 10;
            for (let i = 0; i < variantsToAdd.length; i += chunkSize) {
                const chunk = variantsToAdd.slice(i, i + chunkSize);
                await Promise.all(chunk.map(item => base44.entities.InventoryItem.create(item)));
                addedCount += chunk.length;
                setProcessingCount(addedCount);
            }
        }

        toast.success(`Successfully added ${addedCount} items to inventory`);
        if (onComplete) onComplete();
        onClose();

    } catch (error) {
        console.error("Error creating inventory items:", error);
        toast.error("Failed to create some inventory items");
        onClose();
    }
  };

  const countSelected = useMemo(() => {
      return candidates.reduce((acc, c) => acc + c.variants.filter(v => v.selected).length, 0);
  }, [candidates]);
  
  const variantsToResolve = useMemo(() => {
      return candidates.filter(c => c.variants.length > 1);
  }, [candidates]);
  
  const singleVariantCount = candidates.length - variantsToResolve.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{mode === 'order' ? 'Select Sizes' : 'Add to Inventory'}</DialogTitle>
          <DialogDescription>
            {mode === 'order' ? 'Select sizes for order.' : 'Select sizes to track.'}
            {singleVariantCount > 0 && (
                <span className="block mt-1 text-green-600 font-medium">+ {singleVariantCount} items added automatically.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 pr-2">
            {step === 'loading' ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                    <p className="text-sm text-gray-500">Checking sizes...</p>
                </div>
            ) : step === 'processing' ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-2" />
                    <p className="text-sm text-gray-500">Adding items...</p>
                    <p className="text-xs text-gray-400 mt-1">{processingCount} added</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {variantsToResolve.length === 0 && singleVariantCount > 0 ? (
                        <div className="text-center py-8 text-gray-500"><CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" /><p>No conflicts.</p></div>
                    ) : (
                        variantsToResolve.map((group) => (
                        <div key={group.ingredient.id} className="border rounded-lg p-4 bg-gray-50/50">
                            <h4 className="font-medium text-gray-900 mb-3">{group.ingredient.name}</h4>
                            <div className="space-y-2 pl-2">
                                {group.variants.map((variant) => (
                                    <div key={variant.id} className="flex items-start p-2 rounded hover:bg-white border border-transparent hover:border-gray-200">
                                        <Checkbox 
                                            id={variant.id} 
                                            checked={variant.isTracked || variant.selected}
                                            disabled={variant.isTracked && mode === 'inventory'}
                                            onCheckedChange={() => toggleVariant(group.ingredient.id, variant.id)}
                                            className="mt-1 mr-3"
                                        />
                                        <div className="flex-1">
                                            <Label htmlFor={variant.id} className="text-sm font-medium cursor-pointer">
                                                {variant.size_ml < 10 ? `${variant.size_ml}L` : `${variant.size_ml}ml`} 
                                            </Label>
                                            {variant.isTracked && mode === 'inventory' && <span className="ml-2 text-xs text-green-600">Tracked</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )))}
                </div>
            )}
        </div>

        {step === 'selection' && (
            <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={countSelected === 0}>
                    <PackagePlus className="w-4 h-4 mr-2" />
                    {mode === 'order' ? 'Add to Order' : 'Add Items'}
                </Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}