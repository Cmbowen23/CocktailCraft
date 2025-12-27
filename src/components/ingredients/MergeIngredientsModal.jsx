import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function MergeIngredientsModal({ 
  isOpen, 
  onClose, 
  selectedIngredients = [], 
  onMerge 
}) {
  const [primaryId, setPrimaryId] = useState(selectedIngredients[0]?.id || '');
  const [isMerging, setIsMerging] = useState(false);

  const handleMerge = async () => {
    if (!primaryId) return;
    
    setIsMerging(true);
    try {
      await onMerge(primaryId);
      onClose();
    } catch (error) {
      console.error('Error merging:', error);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {selectedIngredients.length} Ingredients</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">Select the primary ingredient to keep</p>
              <p className="text-amber-700">All other selected ingredients will be deleted, and their references in recipes will be updated to use the primary ingredient.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Choose Primary Ingredient:</Label>
            <RadioGroup value={primaryId} onValueChange={setPrimaryId}>
              {selectedIngredients.map(ingredient => (
                <div key={ingredient.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value={ingredient.id} id={ingredient.id} />
                  <Label htmlFor={ingredient.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{ingredient.name}</div>
                    <div className="text-sm text-gray-500">
                      {ingredient.category} • {ingredient.supplier || 'No supplier'}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isMerging}>
              Cancel
            </Button>
            <Button 
              onClick={handleMerge} 
              disabled={!primaryId || isMerging}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                'Merge Ingredients'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}