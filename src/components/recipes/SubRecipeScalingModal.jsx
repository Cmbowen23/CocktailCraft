import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale } from "lucide-react";

export default function SubRecipeScalingModal({ isOpen, onClose, recipe, allIngredients, onApplyScaling, embedded = false, initialScale = 1 }) {
  const [targetYield, setTargetYield] = useState("");
  const [targetServings, setTargetServings] = useState("");
  const [scalingMode, setScalingMode] = useState("yield"); // "yield" or "servings"
  const [scalingFactor, setScalingFactor] = useState(1);

  const currentYield = recipe?.yield_total_amount || recipe?.yield_amount || 0;
  const currentUnit = recipe?.yield_total_unit || recipe?.yield_unit || 'ml';
  const servingSize = recipe?.serving_size_amount || recipe?.serving_size || 0;
  const isSellable = recipe?.is_sellable_item || recipe?.is_cocktail || false;

  useEffect(() => {
    if ((isOpen || embedded) && recipe) {
      if (embedded && initialScale !== 1 && currentYield) {
          const calculatedTarget = (parseFloat(currentYield) * initialScale).toFixed(2);
          setTargetYield(calculatedTarget);
          setScalingFactor(initialScale);
      } else {
          setTargetYield(currentYield || "");
          setScalingFactor(1);
      }
      setTargetServings("");
      setScalingMode("yield");
    }
  }, [isOpen, embedded, recipe, initialScale, currentYield]);

  useEffect(() => {
    if (!currentYield) return;
    
    if (scalingMode === "yield" && targetYield) {
      const factor = parseFloat(targetYield) / parseFloat(currentYield);
      setScalingFactor(isNaN(factor) ? 1 : factor);
    } else if (scalingMode === "servings" && targetServings && servingSize) {
      const desiredYield = parseFloat(targetServings) * servingSize;
      const factor = desiredYield / parseFloat(currentYield);
      setScalingFactor(isNaN(factor) ? 1 : factor);
      setTargetYield(desiredYield.toFixed(2));
    }
  }, [targetYield, targetServings, scalingMode, currentYield, servingSize]);

  const handleApply = () => {
    if (!recipe || !recipe.ingredients) return;

    const scaledIngredients = recipe.ingredients.map(ing => ({
      ...ing,
      amount: parseFloat((parseFloat(ing.amount) * scalingFactor).toFixed(3))
    }));

    const newYieldAmount = parseFloat(targetYield);
    onApplyScaling(scaledIngredients, newYieldAmount);
  };

  if (!recipe) return null;

  const content = (
    <div className={embedded ? "space-y-4" : "space-y-4 py-4"}>
      <div className="space-y-2">
        <Label htmlFor="current-yield">Current Yield</Label>
        <div className="text-lg font-semibold text-gray-700">
          {currentYield} {currentUnit}
          {isSellable && servingSize > 0 && (
            <span className="text-sm text-gray-500 ml-2">
              ({Math.floor(currentYield / servingSize)} servings @ {servingSize} {currentUnit})
            </span>
          )}
        </div>
      </div>

      {isSellable && servingSize > 0 && (
        <div className="flex gap-2 mb-3">
          <Button
            type="button"
            variant={scalingMode === "yield" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setScalingMode("yield");
              setTargetServings("");
            }}
            className="flex-1"
          >
            Scale by Yield
          </Button>
          <Button
            type="button"
            variant={scalingMode === "servings" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setScalingMode("servings");
              setTargetYield("");
            }}
            className="flex-1"
          >
            Scale by Servings
          </Button>
        </div>
      )}

      {scalingMode === "yield" && (
        <div className="space-y-2">
          <Label htmlFor="target-yield">Target Yield ({currentUnit})</Label>
          <Input
            id="target-yield"
            type="number"
            value={targetYield}
            onChange={(e) => {
              setTargetYield(e.target.value);
              setTargetServings("");
            }}
            placeholder="Enter target yield amount"
            className="border-gray-300 focus:border-blue-500"
          />
        </div>
      )}

      {scalingMode === "servings" && isSellable && (
        <div className="space-y-2">
          <Label htmlFor="target-servings">Target Number of Servings</Label>
          <Input
            id="target-servings"
            type="number"
            value={targetServings}
            onChange={(e) => {
              setTargetServings(e.target.value);
            }}
            placeholder="Enter number of servings"
            className="border-gray-300 focus:border-blue-500"
          />
        </div>
      )}

      {scalingFactor !== 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Scaling Factor:</strong> {scalingFactor.toFixed(3)}x
          </p>
          {scalingMode === "servings" && (
            <p className="text-xs text-blue-600 mt-1">
              Target yield: {targetYield} {currentUnit}
            </p>
          )}
          <p className="text-xs text-blue-600 mt-1">
            All ingredient amounts will be multiplied by this factor.
          </p>
        </div>
      )}

      <div className="border-t border-gray-200 pt-3">
        <p className="text-sm text-gray-600 mb-2 font-semibold">Preview of scaled ingredients:</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {recipe.ingredients && recipe.ingredients.map((ing, idx) => {
            const scaledAmount = (parseFloat(ing.amount) * scalingFactor).toFixed(3);
            return (
              <div key={idx} className="text-sm text-gray-700 flex justify-between">
                <span>{ing.ingredient_name}</span>
                <span className="font-medium">
                  {scaledAmount} {ing.unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (embedded) {
      return content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            Scale Recipe
          </DialogTitle>
          <DialogDescription>
            Adjust the yield amount and all ingredients will be scaled proportionally.
          </DialogDescription>
        </DialogHeader>

        {content}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleApply} 
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!targetYield || parseFloat(targetYield) <= 0}
          >
            Apply Scaling
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}