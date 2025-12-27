import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, RotateCcw } from "lucide-react";
import BottleFillSlider from "./BottleFillSlider";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function StockCountModal({ isOpen, onClose, onSave, inventoryItems, ingredients, variants, currentUser, recipes = [] }) {
  const [stockState, setStockState] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Initialize counts with current stock
  useEffect(() => {
    if (isOpen) {
      resetCounts();
      // Auto-select first item when modal opens
      if (inventoryItems.length > 0) {
        setSelectedItemId(inventoryItems[0].id);
      }
    }
  }, [isOpen, inventoryItems]);

  const getBottlesPerCase = (variantId) => {
    const v = variants.find(v => v.id === variantId);
    return v?.bottles_per_case || 1;
  };

  const resetCounts = () => {
    const initial = {};
    inventoryItems.forEach(item => {
      const bpc = getBottlesPerCase(item.product_variant_id);
      const total = Number(item.current_stock) || 0;
      
      let cases = 0;
      let fullBottles = 0;
      let partialBottle = 0;
      
      if (bpc > 1) {
        cases = Math.floor(total / bpc);
        const remainder = total % bpc;
        fullBottles = Math.floor(remainder);
        partialBottle = Number((remainder - fullBottles).toFixed(2));
      } else {
        fullBottles = Math.floor(total);
        partialBottle = Number((total - fullBottles).toFixed(2));
      }
      
      initial[item.id] = { cases, fullBottles, partialBottle };
    });
    setStockState(initial);
  };

  const handleCaseChange = (itemId, val) => {
    setStockState(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], cases: Number(val) || 0 }
    }));
  };

  const handleFullBottleChange = (itemId, val) => {
    setStockState(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], fullBottles: Math.max(0, Number(val) || 0) }
    }));
  };

  const handlePartialBottleChange = (itemId, val) => {
    const clamped = Math.max(0, Math.min(0.99, Number(val)));
    setStockState(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], partialBottle: Number(clamped.toFixed(2)) }
    }));
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all counts to their current system values?")) {
      resetCounts();
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const updates = [];

      let itemsCounted = 0;

      for (const item of inventoryItems) {
        const state = stockState[item.id] || { cases: 0, fullBottles: 0, partialBottle: 0 };
        const bpc = getBottlesPerCase(item.product_variant_id);

        const bottlesFromCases = state.cases * (bpc > 1 ? bpc : 0);
        const totalStock = bottlesFromCases + state.fullBottles + state.partialBottle;

        updates.push(base44.entities.InventoryItem.update(item.id, {
          current_stock: Number(totalStock.toFixed(2)),
          last_counted_date: timestamp
        }));

        itemsCounted++;
      }

      await Promise.all(updates);

      toast.success(`Updated stock for ${itemsCounted} items`);

      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving stock counts:", error);
      toast.error("Failed to save stock counts");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIngredientName = (item) => {
    if (item.is_batch_bottle) {
      const recipe = recipes.find(r => r.id === item.batch_recipe_id);
      return recipe?.batch_settings?.inventory_bottle?.label || recipe?.name || "Batch Item";
    }
    return ingredients.find(i => i.id === item.ingredient_id)?.name || "Unknown Ingredient";
  };

  const getIngredientImage = (item) => {
    if (item.is_batch_bottle) {
      return null;
    }
    return ingredients.find(i => i.id === item.ingredient_id)?.bottle_image_url;
  };

  const getBottleMode = (item) => {
    return item?.is_batch_bottle ? "batch_svg" : "photo";
  };

  const getNeckColors = (item) => {
    return item?.is_batch_bottle 
      ? (item?.batch_neck_colors || item?.neck_colors || [])
      : [];
  };

  const getVariantInfo = (variantId) => {
    const v = variants.find(v => v.id === variantId);
    return v ? `${v.size_ml}ml` : "";
  };

  const selectedItem = inventoryItems.find(item => item.id === selectedItemId);
  const selectedState = selectedItem ? (stockState[selectedItem.id] || { cases: 0, fullBottles: 0, partialBottle: 0 }) : { cases: 0, fullBottles: 0, partialBottle: 0 };
  const selectedBpc = selectedItem ? getBottlesPerCase(selectedItem.product_variant_id) : 1;
  const bottlesFromCases = selectedState.cases * (selectedBpc > 1 ? selectedBpc : 0);
  const totalBottles = Number((bottlesFromCases + selectedState.fullBottles + selectedState.partialBottle).toFixed(2));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Save Stock Counts</DialogTitle>
          <DialogDescription>
            Enter the current on-hand quantity for your inventory items.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4 flex gap-4">
          {/* Left Side: Table of Items */}
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-center">System<br/>Stock</TableHead>
                  <TableHead className="text-center">Cases</TableHead>
                  <TableHead className="text-center">Bottles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryItems.map(item => {
                  const bpc = getBottlesPerCase(item.product_variant_id);
                  const showCases = bpc > 1;
                  const state = stockState[item.id] || { cases: 0, fullBottles: 0, partialBottle: 0 };
                  const isSelected = item.id === selectedItemId;
                  const itemBottlesFromCases = state.cases * (bpc > 1 ? bpc : 0);
                  const itemTotal = itemBottlesFromCases + state.fullBottles + state.partialBottle;

                  return (
                    <TableRow 
                      key={item.id}
                      className={`cursor-pointer hover:bg-blue-50 ${isSelected ? 'bg-blue-100' : ''}`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white rounded border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {getIngredientImage(item) ? (
                              <img 
                                src={getIngredientImage(item)} 
                                alt="" 
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                            )}
                          </div>
                          <span className="truncate">{getIngredientName(item)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getVariantInfo(item.product_variant_id)}
                      </TableCell>
                      <TableCell className="text-center">
                        {Number(item.current_stock).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {showCases ? (
                          <span className="text-xs">{state.cases} <span className="text-gray-400">x{bpc}</span></span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {itemTotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {inventoryItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No items in inventory to count. Add items first.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Right Side: Estimate Stock Panel for Selected Item */}
          {selectedItem && (
            <div className="w-96 border rounded-lg p-4 flex flex-col gap-4 bg-gray-50">
              <div className="text-center">
                <h3 className="font-semibold text-sm text-gray-600 mb-1">Estimate Stock</h3>
                <div className="text-3xl font-bold text-blue-600">
                  {totalBottles.toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">TOTAL BOTTLES</p>
              </div>

              {/* Visual Bottle Slider */}
              <div className="flex flex-col items-center justify-center gap-4 py-2">
                <BottleFillSlider 
                  mode={getBottleMode(selectedItem)}
                  bottleImageUrl={getIngredientImage(selectedItem)}
                  neckColors={getNeckColors(selectedItem)}
                  partial={selectedState.partialBottle}
                  onPartialChange={(val) => handlePartialBottleChange(selectedItem.id, val)}
                />
              </div>

              {/* Full Bottles Input */}
              <div className="border-t pt-4">
                <label className="text-xs font-medium text-gray-600 block mb-2">Full Bottles</label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleFullBottleChange(selectedItem.id, selectedState.fullBottles - 1)}
                  >
                    <span className="text-xl font-bold">−</span>
                  </Button>
                  <Input 
                    type="number" 
                    min="0"
                    step="1"
                    value={selectedState.fullBottles}
                    onChange={(e) => handleFullBottleChange(selectedItem.id, e.target.value)}
                    className="flex-1 text-center"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleFullBottleChange(selectedItem.id, selectedState.fullBottles + 1)}
                  >
                    <span className="text-xl font-bold">+</span>
                  </Button>
                </div>
              </div>

              {/* Partial Bottle Input */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Partial Bottle</label>
                <Input 
                  type="number" 
                  min="0"
                  max="0.99"
                  step="0.01"
                  value={selectedState.partialBottle}
                  onChange={(e) => handlePartialBottleChange(selectedItem.id, e.target.value)}
                  className="text-center"
                />
                <p className="text-xs text-gray-500 text-center mt-1">
                  Drag on bottle or type value
                </p>
              </div>

              {/* Cases Input (if applicable) */}
              {selectedBpc > 1 && (
                <div className="border-t pt-4">
                  <label className="text-xs font-medium text-gray-600 block mb-2">Cases</label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      min="0"
                      step="1"
                      value={selectedState.cases}
                      onChange={(e) => handleCaseChange(selectedItem.id, e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-500">x{selectedBpc}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between w-full">
          <Button variant="ghost" onClick={handleReset} className="text-red-500 hover:text-red-700 hover:bg-red-50">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Count
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}