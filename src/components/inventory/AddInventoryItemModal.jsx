import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, PackagePlus, FlaskConical } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { formatBottleSize } from "@/components/utils/formatBottleSize";
import { calculateBatchCostAndYield } from '../utils/batchCalculations';

export default function AddInventoryItemModal({ isOpen, onClose, onSave, ingredients, variants, accountId, existingInventory = [], recipes = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVariants, setSelectedVariants] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use shared formatter
  const formatSize = (sizeML) => formatBottleSize(sizeML) || '-';

  // Group ingredients with their variants (including batch recipes)
  const ingredientsWithVariants = useMemo(() => {
    // Only show items if search term has 3+ characters
    const shouldFilter = searchTerm.length >= 3;
    
    if (!shouldFilter) {
      return []; // Return empty array until user types 3+ chars
    }
    
    const filtered = ingredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Include ALL ingredients with variants, including sub_recipe types
    const withVariants = filtered.map(ing => ({
      ...ing,
      variants: variants.filter(v => v.ingredient_id === ing.id)
    })).filter(ing => ing.variants.length > 0);
    
    // Add batch bottles that are marked to track as inventory
    const batchRecipes = recipes
      .filter(r => r.batch_settings?.track_batch_inventory || r.batch_settings?.inventory_bottle?.enabled)
      .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    batchRecipes.forEach(recipe => {
      const bottleSize = recipe.batch_settings?.inventory_bottle?.size_ml;
      if (bottleSize) {
        // Calculate batch cost
        const batchData = calculateBatchCostAndYield({ recipe, allIngredients: ingredients });
        const costPerBottle = batchData?.costPerContainer || 0;
        
        withVariants.push({
          id: `batch_${recipe.id}`,
          name: recipe.batch_settings?.inventory_bottle?.label || recipe.name,
          ingredient_type: 'batch_bottle',
          bottle_image_url: null,
          batch_recipe_id: recipe.id,
          batch_neck_colors: recipe.batch_settings?.inventory_bottle?.colors || [],
          variants: [{
            id: `batch_variant_${recipe.id}`,
            ingredient_id: `batch_${recipe.id}`,
            size_ml: bottleSize,
            purchase_price: costPerBottle,
            purchase_quantity: bottleSize,
            purchase_unit: 'ml',
            sku_number: `BATCH-${recipe.id}`
          }]
        });
      }
    });
    
    return withVariants;
  }, [ingredients, variants, recipes, searchTerm]);

  const isVariantTracked = (variantId) => {
    return existingInventory.some(item => item.product_variant_id === variantId);
  };

  const toggleVariant = (variantId, ingredientId) => {
    if (isVariantTracked(variantId)) return;
    
    setSelectedVariants(prev => ({
      ...prev,
      [variantId]: prev[variantId] ? undefined : ingredientId
    }));
  };

  const getBestValueVariant = (variants) => {
    if (!variants || variants.length === 0) return null;
    
    return variants.reduce((best, current) => {
      const currentBottleCost = current.case_price && current.bottles_per_case 
        ? current.case_price / current.bottles_per_case 
        : current.purchase_price || 0;
      const currentCostPerOz = currentBottleCost / (current.size_ml / 29.5735);
      
      if (!best) return { variant: current, costPerOz: currentCostPerOz };
      
      if (currentCostPerOz < best.costPerOz && currentCostPerOz > 0) {
        return { variant: current, costPerOz: currentCostPerOz };
      }
      return best;
    }, null)?.variant;
  };

  const handleSave = async () => {
    const manuallySelected = Object.entries(selectedVariants).filter(([_, ingredientId]) => ingredientId);
    
    // Only use the manually selected items
    const allItems = manuallySelected;
    
    if (allItems.length === 0) {
      toast.error("Please select at least one item to add");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create inventory items one at a time to avoid rate limits
      for (const [variantId, ingredientId] of allItems) {
        const ingredient = ingredientsWithVariants.find(i => i.id === ingredientId);
        const isBatchBottle = ingredient?.ingredient_type === 'batch_bottle';
        
        // Calculate cost for this item
        let itemCost = 0;
        if (isBatchBottle) {
          const batchVariant = ingredient.variants.find(v => v.id === variantId);
          itemCost = batchVariant?.purchase_price || 0;
        } else {
          const productVariant = variants.find(v => v.id === variantId);
          if (productVariant) {
            itemCost = productVariant.purchase_price || 0;
            if (productVariant.case_price > 0 && productVariant.bottles_per_case > 0) {
              itemCost = productVariant.case_price / productVariant.bottles_per_case;
            }
          }
        }
        
        await base44.entities.InventoryItem.create({
          product_variant_id: variantId,
          ingredient_id: ingredientId,
          account_id: accountId,
          current_stock: 0,
          reorder_point: 0,
          unit: 'bottle',
          location_id: null,
          is_batch_bottle: isBatchBottle,
          batch_recipe_id: isBatchBottle ? ingredient.batch_recipe_id : null,
          batch_neck_colors: isBatchBottle ? (ingredient.batch_neck_colors || ingredient.neck_colors || []) : null,
          cost_at_last_count: itemCost
        });
      }

      toast.success(`Added ${allItems.length} item${allItems.length > 1 ? 's' : ''} to inventory`);
      onSave();
      handleClose();
    } catch (error) {
      console.error("Error adding inventory items:", error);
      toast.error("Failed to add items");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    setSelectedVariants({});
    onClose();
  };

  const selectedCount = Object.values(selectedVariants).filter(v => v).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add to Inventory</DialogTitle>
          <DialogDescription>
            Select which bottle sizes to track for ingredients with multiple options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Type 3+ letters to search..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {searchTerm.length > 0 && searchTerm.length < 3 && (
              <p className="text-xs text-gray-500">Type at least 3 characters to search</p>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
            </div>
          )}

          <div className="space-y-3">
            {ingredientsWithVariants.map(ingredient => {
              const isBatch = ingredient.ingredient_type === 'sub_recipe';
              const isBatchBottle = ingredient.ingredient_type === 'batch_bottle';
              const bestValue = getBestValueVariant(ingredient.variants);
              
              return (
                <div key={ingredient.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                  <div className="flex items-start gap-2 mb-2">
                    {ingredient.bottle_image_url && (
                      <img 
                        src={ingredient.bottle_image_url} 
                        alt="" 
                        className="w-6 h-10 object-contain flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        {ingredient.name}
                        {isBatch && <FlaskConical className="w-4 h-4 text-purple-500" title="Batch Recipe" />}
                        {isBatchBottle && <PackagePlus className="w-4 h-4 text-blue-500" title="Batch Bottle" />}
                      </h4>
                      {ingredient.variants.length === 1 && !isVariantTracked(ingredient.variants[0].id) && (
                        <p className="text-xs text-gray-500">Only one size available</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {ingredient.variants.map(variant => {
                      const isTracked = isVariantTracked(variant.id);
                      const isSelected = !!selectedVariants[variant.id];
                      const isBestValue = variant.id === bestValue?.id && ingredient.variants.length > 1;
                      const bottleCost = variant.case_price && variant.bottles_per_case 
                        ? (variant.case_price / variant.bottles_per_case).toFixed(2)
                        : (variant.purchase_price || 0).toFixed(2);
                      const costPerOz = (bottleCost / (variant.size_ml / 29.5735)).toFixed(2);

                      return (
                        <div 
                          key={variant.id}
                          className={`flex items-center justify-between p-2 rounded-md transition-all cursor-pointer ${
                            isTracked 
                              ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                              : isSelected 
                              ? 'bg-blue-50 border border-blue-200' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => !isTracked && toggleVariant(variant.id, ingredient.id)}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox 
                              checked={isSelected}
                              disabled={isTracked}
                              onCheckedChange={() => !isTracked && toggleVariant(variant.id, ingredient.id)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{formatSize(variant.size_ml)}</span>
                                <span className="text-xs text-gray-500">#{variant.sku_number || 'No SKU'}</span>
                                {isBestValue && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                    ✓ Best Value
                                  </span>
                                )}
                              </div>
                              {isTracked && (
                                <span className="text-xs text-gray-500">Already in inventory</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-medium text-gray-900">${bottleCost}</div>
                            <div className="text-xs text-gray-500">${costPerOz}/oz</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {searchTerm.length < 3 && (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">Start typing to search</p>
                <p className="text-sm mt-1">Enter at least 3 characters to see results</p>
              </div>
            )}
            
            {searchTerm.length >= 3 && ingredientsWithVariants.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No ingredients found matching "{searchTerm}"</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-gray-600">{selectedCount} items selected</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={selectedCount === 0 || isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackagePlus className="w-4 h-4 mr-2" />}
                Add Items
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}