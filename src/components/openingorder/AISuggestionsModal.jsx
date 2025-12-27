import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package, ChevronDown, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AISuggestionsModal({
  open,
  onOpenChange,
  suggestions = [],
  allIngredients = [],
  onAddSelected,
  onRefresh,
  isRefreshing = false,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set(suggestions.map(s => s.ingredient_id)));
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [variantsCache, setVariantsCache] = useState({});
  const [variantsLoaded, setVariantsLoaded] = useState(false);

  // Fetch all variants once when modal opens
  useEffect(() => {
    if (!open || variantsLoaded) return;
    const fetchVariants = async () => {
      try {
        const allVariants = await base44.entities.ProductVariant.list("-created_date", 5000);
        const byIngredient = {};
        (allVariants || []).forEach((v) => {
          if (!v.ingredient_id) return;
          if (!byIngredient[v.ingredient_id]) byIngredient[v.ingredient_id] = [];
          byIngredient[v.ingredient_id].push(v);
        });
        setVariantsCache(byIngredient);
        setVariantsLoaded(true);
      } catch (err) {
        console.error("Error fetching variants:", err);
      }
    };
    fetchVariants();
  }, [open, variantsLoaded]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIds(new Set(suggestions.map(s => s.ingredient_id)));
  }, [suggestions]);

  // Build a map of ingredient data for quick lookup
  const ingredientMap = useMemo(() => {
    const map = {};
    allIngredients.forEach(ing => {
      map[ing.id] = ing;
    });
    return map;
  }, [allIngredients]);

  // Group suggestions by spirit_type, then by substyle
  const groupedSuggestions = useMemo(() => {
    const groups = {};

    suggestions.forEach(suggestion => {
      const ing = ingredientMap[suggestion.ingredient_id];
      if (!ing) return;

      const spiritType = ing.spirit_type || ing.category || "Other";
      const substyle = ing.substyle || "General";

      if (!groups[spiritType]) {
        groups[spiritType] = {};
      }
      if (!groups[spiritType][substyle]) {
        groups[spiritType][substyle] = [];
      }

      groups[spiritType][substyle].push({
        ...suggestion,
        ingredient: ing,
      });
    });

    // Sort spirit types alphabetically, but put "Other" at end
    const sortedGroups = Object.keys(groups).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });

    return { groups, sortedKeys: sortedGroups };
  }, [suggestions, ingredientMap]);

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(suggestions.map(s => s.ingredient_id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleAddToOrder = () => {
    const selectedSuggestions = suggestions.filter(s => selectedIds.has(s.ingredient_id));
    onAddSelected(selectedSuggestions);
    onOpenChange(false);
  };

  // Get pricing info from variants
  const getPricingInfo = (ing) => {
    const variants = variantsCache[ing.id] || [];
    // Find a good default variant (750ml preferred, then largest)
    const sortedVariants = [...variants].sort((a, b) => {
      const aSize = parseFloat(a.size_ml) || 0;
      const bSize = parseFloat(b.size_ml) || 0;
      // Prefer 750ml
      if (aSize === 750) return -1;
      if (bSize === 750) return 1;
      return bSize - aSize;
    });
    
    const variant = sortedVariants[0];
    
    const bottlePrice = variant?.purchase_price ?? ing.purchase_price ?? null;
    const casePrice = variant?.case_price ?? null;
    const sizeMl = variant?.size_ml ?? 750;
    
    // Calculate cost per oz (1 oz = 29.5735 ml)
    let costPerOz = null;
    if (bottlePrice != null && sizeMl) {
      const ozInBottle = sizeMl / 29.5735;
      costPerOz = bottlePrice / ozInBottle;
    }
    
    return { bottlePrice, casePrice, costPerOz, sizeMl };
  };

  const formatPrice = (value) => {
    if (value == null || isNaN(value)) return "—";
    return `$${value.toFixed(2)}`;
  };

  const selectedCount = selectedIds.size;
  const totalCount = suggestions.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            AI Suggested Products
          </DialogTitle>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-600">
              {selectedCount} of {totalCount} products selected
            </p>
            <div className="flex gap-2">
              {onRefresh && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  )}
                  Refresh
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {groupedSuggestions.sortedKeys.map(spiritType => {
            const substyles = groupedSuggestions.groups[spiritType];
            const spiritKey = `spirit-${spiritType}`;
            const isCollapsed = collapsedGroups.has(spiritKey);

            // Count selected in this spirit type
            const spiritProducts = Object.values(substyles).flat();
            const spiritSelectedCount = spiritProducts.filter(p => selectedIds.has(p.ingredient_id)).length;

            return (
              <div key={spiritType} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleGroup(spiritKey)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 hover:bg-gray-150 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="font-semibold text-gray-900">{spiritType}</span>
                    <Badge variant="secondary" className="ml-2">
                      {spiritSelectedCount}/{spiritProducts.length}
                    </Badge>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="p-4 space-y-4">
                    {Object.keys(substyles).sort().map(substyle => {
                      const products = substyles[substyle];

                      return (
                        <div key={substyle}>
                          {substyle !== "General" && (
                            <h4 className="text-sm font-medium text-gray-700 mb-3 border-b pb-1">
                              {substyle}
                            </h4>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {products.map(({ ingredient_id, ingredient, quantity }) => {
                              const isSelected = selectedIds.has(ingredient_id);
                              const pricing = getPricingInfo(ingredient);

                              return (
                                <div
                                  key={ingredient_id}
                                  onClick={() => toggleSelection(ingredient_id)}
                                  className={`
                                    relative cursor-pointer rounded-lg border-2 p-3 transition-all
                                    ${isSelected 
                                      ? "border-blue-500 bg-blue-50 shadow-md" 
                                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                                    }
                                  `}
                                >
                                  <div className="absolute top-2 right-2">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleSelection(ingredient_id)}
                                      className="pointer-events-none"
                                    />
                                  </div>

                                  {/* Bottle Image */}
                                  <div className="w-full h-20 flex items-center justify-center mb-2">
                                    {ingredient.bottle_image_url ? (
                                      <img
                                        src={ingredient.bottle_image_url}
                                        alt={ingredient.name}
                                        className="max-h-full max-w-full object-contain"
                                      />
                                    ) : (
                                      <div className="w-14 h-16 bg-gray-100 rounded flex items-center justify-center">
                                        <Package className="w-6 h-6 text-gray-300" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Name */}
                                  <p className="text-xs font-medium text-gray-900 text-center line-clamp-2 min-h-[2rem]">
                                    {ingredient.name}
                                  </p>

                                  {/* Pricing Grid */}
                                  <div className="mt-2 space-y-0.5 text-[10px] text-gray-600">
                                    <div className="flex justify-between">
                                      <span>Bottle:</span>
                                      <span className="font-medium text-green-700">{formatPrice(pricing.bottlePrice)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Case:</span>
                                      <span className="font-medium text-green-700">{formatPrice(pricing.casePrice)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Per oz:</span>
                                      <span className="font-medium text-blue-700">{formatPrice(pricing.costPerOz)}</span>
                                    </div>
                                  </div>

                                  {/* Suggested quantity badge */}
                                  <div className="flex justify-center mt-2">
                                    <Badge variant="outline" className="text-[10px]">
                                      Qty: {quantity}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {suggestions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No suggestions generated yet.</p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddToOrder} 
            disabled={selectedCount === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Add {selectedCount} to Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}