import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import BottleFillSlider from "./BottleFillSlider";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function SingleItemCountModal({ isOpen, onClose, onSave, inventoryItem, ingredientName, variant, ingredient }) {
  const [cases, setCases] = useState(0);
  const [fullBottles, setFullBottles] = useState(0);
  const [partialBottle, setPartialBottle] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && inventoryItem) {
      const bpc = variant?.bottles_per_case || 1;
      const total = Number(inventoryItem.current_stock) || 0;
      
      let c = 0;
      let fullB = 0;
      let partialB = 0;
      
      if (bpc > 1) {
        c = Math.floor(total / bpc);
        const remainder = total % bpc;
        fullB = Math.floor(remainder);
        partialB = Number((remainder - fullB).toFixed(2));
      } else {
        fullB = Math.floor(total);
        partialB = Number((total - fullB).toFixed(2));
      }
      
      setCases(c);
      setFullBottles(fullB);
      setPartialBottle(partialB);
    }
  }, [isOpen, inventoryItem, variant]);

  const handleSave = async () => {
    if (!inventoryItem) return;

    setIsSubmitting(true);
    try {
      const bpc = variant?.bottles_per_case || 1;
      const totalStock = (cases * (bpc > 1 ? bpc : 0)) + fullBottles + partialBottle;
      const timestamp = new Date().toISOString();

      await base44.entities.InventoryItem.update(inventoryItem.id, {
        current_stock: Number(totalStock.toFixed(2)),
        last_counted_date: timestamp
      });

      toast.success(`Updated stock for ${ingredientName}`);
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving stock count:", error);
      toast.error("Failed to save stock count");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!inventoryItem) return null;

  const bpc = variant?.bottles_per_case || 1;
  const showCases = bpc > 1;
  const bottlesFromCases = cases * (showCases ? bpc : 0);
  const totalBottles = Number((bottlesFromCases + fullBottles + partialBottle).toFixed(2));

  // DETERMINE BOTTLE TYPE: batch or normal
  const isBatchBottle = !!inventoryItem?.is_batch_bottle;
  const sliderMode = isBatchBottle ? "batch_svg" : "photo";
  
  const imageUrl = isBatchBottle 
    ? null
    : (ingredient?.bottle_image_url || inventoryItem?.bottle_image_url || null);
  
  const neckColors = isBatchBottle 
    ? (inventoryItem?.batch_neck_colors || inventoryItem?.neck_colors || [])
    : [];
  
  console.log("[SingleCount] mode:", sliderMode, "imageUrl:", imageUrl, "neckColors:", neckColors);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Count: {ingredientName}</DialogTitle>
          <DialogDescription>
            Update the current on-hand quantity.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Total Display */}
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {totalBottles.toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">TOTAL BOTTLES</p>
          </div>

          {/* Visual Bottle Slider */}
          <div className="flex flex-col items-center justify-center gap-4 py-4">
            <BottleFillSlider 
              mode={sliderMode}
              bottleImageUrl={imageUrl}
              neckColors={neckColors}
              partial={partialBottle}
              onPartialChange={(val) => setPartialBottle(val)}
            />
          </div>

          {/* Full Bottles Input */}
          <div className="pt-4">
            <label className="text-xs font-medium text-gray-600 block mb-2">Full Bottles</label>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setFullBottles(Math.max(0, fullBottles - 1))}
              >
                <span className="text-xl font-bold">−</span>
              </Button>
              <Input 
                type="number" 
                min="0"
                step="1"
                value={fullBottles}
                onChange={(e) => setFullBottles(Math.max(0, Number(e.target.value) || 0))}
                className="flex-1 text-center"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setFullBottles(fullBottles + 1)}
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
              value={partialBottle}
              onChange={(e) => setPartialBottle(Math.max(0, Math.min(0.99, Number(e.target.value) || 0)))}
              className="text-center"
            />
            <p className="text-xs text-gray-500 text-center mt-1">
              Drag on bottle or type value
            </p>
          </div>

          {/* Cases Input (if applicable) */}
          {showCases && (
            <div className="border-t pt-4">
              <label className="text-xs font-medium text-gray-600 block mb-2">Cases</label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min="0"
                  step="1"
                  value={cases}
                  onChange={(e) => setCases(Math.max(0, Number(e.target.value) || 0))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-500">x{bpc}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Count
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}