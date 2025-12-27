import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle, Search, X } from "lucide-react";
import { Ingredient } from "@/api/entities";

export default function IngredientDeduplicationModal({ extractedIngredients, existingIngredients, onComplete, onCancel }) {
  const [unmappedIngredients, setUnmappedIngredients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [mapping, setMapping] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [prefilledPrepActions, setPrefilledPrepActions] = useState({});
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const initializeUnmappedIngredients = useCallback(() => {
    if (!isMounted) return;

    const safeExtracted = Array.isArray(extractedIngredients) ? extractedIngredients : [];
    const safeExisting = Array.isArray(existingIngredients) ? existingIngredients : [];

    const unmapped = safeExtracted.filter(ext => {
      const extNameLower = ext.name?.toLowerCase();
      if (typeof extNameLower !== 'string') return true;

      return !safeExisting.some(ex => {
        const exNameLower = ex.name?.toLowerCase();
        return typeof exNameLower === 'string' && extNameLower === exNameLower;
      });
    });
    setUnmappedIngredients(unmapped);

    const prefilledActions = {};
    safeExtracted.forEach(ext => {
      const lowerName = ext.name?.toLowerCase();
      if (typeof lowerName === 'string') {
        if (lowerName.includes('lemon')) prefilledActions[ext.name] = 'juice';
        else if (lowerName.includes('lime')) prefilledActions[ext.name] = 'juice';
        else if (lowerName.includes('orange')) prefilledActions[ext.name] = 'juice';
        else if (lowerName.includes('grapefruit')) prefilledActions[ext.name] = 'juice';
      }
    });
    setPrefilledPrepActions(prefilledActions);
  }, [extractedIngredients, existingIngredients, isMounted]);

  useEffect(() => {
    initializeUnmappedIngredients();
  }, [initializeUnmappedIngredients]);

  const handleMapSelection = useCallback((extractedIndex, existingName) => {
    const extracted = unmappedIngredients[extractedIndex];
    if (!extracted) return;

    const selectedPrepAction = prefilledPrepActions[extracted.name] || '';

    setMapping(prev => ({ ...prev, [extracted.name]: { mapped_name: existingName, prep_action: selectedPrepAction } }));
    setUnmappedIngredients(prev => prev.filter((_, i) => i !== extractedIndex));
  }, [unmappedIngredients, prefilledPrepActions]);

  const handleCreateNew = useCallback((extractedIndex) => {
    const extracted = unmappedIngredients[extractedIndex];
    if (!extracted) return;

    const selectedPrepAction = prefilledPrepActions[extracted.name] || '';

    setMapping(prev => ({ ...prev, [extracted.name]: { mapped_name: extracted.name, prep_action: selectedPrepAction } }));
    setUnmappedIngredients(prev => prev.filter((_, i) => i !== extractedIndex));
  }, [unmappedIngredients, prefilledPrepActions]);

  const handleComplete = useCallback(async () => {
    setIsProcessing(true);

    // Update aliases for mapped ingredients to improve future matching
    try {
      const updatePromises = [];
      Object.entries(mapping).forEach(([extractedName, mapData]) => {
        // Find the existing ingredient we are mapping to
        const existingIngredient = existingIngredients.find(ing => ing.name === mapData.mapped_name);
        
        if (existingIngredient) {
          const currentAliases = existingIngredient.aliases || [];
          // Check if alias already exists (case-insensitive) to avoid duplicates
          const aliasExists = currentAliases.some(a => a.toLowerCase() === extractedName.toLowerCase());
          
          // Only add if it's not the same name and not already an alias
          if (!aliasExists && extractedName.toLowerCase() !== existingIngredient.name.toLowerCase()) {
            updatePromises.push(
              Ingredient.update(existingIngredient.id, {
                aliases: [...currentAliases, extractedName]
              })
            );
          }
        }
      });
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    } catch (error) {
      console.error("Error updating ingredient aliases:", error);
    }

    onComplete(mapping);
    setIsProcessing(false);
  }, [mapping, onComplete, existingIngredients]);

  const handleCancelClick = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const filteredExisting = useCallback(() => {
    if (!Array.isArray(existingIngredients)) return [];

    const searchTermLower = searchTerm.toLowerCase();
    return existingIngredients.filter(ing => {
      const ingNameLower = ing.name?.toLowerCase();
      return typeof ingNameLower === 'string' && ingNameLower.includes(searchTermLower);
    });
  }, [existingIngredients, searchTerm]);

  if (!isMounted) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && handleCancelClick()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ingredient Deduplication</DialogTitle>
          <DialogDescription>
            We found some new ingredients. Map them to existing ones or create new entries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {unmappedIngredients.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {unmappedIngredients.map((extracted, index) => (
                <div key={index} className="p-3 border rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <span className="font-semibold flex-shrink-0 min-w-[120px]">
                    {extracted.name || "Untitled Ingredient"}
                  </span>
                  <div className="flex-grow flex items-center gap-2">
                    <Select onValueChange={(value) => handleMapSelection(index, value)} value={mapping[extracted.name]?.mapped_name || ''}>
                      <SelectTrigger className="flex-grow">
                        <SelectValue placeholder="Map to existing ingredient..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="relative p-2">
                          <Search className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="Search existing ingredients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        {filteredExisting().length > 0 ? (
                          filteredExisting().map(ing => (
                            <SelectItem key={ing.id} value={ing.name}>
                              {ing.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-gray-500">No matches found.</div>
                        )}
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={() => handleCreateNew(index)} variant="outline" size="sm" className="flex-shrink-0">
                      Create New
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-600 border border-dashed rounded-lg">
              <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
              All extracted ingredients have been mapped or added!
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={handleCancelClick} disabled={isProcessing}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Mapping
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}